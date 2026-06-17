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
    default: '机加工 MES 生产管控台',
    template: '%s | 机加工 MES',
  },
  description:
    '机加工行业生产执行系统，集成 U9 ERP，覆盖工单管理、设备管理、质量管理、生产看板。',
  keywords: ['MES', '机加工', '生产管控', '工单管理', '设备管理', '质量管理', '生产看板'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
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
