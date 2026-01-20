import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { CookieConsent } from "@/components/CookieConsent";
import { SkipLink } from "@/components/SkipLink";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CanvasCast - Turn Your Passion Into Videos",
  description:
    "Transform your notes and ideas into professional YouTube-ready videos with AI-powered narration, visuals, and captions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SkipLink />
        <AuthProvider>
          <PostHogProvider>
            {children}
            <CookieConsent />
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
