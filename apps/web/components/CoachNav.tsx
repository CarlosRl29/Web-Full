"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearTokens } from "../lib/api";
import { useAppAuth } from "../lib/useAppAuth";
import { useLanguage } from "./LanguageProvider";
import { useUnsavedChanges } from "./UnsavedChangesProvider";

const ALL_ITEMS = [
  { href: "/login", label: "Inicio" },
  { href: "/coach/routines", label: "Rutinas" },
  { href: "/coach/assignments", label: "Asignaciones" },
  { href: "/coach", label: "Coach Panel" }
  // AXION v2 minimal: AI, admin sync disabled
  // { href: "/coach/ai-logs", label: "Historial AI", coachOnly: true },
  // { href: "/coach/ai-metrics", label: "Resumen AI", coachOnly: true },
  // { href: "/coach/ai-alerts", label: "Alertas AI", coachOnly: true },
  // { href: "/coach/exercises-sync", label: "Sincronizar ejercicios", adminOnly: true },
  // { href: "/coach/exercises-taxonomy", label: "Clasificar ejercicios", adminOnly: true },
  // { href: "/coach/exercises-translations", label: "Traducciones ejercicios", adminOnly: true }
];

export function CoachNav() {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const { confirmNavigation } = useUnsavedChanges();
  const { me } = useAppAuth();
  const { locale, setLocale } = useLanguage();
  const isCoachOrAdmin = me?.role === "COACH" || me?.role === "ADMIN";
  const isAdmin = me?.role === "ADMIN";
  const items = ALL_ITEMS.filter((item) => {
    if ("adminOnly" in item && item.adminOnly) return isAdmin;
    if ("coachOnly" in item && item.coachOnly) return me && isCoachOrAdmin;
    return true;
  });

  return (
    <header className="axion-topbar">
      <div className="axion-container axion-topbar-inner">
        <div className="axion-logo">AXION</div>
        <nav className="axion-nav">
          {items.map((item) => {
            const isActive =
              safePathname === item.href ||
              (item.href !== "/login" && item.href !== "/coach" && safePathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`axion-nav-link${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => {
                  if (!confirmNavigation()) {
                    event.preventDefault();
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="axion-nav-right">
          <select
            className="axion-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as "es" | "en")}
            aria-label="Idioma"
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>
          <button
            className="axion-button axion-button-secondary"
            onClick={() => {
              if (!confirmNavigation()) {
                return;
              }
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
