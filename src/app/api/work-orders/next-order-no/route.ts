import { NextRequest, NextResponse } from 'next/server';
import { generateOrderNo } from '@/lib/mes-service';

export async function GET(_request: NextRequest) {
  try {
    const orderNo = await generateOrderNo();
    return NextResponse.json({ success: true, data: orderNo });
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成 MO 号失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
