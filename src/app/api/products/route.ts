import { NextRequest, NextResponse } from 'next/server';
import { listProducts } from '@/lib/mes-service';

export async function GET(_request: NextRequest) {
  try {
    const data = await listProducts();
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询物料失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
