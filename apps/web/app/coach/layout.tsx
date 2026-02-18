import { ReactNode } from "react";
import { CoachNav } from "../../components/CoachNav";

export default function CoachLayout({ children }: { children: ReactNode }) {
  return (
    <main className="axion-shell">
      <CoachNav />
      <div className="axion-content">
        <div className="axion-container">{children}</div>
      </div>
    </main>
  );
}
