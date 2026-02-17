import { ReactNode } from "react";
import { CoachNav } from "../../components/CoachNav";

export default function CoachLayout({ children }: { children: ReactNode }) {
  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <CoachNav />
      {children}
    </main>
  );
}
