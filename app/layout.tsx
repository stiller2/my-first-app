import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "DRIFT — Guhan's white noise website",
    description: "Guhan's interactive white noise website. Leave a signal, hear it bloom, and watch it drift.",
    openGraph: {
      title: "DRIFT",
      description: "A quiet place to make some noise.",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "DRIFT — A quiet place to make some noise." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "DRIFT",
      description: "A quiet place to make some noise.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
