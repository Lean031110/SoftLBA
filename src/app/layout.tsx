import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "SoftLBA - Sistema de Restaurante",
  description: "SoftLBA - Sistema integral de gestión para restaurante en red local",
  keywords: ["SoftLBA", "restaurante", "Cuba", "POS", "pedidos", "cocina", "inventario"],
  authors: [{ name: "SoftLBA" }],
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
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
