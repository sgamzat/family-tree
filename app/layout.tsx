import { Manrope } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { Header } from "@/components/header";
import "./globals.css";

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Древо села",
  description: "Общее семейное древо села: люди, родители, супруги и дети",
};

export const viewport: Viewport = {
  themeColor: "#f4efe6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Header />
        <main className="mx-auto w-full max-w-2xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
