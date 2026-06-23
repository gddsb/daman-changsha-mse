import { NextRequest, NextResponse } from "next/server";
import { addDowntime, deleteDowntime } from "@/lib/mes-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body.anomaly_type || !body.start_time || !body.end_time) {
      return NextResponse.json(
        { success: false, error: "缺少必填参数 anomaly_type / start_time / end_time" },
        { status: 400 }
      );
    }
    const data = await addDowntime({
      work_order_report_id: id,
      anomaly_type: body.anomaly_type,
      equipment_code: body.equipment_code,
      downtime_type: body.downtime_type,
      problem_description: body.problem_description,
      start_time: body.start_time,
      end_time: body.end_time,
      confirmer: body.confirmer,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("POST /api/reports/[id]/downtimes error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "新增异常工时失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dtId = searchParams.get("downtime_id");
    if (!dtId) {
      return NextResponse.json(
        { success: false, error: "缺少参数 downtime_id" },
        { status: 400 }
      );
    }
    await deleteDowntime(dtId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/reports/[id]/downtimes error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "删除异常工时失败" },
      { status: 500 }
    );
  }
}
