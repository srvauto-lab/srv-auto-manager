import type { Metadata } from "next";
import "./globals.css";
import AppLayout from "@/components/AppLayout";

export const metadata: Metadata = {
  title: "SRV AUTO Manager",
  description: "CRM для управления автосервисом SRV AUTO",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full bg-zinc-950 font-sans text-white antialiased">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}