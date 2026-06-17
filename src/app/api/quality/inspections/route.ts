import { NextRequest, NextResponse } from 'next/server';
import {
  listQualityInspections,
  createQualityInspection,
  listDefectCodes,
} from '@/lib/mes-service';
import { generateInspectionNo } from '@/lib/format';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const inspections = await listQualityInspections({
      result: sp.get('result') ?? undefined,
      inspectionType: sp.get('inspectionType') ?? undefined,
      search: sp.get('search') ?? undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });
    const defectCodes = await listDefectCodes();
    return NextResponse.json({ success: true, data: { inspections, defectCodes } });
  } catch (e) {
    const message = e instanceof Error ? e.message : '查询检验记录失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const seq = Math.floor(Math.random() * 900) + 100;
    const inspection_no = body.inspection_no || generateInspectionNo(seq);
    const created = await createQualityInspection({ ...body, inspection_no });
    return NextResponse.json({ success: true, data: created });
  } catch (e) {
    const message = e instanceof Error ? e.message : '创建检验记录失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
