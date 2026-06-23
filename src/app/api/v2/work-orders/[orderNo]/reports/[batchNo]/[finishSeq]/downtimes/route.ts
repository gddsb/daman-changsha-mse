import { NextRequest, NextResponse } from "next/server";
import {
  listEquipmentDowntimeV2,
  createEquipmentDowntimeV2,
} from "@/lib/mes-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNo: string; batchNo: string; finishSeq: string }> }
) {
  try {
    const { orderNo, batchNo, finishSeq } = await params;
    const data = await listEquipmentDowntimeV2(orderNo, batchNo, Number(finishSeq));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNo: string; batchNo: string; finishSeq: string }> }
) {
  try {
    const { orderNo, batchNo, finishSeq } = await params;
    const body = await req.json();
    const data = await createEquipmentDowntimeV2({
      workOrderNo: orderNo,
      batchNo,
      finishSeq: Number(finishSeq),
      equipmentCode: String(body.equipmentCode ?? ""),
      downtimeStart: String(body.downtimeStart ?? new Date().toISOString()),
      downtimeType: String(body.downtimeType ?? ""),
      faultDesc: String(body.faultDesc ?? ""),
      fixAt: body.fixAt ?? null,
      confirmedBy: String(body.confirmedBy ?? ""),
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
