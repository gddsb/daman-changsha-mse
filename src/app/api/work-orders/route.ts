import { NextRequest, NextResponse } from 'next/server';
import { listWorkOrders, createWorkOrder } from '@/lib/mes-service';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const status = sp.get('status') ?? undefined;
    const line = sp.get('line_code') ?? undefined;
    const keyword = sp.get('search') ?? undefined;
    const limit = sp.get('limit') ? Number(sp.get('limit')) : undefined;
    const data = await listWorkOrders({ status, line, keyword, limit });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询工单失败';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.product_code || !body.planned_quantity || !body.line_code) {
      return NextResponse.json(
        { success: false, error: '产品/计划数量/产线为必填' },
        { status: 400 },
      );
    }
    if (Number(body.planned_quantity) <= 0) {
      return NextResponse.json(
        { success: false, error: '计划数量必须大于 0' },
        { status: 400 },
      );
    }
    const wo = await createWorkOrder({
      product_code: String(body.product_code),
      product_name: body.product_name && body.product_name !== body.product_code ? String(body.product_name) : undefined,
      specification: body.specification,
      planned_quantity: Number(body.planned_quantity),
      line_code: String(body.line_code),
      line_name: body.line_name,
      priority: body.priority ? Number(body.priority) : undefined,
      order_type: body.order_type,
      customer_name: body.customer_name,
      sales_order_no: body.sales_order_no,
      planned_start_date: body.planned_start_date,
      planned_end_date: body.planned_end_date,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, data: wo });
  } catch (e) {
    const message = e instanceof Error ? e.message : '创建工单失败';
    const status =
      (typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status?: number }).status === 'number')
        ? (e as { status: number }).status
        : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status },
    );
  }
}
