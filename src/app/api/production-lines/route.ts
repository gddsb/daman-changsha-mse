import { NextResponse } from 'next/server';
import { listProductionLines } from '@/lib/mes-service';

export async function GET() {
  try {
    const data = await listProductionLines();
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '获取产线失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
