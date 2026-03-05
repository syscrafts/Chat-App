import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import Navbar from "@/components/layout/navbar";
import { NotificationCountProvider } from "@/hooks/use-notification-count";
import { E2EProvider } from "@/hooks/use-e2e";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chat App",
  description: "A realtime chat and threads application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <NotificationCountProvider>
            <E2EProvider>
              <div className="flex min-h-screen flex-col bg-background text-foreground">
                <Navbar />
                <main className="flex flex-1 flex-col">
                  <div className="mx-auto flex w-full max-w-6xl  flex-1 flex-col px-4 py-8 md:py-10">
                    {children}
                  </div>
                </main>
              </div>
              <Toaster />
            </E2EProvider>
          </NotificationCountProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
