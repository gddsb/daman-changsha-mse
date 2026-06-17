import { NextRequest, NextResponse } from "next/server";
import { createWorkOrder, listWorkOrders } from "@/lib/mes-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get("status") || undefined;
  const statusList = searchParams
    .get("statuses")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const status = statusList && statusList.length > 0 ? undefined : rawStatus;
  const line = searchParams.get("line_code") || searchParams.get("line") || undefined;
  const keyword = searchParams.get("q") || searchParams.get("keyword") || undefined;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;
  try {
    const data = await listWorkOrders({ status, statuses: statusList, line, keyword, limit });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "服务异常";
    console.error("listWorkOrders failed:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.product_code) {
      return NextResponse.json(
        { success: false, error: "缺少料号 product_code" },
        { status: 400 }
      );
    }
    if (!body.planned_quantity || Number(body.planned_quantity) <= 0) {
      return NextResponse.json(
        { success: false, error: "计划数量必须大于 0" },
        { status: 400 }
      );
    }
    if (!body.planned_start_date || !body.planned_end_date) {
      return NextResponse.json(
        { success: false, error: "缺少计划开始/结束日期" },
        { status: 400 }
      );
    }
    // line_code 可选：未传则由 createWorkOrder 用产品 default_line 兜底
    const result = await createWorkOrder({
      order_no: body.order_no ? String(body.order_no).trim() : "",
      product_code: String(body.product_code),
      product_name: body.product_name && body.product_name !== body.product_code ? String(body.product_name) : undefined,
      specification: body.specification,
      planned_quantity: Number(body.planned_quantity),
      line_code: body.line_code ? String(body.line_code) : "",
      line_name: body.line_name ? String(body.line_name) : "",
      priority: body.priority ? Number(body.priority) : 5,
      order_type: body.order_type ? String(body.order_type) : "制罐生产订单",
      customer_name: body.customer_name ? String(body.customer_name) : "",
      sales_order_no: body.sales_order_no ? String(body.sales_order_no) : "",
      planned_start_date: new Date(body.planned_start_date).toISOString(),
      planned_end_date: new Date(body.planned_end_date).toISOString(),
      notes: body.notes ? String(body.notes) : "",
    });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建工单失败";
    const status =
      e instanceof Error && (e as Error & { status?: number }).status
        ? (e as Error & { status?: number }).status
        : 500;
    console.error("createWorkOrder failed:", e);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
