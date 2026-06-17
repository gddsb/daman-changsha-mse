import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getWorkOrder, updateWorkOrderStatus } from "@/lib/mes-service";

const ACTION_TO_STATUS: Record<string, string> = {
  release: "released",
  start: "in_progress",
  pause: "paused",
  resume: "in_progress",
  complete: "completed",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getWorkOrder(id);
    if (!data) {
      return NextResponse.json(
        { success: false, error: "工单不存在" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("GET /api/work-orders/[id] error:", e);
    return NextResponse.json(
      { success: false, error: "获取工单详情失败" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: { action?: string; planned_quantity?: number; planned_start_date?: string; planned_end_date?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "请求体必须为 JSON" },
        { status: 400 }
      );
    }
    const action = body.action;
    const nextStatus = action ? ACTION_TO_STATUS[action] : undefined;
    if (!nextStatus) {
      // 兼容双击编辑：直接 patch 工单字段
      if (!action) {
        const c = getSupabaseClient();
        const patch: Record<string, unknown> = {};
        if (typeof body.planned_quantity === "number" && body.planned_quantity > 0) {
          patch.planned_quantity = body.planned_quantity;
        }
        if (typeof body.planned_start_date === "string" && body.planned_start_date) {
          patch.planned_start_date = body.planned_start_date;
        }
        if (typeof body.planned_end_date === "string" && body.planned_end_date) {
          patch.planned_end_date = body.planned_end_date;
        }
        if (Object.keys(patch).length === 0) {
          return NextResponse.json(
            { success: false, error: "未提供可修改字段" },
            { status: 400 }
          );
        }
        const { data, error } = await c
          .from("work_orders")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }
      return NextResponse.json(
        { success: false, error: `未知操作: ${action}` },
        { status: 400 }
      );
    }

    // 开工前检查同产线是否有未完工的工单
    if (nextStatus === "in_progress") {
      const c = getSupabaseClient();
      const { data: wo } = await c
        .from("work_orders")
        .select("line_code, line_name, order_no")
        .eq("id", id)
        .maybeSingle();
      if (!wo) {
        return NextResponse.json(
          { success: false, error: "工单不存在" },
          { status: 404 }
        );
      }
      const lineCode = (wo as { line_code: string | null }).line_code;
      const lineName = (wo as { line_name: string | null }).line_name ?? lineCode;
      if (lineCode) {
        const { data: active } = await c
          .from("work_orders")
          .select("id, order_no, status")
          .eq("line_code", lineCode)
          .in("status", ["released", "in_progress", "paused"])
          .neq("id", id)
          .limit(5);
        if (active && active.length > 0) {
          const activeList = (active as Array<{ order_no: string; status: string }>)
            .map((a) => `${a.order_no}（${a.status}）`)
            .join("、");
          return NextResponse.json(
            {
              success: false,
              error: `${lineName ?? lineCode}有未完工工单：${activeList}。请先完工或暂停后再开工。`,
            },
            { status: 409 }
          );
        }
      }
    }

    const updated = await updateWorkOrderStatus(id, nextStatus);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: "工单不存在" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "操作失败";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
