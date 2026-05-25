import type { Metadata } from "next";
import { AmplifyConfig } from "./components/AmplifyConfig";
import { ThemeProvider } from "./contexts/ThemeContext";
import { themeInitScript } from "./utils/theme-storage";
import "./globals.css";
import "./app.css";

export const metadata: Metadata = {
  title: "CrewLinkAI™ - AI-Powered Aviation Staffing",
  description:
    "CrewLinkAI by Aviation AI Solutions — find qualified contract pilots with live availability, proximity, and AI-powered qualification matching.",
  manifest: "/manifest.webmanifest",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: "cover",
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#041019" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CrewLinkAI",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AmplifyConfig />
        <ThemeProvider>{children}</ThemeProvider>
        <div id="crewlink-datepicker-portal" />
      </body>
    </html>
  );
}
