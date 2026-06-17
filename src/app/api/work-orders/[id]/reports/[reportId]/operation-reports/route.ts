import { NextRequest, NextResponse } from "next/server";
import { createOperationReport } from "@/lib/mes-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  try {
    const { id, reportId } = await params;
    const body = await request.json();
    if (!body.operation_id || !body.process_name) {
      return NextResponse.json({ success: false, error: "工序 ID / 工序名为必填" }, { status: 400 });
    }
    const inputQty = Number(body.input_qty ?? 0);
    const defectQty = Number(body.defect_qty ?? 0);
    if (Number.isNaN(inputQty) || Number.isNaN(defectQty) || inputQty < 0 || defectQty < 0) {
      return NextResponse.json({ success: false, error: "投入/不良数量必须为非负数" }, { status: 400 });
    }
    if (defectQty > inputQty) {
      return NextResponse.json({ success: false, error: "不良数量不能超过工序投入数量" }, { status: 400 });
    }
    const opRep = await createOperationReport({
      work_order_report_id: reportId,
      operation_id: body.operation_id,
      process_name: body.process_name,
      sequence: Number(body.sequence ?? 0),
      material_code: body.material_code,
      material_name: body.material_name,
      material_batch_no: body.material_batch_no,
      input_qty: inputQty,
      defect_qty: defectQty,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, data: opRep });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
