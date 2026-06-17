import { NextRequest, NextResponse } from "next/server";
import { deleteOperationReport, updateOperationReport } from "@/lib/mes-service";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string; opReportId: string }> },
) {
  try {
    const { id, reportId, opReportId } = await params;
    const body = await request.json();
    const inputQty = body.input_qty !== undefined ? Number(body.input_qty) : undefined;
    const defectQty = body.defect_qty !== undefined ? Number(body.defect_qty) : undefined;
    if (inputQty !== undefined && (Number.isNaN(inputQty) || inputQty < 0)) {
      return NextResponse.json({ success: false, error: "工序投入数量必须为非负数" }, { status: 400 });
    }
    if (defectQty !== undefined && (Number.isNaN(defectQty) || defectQty < 0)) {
      return NextResponse.json({ success: false, error: "不良数量必须为非负数" }, { status: 400 });
    }
    if (inputQty !== undefined && defectQty !== undefined && defectQty > inputQty) {
      return NextResponse.json({ success: false, error: "不良数量不能超过工序投入数量" }, { status: 400 });
    }
    const opRep = await updateOperationReport({
      report_id: opReportId,
      work_order_report_id: reportId,
      operation_id: body.operation_id,
      process_name: body.process_name,
      sequence: body.sequence !== undefined ? Number(body.sequence) : undefined,
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string; opReportId: string }> },
) {
  try {
    const { opReportId } = await params;
    const r = await deleteOperationReport(opReportId);
    return NextResponse.json({ success: true, data: r });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
