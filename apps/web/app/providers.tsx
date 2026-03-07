"use client";

import { ReactNode } from "react";
import { LanguageProvider } from "../components/LanguageProvider";
import { ToastProvider } from "../components/ToastProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <ToastProvider>{children}</ToastProvider>
    </LanguageProvider>
  );
}
