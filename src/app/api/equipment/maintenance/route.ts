import { NextRequest, NextResponse } from 'next/server';
import {
  listEquipmentMaintenance,
  createMaintenance,
  completeMaintenance,
} from '@/lib/mes-service';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const data = await listEquipmentMaintenance({ status: sp.get('status') ?? undefined });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询维保记录失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const created = await createMaintenance(body);
    return NextResponse.json({ success: true, data: created });
  } catch (e) {
    const message = e instanceof Error ? e.message : '创建维保记录失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    await completeMaintenance(body.id, body.operator_name, body.cost, body.notes);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '完结维保记录失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
