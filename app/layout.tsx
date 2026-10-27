import { Lora, Manrope } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { Header } from "@/components/header";
import "./globals.css";

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-manrope",
});

const lora = Lora({
  subsets: ["cyrillic", "latin"],
  weight: ["500", "600"],
  variable: "--font-lora",
});

export const metadata: Metadata = {
  title: "Древо села",
  description: "Общее семейное древо села: люди, родители, супруги и дети",
};

export const viewport: Viewport = {
  themeColor: "#f4efe6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${manrope.variable} ${lora.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="page-main">{children}</main>
      </body>
    </html>
  );
}
