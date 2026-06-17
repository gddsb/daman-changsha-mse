import { NextResponse } from 'next/server';

const HEADER = '料号,产品名称,规格,单位,默认产线';
const SAMPLE = [
  ['P-DEMO-001', '示例产品A', '200ml/罐', '罐', 'A'],
  ['P-DEMO-002', '示例产品B', '300ml/罐', '罐', 'B'],
];

function toCsv(): string {
  const lines = [HEADER];
  for (const r of SAMPLE) lines.push(r.join(','));
  return '﻿' + lines.join('\r\n');
}

export async function GET() {
  const csv = toCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="product-import-template.csv"',
    },
  });
}
