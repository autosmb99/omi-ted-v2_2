import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OMI-TED v2",
  description: "Telugu Christian theology translation engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <header className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight">OMI-TED v2</span>
            <span className="text-xs text-gray-400 font-mono">Telugu · Christian · Theology</span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
