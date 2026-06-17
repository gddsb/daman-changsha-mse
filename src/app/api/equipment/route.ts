import { NextRequest, NextResponse } from 'next/server';
import { listEquipment } from '@/lib/mes-service';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const data = await listEquipment({
      status: sp.get('status') ?? undefined,
      workshopCode: sp.get('workshopCode') ?? undefined,
      type: sp.get('type') ?? undefined,
      search: sp.get('search') ?? undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询设备失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
