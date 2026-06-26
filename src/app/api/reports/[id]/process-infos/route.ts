import { NextRequest, NextResponse } from "next/server";
import { addProcessInfo, deleteProcessInfo } from "@/lib/mes-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.operation_seq == null) {
      return NextResponse.json(
        { success: false, error: "缺少必填参数 operation_seq" },
        { status: 400 }
      );
    }
    const data = await addProcessInfo({
      work_order_report_id: id,
      operation_seq: body.operation_seq,
      operation_name: body.operation_name,
      material_batch_no: body.material_batch_no,
      material_type: body.material_type,
      quantity: body.quantity ?? 0,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("POST /api/reports/[id]/process-infos error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "新增制程信息失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const piId = searchParams.get("process_info_id");
    if (!piId) {
      return NextResponse.json(
        { success: false, error: "缺少必填参数 process_info_id" },
        { status: 400 }
      );
    }
    await deleteProcessInfo(piId);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (e) {
    console.error("DELETE /api/reports/[id]/process-infos error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "删除制程信息失败" },
      { status: 500 }
    );
  }
}
