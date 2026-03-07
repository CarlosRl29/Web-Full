"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const tabs = [
  { href: "/app/progress", label: "Resumen" },
  { href: "/app/progress/plan", label: "Plan" },
  { href: "/app/progress/body", label: "Cuerpo" }
];

export default function ProgressLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <section className="axion-page">
      <div className="progress-tabs">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== "/app/progress" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`progress-tab${isActive ? " is-active" : ""}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </section>
  );
}
