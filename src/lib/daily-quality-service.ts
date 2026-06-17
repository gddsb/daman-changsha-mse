import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface RecomputeInput {
  report_date: string;
  line_code: string;
  line_name?: string;
  process_name: string;
  product_code: string;
  product_name: string;
  can_spec?: string;
  can_height?: number;
  shift_no: string;
}

/**
 * 重新聚合某日某产线某工序某产品的质量日报数据。
 * 数据源 = work_order_reports；目标表 = daily_quality_reports。
 */
export async function recomputeDailyQualityReport(input: RecomputeInput) {
  const c = getSupabaseClient();
  const line_name = input.line_name ?? (input.line_code === 'LINE-A' ? 'A线' : 'B线');

  // 1) 从报工记录汇总
  const { data: reports, error } = await c
    .from('work_order_reports')
    .select('good_quantity, scrap_quantity, can_spec, can_height, shift_no')
    .eq('process_name', input.process_name)
    .eq('line_code', input.line_code)
    .gte('reported_at', `${input.report_date}T00:00:00`)
    .lte('reported_at', `${input.report_date}T23:59:59`);
  if (error) throw error;

  const filtered = (reports ?? []).filter((r: { can_spec: string | null; can_height: number | null; shift_no: string | null }) => {
    if (input.can_spec && r.can_spec !== input.can_spec) return false;
    if (input.can_height && r.can_height !== input.can_height) return false;
    if (input.shift_no && r.shift_no !== input.shift_no) return false;
    return true;
  });

  let good = 0;
  let scrap = 0;
  filtered.forEach((r: { good_quantity: number | null; scrap_quantity: number | null }) => {
    good += Number(r.good_quantity ?? 0);
    scrap += Number(r.scrap_quantity ?? 0);
  });
  const total = good + scrap;
  const pass_rate = total > 0 ? good / total : 0;
  const scrap_rate = total > 0 ? scrap / total : 0;

  // 2) 查已存在的日报记录
  const { data: existing } = await c
    .from('daily_quality_reports')
    .select('id')
    .eq('report_date', input.report_date)
    .eq('line_code', input.line_code)
    .eq('process_name', input.process_name)
    .eq('product_code', input.product_code)
    .eq('shift_no', input.shift_no)
    .maybeSingle();

  const payload = {
    report_date: input.report_date,
    line_code: input.line_code,
    line_name,
    process_name: input.process_name,
    product_code: input.product_code,
    product_name: input.product_name,
    can_spec: input.can_spec ?? null,
    can_height: input.can_height ?? null,
    shift_no: input.shift_no,
    total_inspected: total,
    total_good: good,
    total_scrap: scrap,
    pass_rate,
    scrap_rate,
  };

  if (existing?.id) {
    await c.from('daily_quality_reports').update(payload).eq('id', existing.id);
  } else {
    await c.from('daily_quality_reports').insert(payload);
  }
}
