import { NextRequest, NextResponse } from "next/server";
import { addOpDefect, deleteOpDefect } from "@/lib/mes-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.operation_report_id) {
      return NextResponse.json(
        { success: false, error: "缺少必填参数 operation_report_id" },
        { status: 400 }
      );
    }
    if (!body.defect_category || !body.defect_name) {
      return NextResponse.json(
        { success: false, error: "缺少必填参数 defect_category / defect_name" },
        { status: 400 }
      );
    }
    const data = await addOpDefect({
      operation_report_id: body.operation_report_id,
      defect_category: body.defect_category,
      defect_name: body.defect_name,
      defect_quantity: body.defect_quantity ?? 0,
      unit: body.unit ?? null,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("POST /api/reports/[id]/defects error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "新增不良失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const defectId = searchParams.get("defect_id");
    if (!defectId) {
      return NextResponse.json(
        { success: false, error: "缺少参数 defect_id" },
        { status: 400 }
      );
    }
    await deleteOpDefect(defectId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/reports/[id]/defects error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "删除不良失败" },
      { status: 500 }
    );
  }
}
