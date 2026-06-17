import { NextRequest, NextResponse } from 'next/server';
import {
  listWorkOrders,
  createWorkOrder,
} from '@/lib/mes-service';
import { generateWorkOrderNo } from '@/lib/format';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const status = sp.get('status') ?? undefined;
    const workshopCode = sp.get('workshopCode') ?? undefined;
    const search = sp.get('search') ?? undefined;
    const limit = sp.get('limit') ? Number(sp.get('limit')) : undefined;
    const data = await listWorkOrders({ status, workshopCode, search, limit });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询工单失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seq = Math.floor(Math.random() * 900) + 100;
    const order_no = body.order_no || generateWorkOrderNo(seq);
    const created = await createWorkOrder({ ...body, order_no });
    return NextResponse.json({ success: true, data: created });
  } catch (e) {
    const message = e instanceof Error ? e.message : '创建工单失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
