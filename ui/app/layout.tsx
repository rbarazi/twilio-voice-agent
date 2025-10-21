import type { Metadata } from "next";
import "./globals.css";
import { UserConfigProvider } from "@/contexts/UserConfigContext";

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
      <body>
        <UserConfigProvider>{children}</UserConfigProvider>
      </body>
    </html>
  );
}
