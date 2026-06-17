import { NextRequest, NextResponse } from 'next/server';
import { listProducts, updateProduct } from '@/lib/mes-service';

export async function GET(_request: NextRequest) {
  try {
    const data = await listProducts();
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询物料失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: '请求体必须为 JSON' }, { status: 400 });
    }
    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json({ success: false, error: '缺少产品 id' }, { status: 400 });
    }
    const data = await updateProduct({
      id: body.id,
      name: typeof body.name === 'string' ? body.name : undefined,
      specification: body.specification === undefined ? undefined : (body.specification as string | null),
      unit: body.unit === undefined ? undefined : (body.unit as string | null),
      process_route: body.process_route === undefined ? undefined : (body.process_route as string | null),
      default_line_code: body.default_line_code === undefined ? undefined : (body.default_line_code as string | null),
      default_line_name: body.default_line_name === undefined ? undefined : (body.default_line_name as string | null),
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error('[PATCH /api/products] error:', e);
    const message = e instanceof Error ? e.message : '更新产品失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
