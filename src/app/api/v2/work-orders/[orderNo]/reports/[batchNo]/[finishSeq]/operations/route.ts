import { NextRequest, NextResponse } from "next/server";
import {
  listOperationReportsV2,
  upsertOperationReportV2,
} from "@/lib/mes-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNo: string; batchNo: string; finishSeq: string }> }
) {
  try {
    const { orderNo, batchNo, finishSeq } = await params;
    const data = await listOperationReportsV2(orderNo, batchNo, Number(finishSeq));
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
    const data = await upsertOperationReportV2({
      workOrderNo: orderNo,
      batchNo,
      finishSeq: Number(finishSeq),
      processCode: String(body.processCode ?? ""),
      processName: String(body.processName ?? ""),
      sequence: Number(body.sequence ?? 0),
      quantity: body.quantity == null ? null : Number(body.quantity),
      incomingDefectPiece: Number(body.incomingDefectPiece ?? 0),
      incomingDefectLid: Number(body.incomingDefectLid ?? 0),
      processDefectPiece: Number(body.processDefectPiece ?? 0),
      processDefectLid: Number(body.processDefectLid ?? 0),
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
