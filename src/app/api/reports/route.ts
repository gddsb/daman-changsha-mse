import { NextRequest, NextResponse } from "next/server";
import { listReports, createReport } from "@/lib/mes-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get("work_order_id") ?? undefined;
    const workOrderNo = searchParams.get("work_order_no") ?? undefined;
    const data = await listReports({ workOrderId, workOrderNo });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("GET /api/reports error:", e);
    return NextResponse.json(
      { success: false, error: "获取报工列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.work_order_id || !body.batch_no || !body.start_time) {
      return NextResponse.json(
        { success: false, error: "缺少必填参数 work_order_id / batch_no / start_time" },
        { status: 400 }
      );
    }
    if (!/^[A-Za-z0-9_-]+$/.test(body.batch_no)) {
      return NextResponse.json(
        { success: false, error: "生产批号不允许输入汉字、通配符、特殊字符" },
        { status: 400 }
      );
    }
    const data = await createReport({
      work_order_id: body.work_order_id,
      batch_no: body.batch_no,
      start_time: body.start_time,
      skilled_worker_count: body.skilled_worker_count ?? 0,
      regular_worker_count: body.regular_worker_count ?? 0,
      contract_worker_count: body.contract_worker_count ?? 0,
      other_worker_count: body.other_worker_count ?? 0,
    });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("POST /api/reports error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "创建报工失败" },
      { status: 500 }
    );
  }
}
