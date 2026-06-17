import { NextResponse } from "next/server";
import { listReportSummaries } from "@/lib/mes-service";

export const dynamic = "force-dynamic";

/**
 * 报工管理（顶层菜单）数据接口
 * 列出所有有过报工的工单 + 每条工单下的工单报工 + 工序报工
 */
export async function GET() {
  try {
    const data = await listReportSummaries();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询报工汇总失败";
    const detail = err instanceof Error
      ? `${err.message}\n${err.stack ?? ""}`
      : JSON.stringify(err);
    // eslint-disable-next-line no-console
    console.error("[reports] 500:", detail);
    return NextResponse.json(
      { success: false, error: message, debug: detail },
      { status: 500 }
    );
  }
}
