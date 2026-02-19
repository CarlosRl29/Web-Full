import { Suspense } from "react";
import AiLogsClient from "./AiLogsClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="axion-loading">Cargando…</div>}>
      <AiLogsClient />
    </Suspense>
  );
}
