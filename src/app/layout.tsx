import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appearanceBoot = `(function(){try{var t=localStorage.getItem("ai-fitness-appearance");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-aura-theme",d?"dark":"light")}catch(e){document.documentElement.setAttribute("data-aura-theme","light")}})();`;
export const metadata: Metadata = {
  title: "AI Fitness",
  description: "AI-powered food tracking and nutrition insights.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><script dangerouslySetInnerHTML={{ __html: appearanceBoot }} /><AppShell>{children}</AppShell></body>
    </html>
  );
}
