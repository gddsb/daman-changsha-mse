import { NextRequest, NextResponse } from 'next/server';
import { listPlans, updatePlan, getWorkOrder } from '@/lib/mes-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getProductionDate } from '@/lib/date-utils';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const lineCode = sp.get('line_code') ?? undefined;
    const from = sp.get('from') ?? getProductionDate(new Date());
    // 默认滚动 7 天
    const to = sp.get('to') ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() + 6);
      return getProductionDate(d);
    })();
    const data = await listPlans({ start_date: from, end_date: to, line_code: lineCode });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '获取计划失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: string;
      work_order_id?: string;
      plan_date?: string;
      line_code?: string;
      priority?: number;
    };
    let planId = body.id;
    if (!planId && body.work_order_id) {
      const supa = getSupabaseClient();
      const { data: plan } = await supa
        .from('production_plans')
        .select('id')
        .eq('work_order_id', body.work_order_id)
        .maybeSingle();
      if (!plan) {
        return NextResponse.json({ success: false, error: '该工单未在排产计划中' }, { status: 404 });
      }
      planId = plan.id;
    }
    if (!planId) {
      return NextResponse.json({ success: false, error: '缺少计划 id' }, { status: 400 });
    }
    const updated = await updatePlan(planId, {
      plan_date: body.plan_date,
      line_code: body.line_code,
      priority: body.priority,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : '调整计划失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
