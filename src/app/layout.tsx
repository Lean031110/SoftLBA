import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "El Sabor Cubano - Sistema de Restaurante",
  description: "Sistema integral de gestión para restaurante en red local",
  keywords: ["restaurante", "Cuba", "POS", "pedidos", "cocina", "inventario"],
  authors: [{ name: "El Sabor Cubano" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "El Sabor Cubano",
    description: "Sistema integral de gestión para restaurante en red local",
    siteName: "El Sabor Cubano",
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
