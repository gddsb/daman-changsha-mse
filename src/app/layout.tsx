import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Inspector } from 'react-dev-inspector';
import { AppShell } from '@/components/layout/app-shell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: '长沙大满生产管理系统',
    template: '%s | 长沙大满生产管理系统',
  },
  description:
    '长沙大满生产管理系统：制罐行业生产执行系统，集成 U9 ERP，覆盖工单管理、设备管理、质量管理、生产看板。',
  keywords: ['MES', '制罐', '大满', '生产管理', '工单管理', '质量管理', '生产看板', '七天滚动计划'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN" data-theme="mes-dark" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrains.variable} antialiased min-h-screen bg-background text-foreground`}
        style={{
          fontFamily:
            "var(--font-inter), 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, sans-serif",
        }}
      >
        {isDev && <Inspector />}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}