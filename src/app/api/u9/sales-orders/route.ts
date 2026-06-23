import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { u9Client } from '@/lib/u9-client';

export async function GET() {
  try {
    const c = getSupabaseClient();
    const { data, error } = await c
      .from('u9_sales_orders')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : '获取 U9 销售订单失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  try {
    const orders = await u9Client.fetchSalesOrders();
    if (orders.length === 0) {
      return NextResponse.json({ success: true, data: { syncedCount: 0, message: 'U9 未返回数据' } });
    }
    const c = getSupabaseClient();
    const rows = orders.map((o) => ({
      id: crypto.randomUUID(),
      sales_order_no: o.salesOrderNo,
      customer_code: o.customerCode ?? null,
      customer_name: o.customerName,
      product_code: o.productCode,
      product_name: o.productName,
      quantity: o.quantity,
      unit: o.unit ?? null,
      delivery_date: o.deliveryDate ?? null,
      status: o.status ?? '待发货',
      synced_at: new Date().toISOString(),
    }));
    const { error } = await c
      .from('u9_sales_orders')
      .upsert(rows, { onConflict: 'sales_order_no', ignoreDuplicates: false });
    if (error) throw error;
    return NextResponse.json({ success: true, data: { syncedCount: rows.length } });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'U9 销售订单同步失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
