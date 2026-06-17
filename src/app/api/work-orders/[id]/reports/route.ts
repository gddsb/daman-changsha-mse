import { NextRequest, NextResponse } from 'next/server';
import {
  createWorkOrderReport,
  getWorkOrder,
  updateWorkOrderStatus,
  updateOperation,
} from '@/lib/mes-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const wo = await getWorkOrder(id);
    if (!wo) {
      return NextResponse.json({ success: false, error: '工单不存在' }, { status: 404 });
    }

    // 1. 创建报工记录
    const report = await createWorkOrderReport({
      work_order_id: id,
      operation_id: body.operation_id ?? null,
      report_type: body.report_type ?? '报工',
      operator_name: body.operator_name,
      good_quantity: body.good_quantity ?? 0,
      scrap_quantity: body.scrap_quantity ?? 0,
      scrap_reason: body.scrap_reason ?? null,
      notes: body.notes ?? null,
    });

    // 2. 更新工单的累计数量
    const newCompleted = (wo.completed_quantity ?? 0) + report.good_quantity;
    const newScrap = (wo.scrap_quantity ?? 0) + report.scrap_quantity;
    const total = newCompleted + newScrap;
    const newStatus = total >= wo.quantity ? 'completed' : 'in_progress';

    await updateWorkOrderStatus(id, newStatus, {
      completed_quantity: newCompleted,
      scrap_quantity: newScrap,
      actual_end_date:
        newStatus === 'completed' ? new Date().toISOString() : wo.actual_end_date,
    });

    // 3. 如果指定了工序，更新工序累计
    if (body.operation_id) {
      const supa = getSupabaseClient();
      const { data: op } = await supa
        .from('work_order_operations')
        .select('good_quantity, scrap_quantity, status')
        .eq('id', body.operation_id)
        .maybeSingle();
      if (op) {
        await updateOperation(body.operation_id, {
          good_quantity: (op.good_quantity ?? 0) + report.good_quantity,
          scrap_quantity: (op.scrap_quantity ?? 0) + report.scrap_quantity,
          status: 'in_progress',
        });
      }
    }

    return NextResponse.json({ success: true, data: report });
  } catch (e) {
    const message = e instanceof Error ? e.message : '报工失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
