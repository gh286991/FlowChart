import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./tailwind.css";
import "./globals.css";
import "./mobile.scss";
import "./node-ai-floating.scss";

export const metadata: Metadata = {
  title: "FlowChart Mind Map",
  description: "可由網頁與 MCP 共同編輯的自動排列心智圖",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
