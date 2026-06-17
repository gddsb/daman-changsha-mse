import { NextResponse } from "next/server";
import { getWorkOrder } from "@/lib/mes-service";

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
