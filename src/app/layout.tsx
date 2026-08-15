import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/ui/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f3f4f6", // يتطابق مع لون خلفية التطبيق لشريط الحالة (Status Bar)
};

export const metadata: Metadata = {
  title: "Personal Finance",
  description: "Safe-to-Spend Daily Tracker",
  manifest: "/manifest.json", // تمت إضافة هذا السطر
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finance",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen-safe bg-gray-100 text-gray-900 pb-24`}>
        <main className="max-w-md mx-auto min-h-screen-safe relative shadow-sm bg-gray-50">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}