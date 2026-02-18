import { ReactNode } from "react";
import { ToastProvider } from "../../components/ToastProvider";
import { UnsavedChangesProvider } from "../../components/UnsavedChangesProvider";
import { UserNav } from "../../components/UserNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <UnsavedChangesProvider>
      <ToastProvider>
        <main className="axion-shell">
          <UserNav />
          <div className="axion-content">
            <div className="axion-container">{children}</div>
          </div>
        </main>
      </ToastProvider>
    </UnsavedChangesProvider>
  );
}
