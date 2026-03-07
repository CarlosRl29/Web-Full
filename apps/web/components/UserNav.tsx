"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearTokens } from "../lib/api";
import { useAppAuth } from "../lib/useAppAuth";
import { useLanguage } from "./LanguageProvider";
import { useUnsavedChanges } from "./UnsavedChangesProvider";

export function UserNav() {
  const pathname = usePathname();
  const safePathname = pathname ?? "";
  const { confirmNavigation } = useUnsavedChanges();
  const { me } = useAppAuth();
  const { t, locale, setLocale } = useLanguage();
  const items = [
    { href: "/app", label: t("nav.inicio") },
    { href: "/app/routines", label: t("nav.mis_rutinas") },
    { href: "/app/exercises", label: t("nav.ejercicios") },
    // AXION v2 minimal: progress, marketplace disabled
    // { href: "/app/progress", label: t("nav.progreso") },
    // { href: "/marketplace", label: t("nav.marketplace") },
    { href: "/app/profile", label: t("nav.perfil") }
  ];

  return (
    <header className="axion-topbar">
      <div className="axion-container axion-topbar-inner">
        <div className="axion-logo">AXION</div>
        <nav className="axion-nav">
          {items.map((item) => {
            const isActive =
              safePathname === item.href || safePathname.startsWith(`${item.href}/`);
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
          {me?.role && (me.role === "COACH" || me.role === "ADMIN") ? (
            <Link className="axion-button axion-button-secondary" href="/coach/routines">
              {t("nav.modo_coach")}
            </Link>
          ) : null}
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
            {t("nav.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
