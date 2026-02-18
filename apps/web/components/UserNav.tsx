"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearTokens } from "../lib/api";
import { useUnsavedChanges } from "./UnsavedChangesProvider";
import { useAppAuth } from "../lib/useAppAuth";

export function UserNav() {
  const pathname = usePathname();
  const { confirmNavigation } = useUnsavedChanges();
  const { me } = useAppAuth();
  const items = [
    { href: "/app", label: "Inicio" },
    { href: "/app/routines", label: "Mis rutinas" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/app/profile", label: "Perfil" }
  ];

  return (
    <header className="axion-topbar">
      <div className="axion-container axion-topbar-inner">
        <div className="axion-logo">AXION</div>
        <nav className="axion-nav">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
          {me?.role && (me.role === "COACH" || me.role === "ADMIN") ? (
            <Link className="axion-button axion-button-secondary" href="/coach/routines">
              Modo coach
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
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
