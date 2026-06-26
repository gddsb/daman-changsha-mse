import { NextResponse } from 'next/server';

// Excel 2003 (.xls) 本质是 BIFF8 二进制，需依赖第三方包；
// 为避免引入新依赖，改为 output Excel SpreadsheetML 2003 XML（.xml），
// 这是 Office 2003 原生支持的"XML Spreadsheet"格式，文件名仍为 .xls，
// 双击可在 Excel 2003 及更高版本中直接打开。

const NS = 'urn:schemas-microsoft-com:office:spreadsheet';

const HEADER = ['料号', '产品名称', '规格', '单位', '默认产线'];
const SAMPLE = [
  ['P-DEMO-001', '示例产品A', '200ml/罐', '罐', 'A'],
  ['P-DEMO-002', '示例产品B', '300ml/罐', '罐', 'B'],
];

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colXml(idx: number): string {
  return `<Column ss:Index="${idx}" ss:AutoFitWidth="0" ss:Width="120"/>`;
}

function cellXml(value: string): string {
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function rowXml(values: string[]): string {
  return `<Row>${values.map((v) => cellXml(v)).join('')}</Row>`;
}

function buildXml(): string {
  const data = SAMPLE
    .map((r) => rowXml(r))
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="${NS}"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="宋体" ss:Size="11"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="宋体" ss:Size="11" ss:Bold="1"/>
      <Interior ss:Color="#1F2937" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="产品导入模板">
    <Table>
      <Column ss:Index="1" ss:Width="140"/>
      <Column ss:Index="2" ss:Width="180"/>
      <Column ss:Index="3" ss:Width="120"/>
      <Column ss:Index="4" ss:Width="80"/>
      <Column ss:Index="5" ss:Width="100"/>
      <Row ss:StyleID="Header">
        ${HEADER.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
      </Row>
      ${data}
    </Table>
  </Worksheet>
</Workbook>`;
}

export async function GET() {
  const xml = buildXml();
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': 'attachment; filename="product-import-template.xls"',
    },
  });
}
