import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HEY YOU! COMPANION — Personal Accountability & Voice System",
  description:
    "A personal space to shape your commitments, build your companion, and hear the reminders that keep you moving.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
