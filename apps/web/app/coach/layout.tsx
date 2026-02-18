import { ReactNode } from "react";
import { CoachNav } from "../../components/CoachNav";
import { ToastProvider } from "../../components/ToastProvider";
import { UnsavedChangesProvider } from "../../components/UnsavedChangesProvider";

export default function CoachLayout({ children }: { children: ReactNode }) {
  return (
    <UnsavedChangesProvider>
      <ToastProvider>
        <main className="axion-shell">
          <CoachNav />
          <div className="axion-content">
            <div className="axion-container">{children}</div>
          </div>
        </main>
      </ToastProvider>
    </UnsavedChangesProvider>
  );
}
