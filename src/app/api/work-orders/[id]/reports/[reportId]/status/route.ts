import { NextRequest, NextResponse } from "next/server";
import { closeWorkOrderReport, reopenWorkOrderReport } from "@/lib/mes-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> },
) {
  try {
    const { reportId } = await params;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "close");
    if (action === "reopen") {
      const data = await reopenWorkOrderReport(reportId);
      return NextResponse.json({ success: true, data });
    }
    // 默认 close
    const data = await closeWorkOrderReport(reportId);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
