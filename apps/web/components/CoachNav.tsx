"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearTokens } from "../lib/api";

export function CoachNav() {
  const pathname = usePathname();
  const items = [
    { href: "/login", label: "Inicio" },
    { href: "/coach/routines", label: "Rutinas" },
    { href: "/coach", label: "Coach Panel" },
    { href: "/coach/ai-logs", label: "AI Logs" },
    { href: "/coach/ai-metrics", label: "AI Metrics" },
    { href: "/coach/ai-alerts", label: "Alerts" }
  ];

  return (
    <header className="axion-topbar">
      <div className="axion-container axion-topbar-inner">
        <div className="axion-logo">AXION</div>
        <nav className="axion-nav">
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/login" && item.href !== "/coach" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`axion-nav-link${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="axion-nav-right">
          <select className="axion-select" defaultValue="es" aria-label="Idioma">
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
          <button
            className="axion-button axion-button-secondary"
            onClick={() => {
              clearTokens();
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
