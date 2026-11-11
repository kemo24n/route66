import type { Metadata, Viewport } from "next";
import "@fontsource/readex-pro/arabic-300.css";
import "@fontsource/readex-pro/arabic-400.css";
import "@fontsource/readex-pro/arabic-500.css";
import "@fontsource/readex-pro/arabic-600.css";
import "@fontsource/readex-pro/arabic-700.css";
import "@fontsource/readex-pro/latin-400.css";
import "@fontsource/readex-pro/latin-600.css";
import "@fontsource/lalezar/arabic-400.css";
import "@fontsource/lalezar/latin-400.css";
import "@fontsource/overpass/600.css";
import "@fontsource/overpass/800.css";
import "@fontsource/overpass/900.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Route 66 | روت ٦٦ · حلب",
  description: "روت ٦٦، كافيه ومطعم بالموكامبو. شوف المنيو، اختار طاولتك من خريطة المحل واحجز.",
  icons: { icon: "/img/logo.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0E4A23" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
