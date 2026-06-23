import { NextRequest, NextResponse } from "next/server";
import { checkCompletionBalanceV2 } from "@/lib/mes-service";

export const dynamic = "force-dynamic";

async function run(orderNo: string, batchNo: string, finishSeq: string) {
  const data = await checkCompletionBalanceV2(orderNo, batchNo, Number(finishSeq));
  const httpStatus = data.ok ? 200 : 422;
  return NextResponse.json({ success: data.ok, data }, { status: httpStatus });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNo: string; batchNo: string; finishSeq: string }> }
) {
  try {
    const p = await params;
    return await run(p.orderNo, p.batchNo, p.finishSeq);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNo: string; batchNo: string; finishSeq: string }> }
) {
  try {
    const p = await params;
    return await run(p.orderNo, p.batchNo, p.finishSeq);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
