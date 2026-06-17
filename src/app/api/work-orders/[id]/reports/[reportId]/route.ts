import { NextRequest, NextResponse } from "next/server";
import { deleteWorkOrderReport, getWorkOrder, updateWorkOrderReport } from "@/lib/mes-service";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  try {
    const { id, reportId } = await params;
    const body = await request.json();
    const rep = await updateWorkOrderReport({
      report_id: reportId,
      work_order_id: id,
      batch_no: body.batch_no,
      start_at: body.start_at,
      change_line_at: body.change_line_at,
      skilled_workers: body.skilled_workers !== undefined ? Number(body.skilled_workers) : undefined,
      general_workers: body.general_workers !== undefined ? Number(body.general_workers) : undefined,
      labor_workers: body.labor_workers !== undefined ? Number(body.labor_workers) : undefined,
      cleanup_minutes: body.cleanup_minutes !== undefined ? Number(body.cleanup_minutes) : undefined,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, data: rep });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  try {
    const { reportId } = await params;
    const r = await deleteWorkOrderReport(reportId);
    return NextResponse.json({ success: true, data: r });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
