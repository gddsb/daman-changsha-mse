import { NextRequest, NextResponse } from 'next/server';
import { listPlans, updatePlan, getWorkOrder, addPlan } from '@/lib/mes-service';
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
      planned_quantity?: number;
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
      planned_quantity: body.planned_quantity,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : '调整计划失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      work_order_id?: string;
      plan_date?: string;
      line_code?: string;
      line_name?: string;
      planned_quantity?: number;
      priority?: number;
    };
    if (!body.work_order_id || !body.plan_date || !body.line_code) {
      return NextResponse.json(
        { success: false, error: '缺少工单 / 日期 / 产线' },
        { status: 400 }
      );
    }
    // 防止重复排产
    const supa = getSupabaseClient();
    const { data: existing } = await supa
      .from('production_plans')
      .select('id')
      .eq('work_order_id', body.work_order_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { success: false, error: '该工单已在排产计划中' },
        { status: 409 }
      );
    }
    const woResult = await getWorkOrder(body.work_order_id);
    if (!woResult || !woResult.workOrder) {
      return NextResponse.json(
        { success: false, error: '工单不存在' },
        { status: 404 }
      );
    }
    const wo = woResult.workOrder;
    // 工单未存 line_name 时按产线字典补
    let lineName = body.line_name;
    if (!lineName) {
      const c2 = getSupabaseClient();
      const { data: ln } = await c2.from("production_lines").select("name").eq("code", body.line_code).maybeSingle();
      lineName = (ln as { name?: string } | null)?.name ?? body.line_code;
    }
    const created = await addPlan({
      work_order_id: body.work_order_id,
      work_order_no: wo.order_no,
      plan_date: body.plan_date,
      line_code: body.line_code,
      line_name: lineName,
      product_code: wo.product_code,
      product_name: wo.product_name,
      planned_quantity: body.planned_quantity ?? wo.quantity ?? 0,
      priority: body.priority ?? wo.priority ?? 3,
      status: 'planned',
    } as Omit<import('@/types/mes').ProductionPlan, 'id' | 'created_at' | 'updated_at'>);
    return NextResponse.json({ success: true, data: created });
  } catch (e) {
    console.error('addPlan failed:', e);
    const message = e instanceof Error ? e.message : '创建排产失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
