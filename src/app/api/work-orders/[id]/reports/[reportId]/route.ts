import { NextRequest, NextResponse } from 'next/server';
import { getReport, updateReport } from '@/lib/mes-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  try {
    const { reportId } = await params;
    const report = await getReport(reportId);
    if (!report) {
      return NextResponse.json({ success: false, error: '报工单不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: report });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询报工单失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  try {
    const { id: workOrderId, reportId } = await params;
    const body = await request.json();

    const good = Number(body.good_quantity ?? body.good_qty ?? 0);
    const scrap = Number(body.scrap_quantity ?? body.scrap_qty ?? 0);
    if (Number.isNaN(good) || Number.isNaN(scrap) || good < 0 || scrap < 0) {
      return NextResponse.json(
        { success: false, error: '数量必须为非负数' },
        { status: 400 },
      );
    }

    const updated = await updateReport({
      report_id: reportId,
      work_order_id: workOrderId,
      good_quantity: good,
      scrap_quantity: scrap,
      operator_name: body.operator_name,
      process_name: body.process_name,
      shift_no: body.shift_no,
      batch_no: body.batch_no,
      inspector_name: body.inspector_name,
      can_spec: body.can_spec,
      can_height: body.can_height != null ? Number(body.can_height) : undefined,
      notes: body.notes ?? body.scrap_reason,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : '更新报工单失败';
    const status = /完工|关闭|未找到|不允许/.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
