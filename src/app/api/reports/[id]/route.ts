import { NextRequest, NextResponse } from "next/server";
import { getReportDetail, closeReport } from "@/lib/mes-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getReportDetail(id);
    if (!data) {
      return NextResponse.json(
        { success: false, error: "报工批次不存在" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("GET /api/reports/[id] error:", e);
    return NextResponse.json(
      { success: false, error: "获取报工详情失败" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.action !== "close") {
      return NextResponse.json(
        { success: false, error: "暂不支持的操作" },
        { status: 400 }
      );
    }
    const data = await closeReport(id, {
      manual: body.manual === true,
      endTime: body.end_time,
      confirmer: body.confirmer,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("PATCH /api/reports/[id] error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "关闭报工失败" },
      { status: 500 }
    );
  }
}
