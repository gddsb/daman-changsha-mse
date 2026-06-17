import { NextRequest, NextResponse } from "next/server";
import { getWorkOrder, updateWorkOrderStatus } from "@/lib/mes-service";

const ACTION_TO_STATUS: Record<string, string> = {
  release: "已下发",
  start: "开工",
  pause: "挂起",
  resume: "开工",
  complete: "完工",
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
    let body: { action?: string } = {};
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
      return NextResponse.json(
        { success: false, error: `未知操作: ${action}` },
        { status: 400 }
      );
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
