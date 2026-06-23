import { NextRequest, NextResponse } from "next/server";
import {
  listReportSummariesV2,
  createWorkOrderReportV2,
  getWorkOrder,
} from "@/lib/mes-service";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import type { WorkOrder } from "@/types/mes";

export const dynamic = "force-dynamic";

/**
 * 报工管理（顶层菜单）数据接口
 * 列出所有有过报工的工单 + 每条工单下的工单报工 + 工序报工（V2 4 张表）
 */
export async function GET() {
  try {
    const data = await listReportSummariesV2();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询报工汇总失败";
    const detail =
      err instanceof Error
        ? `${err.message}\n${err.stack ?? ""}`
        : JSON.stringify(err);
    // eslint-disable-next-line no-console
    console.error("[reports] 500:", detail);
    return NextResponse.json(
      { success: false, error: message, debug: detail },
      { status: 500 }
    );
  }
}

/**
 * 新建工单报工批次（顶层入口）
 * body: { workOrderNo, batchNo, startAt, skilledWorkers?, generalWorkers?, laborWorkers?, otherWorkers?, abnormalMinutes?, notes? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workOrderNo: string = body.workOrderNo ?? body.work_order_no ?? "";
    if (!workOrderNo) {
      return NextResponse.json(
        { success: false, error: "缺少工单号 workOrderNo" },
        { status: 400 },
      );
    }
    // 通过 order_no 查出工单 id，再走 getWorkOrder（避免再写 toWoView）
    const c = getSupabaseClient();
    const { data: woRow, error: woErr } = await c
      .from("work_orders")
      .select("id, status")
      .eq("order_no", workOrderNo)
      .maybeSingle();
    if (woErr) throw woErr;
    if (!woRow) {
      return NextResponse.json(
        { success: false, error: `工单 ${workOrderNo} 不存在` },
        { status: 404 },
      );
    }
    const woView = await getWorkOrder((woRow as { id: string }).id);
    if (!woView) {
      return NextResponse.json(
        { success: false, error: `工单 ${workOrderNo} 不存在` },
        { status: 404 },
      );
    }
    const status: WorkOrder["status"] = woView.workOrder.status;
    if (status === "开立" || status === "下发") {
      return NextResponse.json(
        { success: false, error: "工单还未开工（开立/下发），请先开工后再做工单报工" },
        { status: 400 },
      );
    }
    if (status === "完工" || status === "超期完工") {
      return NextResponse.json(
        { success: false, error: "工单已完工/超期完工，不能再创建工单报工" },
        { status: 400 },
      );
    }
    const data = await createWorkOrderReportV2({
      workOrderNo,
      batchNo: body.batchNo ?? body.batch_no ?? `BATCH-${Date.now()}`,
      startAt: body.startAt ?? body.start_at ?? new Date().toISOString(),
      skilledWorkers: Number(body.skilledWorkers ?? body.skilled_workers ?? 0),
      generalWorkers: Number(body.generalWorkers ?? body.general_workers ?? 0),
      laborWorkers: Number(body.laborWorkers ?? body.labor_workers ?? 0),
      otherWorkers: Number(body.otherWorkers ?? body.other_workers ?? 0),
      abnormalMinutes: Number(body.abnormalMinutes ?? body.abnormal_minutes ?? 0),
      notes: body.notes ?? "",
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "新建工单报工失败";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

