import { NextRequest, NextResponse } from "next/server";
import { createOrUpdateOpReport } from "@/lib/mes-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.operation_seq == null || !body.operation_name) {
      return NextResponse.json(
        { success: false, error: "缺少必填参数 operation_seq / operation_name" },
        { status: 400 }
      );
    }
    // 工序报工不再需要投入数（自动计算），只需录入合格数；不良数从operation_defects汇总
    const data = await createOrUpdateOpReport({
      work_order_report_id: id,
      operation_seq: body.operation_seq,
      operation_name: body.operation_name,
      pass_quantity: body.pass_quantity ?? 0,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("POST /api/reports/[id]/operations error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "保存工序报工失败" },
      { status: 500 }
    );
  }
}
