import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkOrder,
  listWorkOrderOperations,
  listWorkOrderReports,
  updateWorkOrderStatus,
} from '@/lib/mes-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const wo = await getWorkOrder(id);
    if (!wo) {
      return NextResponse.json({ success: false, error: '工单不存在' }, { status: 404 });
    }
    const [operations, reports] = await Promise.all([
      listWorkOrderOperations(id),
      listWorkOrderReports(id),
    ]);
    return NextResponse.json({ success: true, data: { workOrder: wo, operations, reports } });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询工单详情失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const ACTION_TO_STATUS: Record<string, { status: string; next?: { set_actual_start?: boolean; set_actual_end?: boolean } }> = {
  release: { status: 'released' },
  start: { status: 'in_progress', next: { set_actual_start: true } },
  pause: { status: 'paused' },
  resume: { status: 'in_progress' },
  complete: { status: 'completed', next: { set_actual_end: true } },
  close: { status: 'closed' },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action as string;
    const mapping = ACTION_TO_STATUS[action];
    if (!mapping) {
      return NextResponse.json({ success: false, error: `未知操作: ${action}` }, { status: 400 });
    }
    const extra: Record<string, unknown> = {};
    if (mapping.next?.set_actual_start) {
      extra.actual_start_date = new Date().toISOString();
    }
    if (mapping.next?.set_actual_end) {
      extra.actual_end_date = new Date().toISOString();
    }
    await updateWorkOrderStatus(id, mapping.status, extra);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '更新工单失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
