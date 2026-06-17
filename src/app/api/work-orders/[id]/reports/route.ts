import { NextRequest, NextResponse } from "next/server";
import { createWorkOrderReport, getWorkOrder } from "@/lib/mes-service";

// 报工/工单报工顶层
// POST 创建工单报工批次
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const woWrap = await getWorkOrder(id);
    const wo = woWrap?.workOrder;
    if (!wo) {
      return NextResponse.json({ success: false, error: "工单不存在" }, { status: 404 });
    }
    if (wo.status === "完工" || wo.status === "超期完工") {
      return NextResponse.json({ success: false, error: "工单已完工/超期完工，不能再创建工单报工" }, { status: 400 });
    }
    if (wo.status === "开立" || wo.status === "下发") {
      return NextResponse.json(
        { success: false, error: "工单还未开工（开立/下发），请先开工后再做工单报工" },
        { status: 400 },
      );
    }
    if (!body.batch_no || !body.start_at) {
      return NextResponse.json({ success: false, error: "生产批号、开始时间为必填" }, { status: 400 });
    }
    const rep = await createWorkOrderReport({
      work_order_id: id,
      batch_no: body.batch_no,
      start_at: body.start_at,
      change_line_at: body.change_line_at ?? null,
      skilled_workers: Number(body.skilled_workers ?? 0),
      general_workers: Number(body.general_workers ?? 0),
      labor_workers: Number(body.labor_workers ?? 0),
      cleanup_minutes: Number(body.cleanup_minutes ?? 0),
      notes: body.notes ?? "",
    });
    return NextResponse.json({ success: true, data: rep });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
