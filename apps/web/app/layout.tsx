import React, { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "../components/ToastProvider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
