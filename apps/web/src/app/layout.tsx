import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpsSentinel | Autonomous AI SRE Control Plane",
  description: "Distributed Autonomous Incident Diagnosis & Remediation Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0B0F19] text-slate-200 antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
