import { NextRequest, NextResponse } from 'next/server';
import {
  getEquipment,
  listEquipmentOee,
  listEquipmentMaintenance,
  updateEquipmentStatus,
} from '@/lib/mes-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const equipment = await getEquipment(id);
    if (!equipment) {
      return NextResponse.json({ success: false, error: '设备不存在' }, { status: 404 });
    }
    const oee = await listEquipmentOee(7);
    const maintenance = await listEquipmentMaintenance();
    return NextResponse.json({
      success: true,
      data: { equipment, oee, maintenance: maintenance.filter((m) => m.equipment_code === equipment.code) },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询设备详情失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    await updateEquipmentStatus(id, body);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '更新设备失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
