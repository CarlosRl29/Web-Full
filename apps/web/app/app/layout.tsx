import { ReactNode } from "react";
import { UnsavedChangesProvider } from "../../components/UnsavedChangesProvider";
import { UserNav } from "../../components/UserNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <UnsavedChangesProvider>
      <main className="axion-shell">
        <UserNav />
        <div className="axion-content">
          <div className="axion-container">{children}</div>
        </div>
      </main>
    </UnsavedChangesProvider>
  );
}
