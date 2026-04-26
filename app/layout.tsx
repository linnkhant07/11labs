import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Chelsea_Market,
  Grandstander,
  Nunito,
  ABeeZee,
} from "next/font/google";
import { Providers } from "./components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const chelseaMarket = Chelsea_Market({
  variable: "--font-chelsea-market",
  subsets: ["latin"],
  weight: "400",
});

const grandstander = Grandstander({
  variable: "--font-grandstander",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const abeezee = ABeeZee({
  variable: "--font-abeezee",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "QueStory",
  description: "AI-powered interactive educational storybook for kids with ADHD",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${chelseaMarket.variable} ${grandstander.variable} ${nunito.variable} ${abeezee.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
