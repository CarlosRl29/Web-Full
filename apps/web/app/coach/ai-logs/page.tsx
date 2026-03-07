import { Suspense } from "react";
import { CoachOnlyGuard } from "../../../components/CoachOnlyGuard";
import AiLogsClient from "./AiLogsClient";

export default function Page() {
  return (
    <CoachOnlyGuard>
      <Suspense fallback={<div className="axion-loading">Cargando…</div>}>
        <AiLogsClient />
      </Suspense>
    </CoachOnlyGuard>
  );
}
