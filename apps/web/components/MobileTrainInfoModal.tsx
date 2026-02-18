"use client";

import { useState } from "react";
import { useToast } from "./ToastProvider";

type Props = {
  open: boolean;
  onClose: () => void;
};

const REMINDER_TEXT =
  "Entrena desde la app AXION: abre la app en tu celular, ve a Entrenamiento y presiona Comenzar o Reanudar.";

export function MobileTrainInfoModal({ open, onClose }: Props) {
  const { showToast } = useToast();
  const [copying, setCopying] = useState(false);

  if (!open) {
    return null;
  }

  const copyReminder = async () => {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(REMINDER_TEXT);
      showToast("success", "Recordatorio copiado.");
    } catch {
      showToast("error", "No se pudo copiar el recordatorio.");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="axion-modal-overlay" role="dialog" aria-modal="true">
      <section className="axion-card axion-modal-card">
        <h2>Entrena desde la app AXION</h2>
        <p className="axion-muted" style={{ marginTop: 8 }}>
          La web es para organizar tus rutinas. En el gym usa la app para registrar sets,
          descansos y modo guiado.
        </p>
        <ol className="axion-modal-steps">
          <li>Abre AXION en tu celular.</li>
          <li>Ve a “Entrenamiento”.</li>
          <li>Presiona “Comenzar” o “Reanudar”.</li>
        </ol>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button
            className="axion-button axion-button-secondary"
            onClick={() => void copyReminder()}
            disabled={copying}
          >
            {copying ? "Copiando..." : "Copiar recordatorio"}
          </button>
          <button className="axion-button axion-button-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </section>
    </div>
  );
}
