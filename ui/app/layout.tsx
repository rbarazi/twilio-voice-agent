import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Twilio Voice Agent",
  description: "AI-powered voice agent system using Twilio and OpenAI Realtime API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
