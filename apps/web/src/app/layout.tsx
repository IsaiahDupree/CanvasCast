import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { PostHogProvider } from "@/providers/PostHogProvider";
import { MetaPixelProvider } from "@/providers/MetaPixelProvider";
import { CookieConsent } from "@/components/CookieConsent";
import { SkipLink } from "@/components/SkipLink";
import { PageViewTracker } from "@/components/PageViewTracker";

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
            <MetaPixelProvider>
              <PageViewTracker />
              {children}
              <CookieConsent />
            </MetaPixelProvider>
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
