"use client";

import { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function RoutineDrawer({ open, onClose, children }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="axion-builder-drawer-overlay" onClick={onClose}>
      <section
        className="axion-builder-drawer"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button className="axion-button axion-button-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
