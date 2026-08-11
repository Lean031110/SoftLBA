import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export const metadata: Metadata = {
  title: "SoftLBA - Sistema de Restaurante",
  description: "SoftLBA - Sistema integral de gestión para restaurante en red local",
  keywords: ["SoftLBA", "restaurante", "Cuba", "POS", "pedidos", "cocina", "inventario"],
  authors: [{ name: "SoftLBA" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/softlba-logo.svg",
    shortcut: "/softlba-favicon.png",
    apple: "/softlba-logo.png",
  },
  openGraph: {
    title: "SoftLBA",
    description: "Sistema integral de gestión para restaurante en red local",
    siteName: "SoftLBA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/softlba-logo.svg" />
        <link rel="apple-touch-icon" href="/softlba-logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#0f172a" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SoftLBA" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="SoftLBA" />
        <meta name="color-scheme" content="dark light" />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-right" />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
