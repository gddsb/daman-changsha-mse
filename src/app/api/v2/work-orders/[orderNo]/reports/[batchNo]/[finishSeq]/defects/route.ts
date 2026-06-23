import { NextRequest, NextResponse } from "next/server";
import {
  listOperationDefectsV2,
  upsertOperationDefectV2,
} from "@/lib/mes-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNo: string; batchNo: string; finishSeq: string }> }
) {
  try {
    const { orderNo, batchNo, finishSeq } = await params;
    const processCode = req.nextUrl.searchParams.get("processCode") ?? "";
    if (!processCode) {
      return NextResponse.json(
        { success: false, error: "缺少 processCode 查询参数" },
        { status: 400 }
      );
    }
    const data = await listOperationDefectsV2(orderNo, batchNo, Number(finishSeq), processCode);
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
    const processCode = String(body.processCode ?? "");
    if (!processCode) {
      return NextResponse.json(
        { success: false, error: "缺少 processCode 字段" },
        { status: 400 }
      );
    }
    const data = await upsertOperationDefectV2({
      workOrderNo: orderNo,
      batchNo,
      finishSeq: Number(finishSeq),
      processCode,
      defectCategory: String(body.defectCategory ?? ""),
      defectName: String(body.defectName ?? ""),
      defectQty: Number(body.defectQty ?? 0),
      unit: String(body.unit ?? "件"),
      notes: body.notes,
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
