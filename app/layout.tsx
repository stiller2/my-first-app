import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#12110f",
  colorScheme: "dark",
};

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    applicationName: "DRIFT",
    creator: "Guhan",
    category: "productivity",
    title: "DRIFT — Guhan's focus and white noise space",
    description: "A quiet space for meditation, white noise, and 20 or 60 minute focus voyages.",
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    openGraph: {
      title: "DRIFT",
      description: "A quiet orbit for meditation, white noise, and deep focus.",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "DRIFT — A quiet orbit for meditation and focus." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "DRIFT",
      description: "A quiet orbit for meditation, white noise, and deep focus.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
