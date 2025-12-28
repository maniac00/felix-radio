import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// import { ClerkProvider } from "@clerk/nextjs"; // Temporarily disabled for demo
import { ApiAuthProvider } from "@/components/providers/api-auth-provider";
import { Toaster } from "@/components/ui/sonner";
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
  title: "Felix Radio - Radio Recording & STT Service",
  description: "Automatically record radio broadcasts and convert to text with OpenAI Whisper",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ApiAuthProvider>
          {children}
        </ApiAuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
