import { NextRequest, NextResponse } from 'next/server';
import { createReport, getWorkOrder } from '@/lib/mes-service';
import { recomputeDailyQualityReport } from '@/lib/daily-quality-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 兜底：报工产线信息从工单取
    const woWrap = await getWorkOrder(id);
    const wo = woWrap?.workOrder;

    const operatorName = body.operator_name ?? body.operator;
    if (!operatorName || !body.process_name || !body.line_code || !body.batch_no) {
      return NextResponse.json(
        { success: false, error: '操作员/工序/产线/批次为必填' },
        { status: 400 },
      );
    }
    const good = Number(body.good_quantity ?? body.good_qty ?? 0);
    const scrap = Number(body.scrap_quantity ?? body.scrap_qty ?? 0);
    if (Number.isNaN(good) || Number.isNaN(scrap) || good < 0 || scrap < 0) {
      return NextResponse.json(
        { success: false, error: '数量必须为非负数' },
        { status: 400 },
      );
    }

    const report = await createReport({
      work_order_id: id,
      operation_id: body.operation_id ?? body.process_id,
      process_name: body.process_name,
      operator_name: operatorName,
      // line_code/line_name 兜底从工单取，避免历史数据 / 前端没传时丢失
      line_code: body.line_code || wo?.line_code,
      line_name: body.line_name || wo?.line_name,
      shift_no: body.shift_no ?? '白班',
      good_quantity: good,
      scrap_quantity: scrap,
      batch_no: body.batch_no,
      inspector_name: body.inspector_name ?? operatorName,
      can_spec: body.can_spec,
      can_height: body.can_height ? Number(body.can_height) : undefined,
      notes: body.notes ?? body.scrap_reason,
    });

    // 同步刷新该工序+该产线+当日的质量日报
    await recomputeDailyQualityReport({
      report_date: new Date().toISOString().slice(0, 10),
      line_code: body.line_code,
      process_name: body.process_name,
      product_code: report.product_code ?? "",
      product_name: report.product_name ?? "",
      can_spec: body.can_spec,
      can_height: body.can_height ? Number(body.can_height) : undefined,
      shift_no: body.shift_no ?? '白班',
    });

    return NextResponse.json({ success: true, data: report });
  } catch (e) {
    const message = e instanceof Error ? e.message : '报工失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
