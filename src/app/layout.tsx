import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { ActivityLog } from "@/components/shared/ActivityLog";
import { PatentPreviewProvider } from "@/lib/patent-preview-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IP Radar — 自动驾驶专利情报分析平台",
  description: "面向自动驾驶研发场景的专利情报分析工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex">
        <PatentPreviewProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col ml-56">
            <Header />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
          <ActivityLog />
        </PatentPreviewProvider>
      </body>
    </html>
  );
}
