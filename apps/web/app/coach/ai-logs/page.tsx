"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";

type AiLogListItem = {
  id: string;
  user_id: string;
  coach_id: string | null;
  safety_flags: string[];
  model_version: string;
  strategy_version: string;
  created_at: string;
};

type AiLogsListResponse = {
  items: AiLogListItem[];
  next_cursor: string | null;
};

type AiLogDetail = {
  id: string;
  user_id: string;
  coach_id: string | null;
  request_payload: unknown;
  response_payload: unknown;
  safety_flags: string[];
  model_version: string;
  strategy_version: string;
  dedup_hit?: boolean;
  rate_limited?: boolean;
  latency_ms?: number | null;
  created_at: string;
  applied_suggestions?: Array<{
    id: string;
    routine_id: string;
    routine_day_id: string;
    applied_by_user_id: string;
    created_at: string;
  }>;
};

export default function CoachAiLogsPage() {
  const searchParams = useSearchParams();
  const queryLogId = searchParams.get("log_id");
  const { token, loading } = useCoachAuth();
  const [logs, setLogs] = useState<AiLogListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<AiLogDetail | null>(null);
  const [message, setMessage] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [userId, setUserId] = useState("");
  const [safetyFlag, setSafetyFlag] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const queryBase = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "15");
    if (userId.trim()) {
      params.set("user_id", userId.trim());
    }
    if (safetyFlag.trim()) {
      params.set("safety_flag", safetyFlag.trim());
    }
    if (fromDate) {
      params.set("from", `${fromDate}T00:00:00.000Z`);
    }
    if (toDate) {
      params.set("to", `${toDate}T23:59:59.999Z`);
    }
    return params;
  }, [userId, safetyFlag, fromDate, toDate]);

  const loadLogs = async (cursor?: string, append = false) => {
    if (!token) {
      return;
    }
    setLoadingLogs(true);
    setMessage("");
    try {
      const params = new URLSearchParams(queryBase.toString());
      if (cursor) {
        params.set("cursor", cursor);
      }
      const data = await apiRequest<AiLogsListResponse>(`/ai/logs?${params.toString()}`, {}, token);
      setNextCursor(data.next_cursor);
      setLogs((prev) => (append ? [...prev, ...data.items] : data.items));
      if (!append && data.items.length > 0) {
        const defaultId = queryLogId ?? data.items[0].id;
        const detail = await apiRequest<AiLogDetail>(`/ai/logs/${defaultId}`, {}, token);
        setSelected(detail);
      }
      if (!append && data.items.length === 0) {
        setSelected(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadLogs();
  }, [token, queryLogId]);

  if (loading) {
    return <p>Cargando...</p>;
  }

  return (
    <section>
      <h1>Coach • AI Logs</h1>
      {message ? <p>{message}</p> : null}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder="Filtro user_id"
        />
        <input
          value={safetyFlag}
          onChange={(event) => setSafetyFlag(event.target.value)}
          placeholder="safety_flag"
        />
        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        <button onClick={() => void loadLogs(undefined, false)} disabled={loadingLogs}>
          Filtrar
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <h2>Lista</h2>
          {logs.map((item) => (
            <button
              key={item.id}
              onClick={async () => {
                if (!token) {
                  return;
                }
                const detail = await apiRequest<AiLogDetail>(`/ai/logs/${item.id}`, {}, token);
                setSelected(detail);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                marginBottom: 8,
                border: "1px solid #eee",
                background: "#fff",
                padding: 8,
                cursor: "pointer"
              }}
            >
              <strong>{item.id}</strong>
              <div>
                user: {item.user_id} • {new Date(item.created_at).toLocaleString()}
              </div>
              <div>flags: {item.safety_flags.join(", ") || "-"}</div>
            </button>
          ))}
          {nextCursor ? (
            <button onClick={() => void loadLogs(nextCursor, true)} disabled={loadingLogs}>
              Cargar mas
            </button>
          ) : null}
        </div>

        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <h2>Detalle</h2>
          {selected ? (
            <>
              <p>
                <strong>{selected.id}</strong>
              </p>
              <p>
                user: {selected.user_id} • model: {selected.model_version} • strategy:{" "}
                {selected.strategy_version}
              </p>
              <p>
                dedup: {selected.dedup_hit ? "si" : "no"} • rate_limited:{" "}
                {selected.rate_limited ? "si" : "no"} • latency_ms: {selected.latency_ms ?? "-"}
              </p>
              {selected.applied_suggestions && selected.applied_suggestions.length > 0 ? (
                <div>
                  <h3>Aplicada en</h3>
                  {selected.applied_suggestions.map((item) => (
                    <p key={item.id}>
                      routine: {item.routine_id} • day: {item.routine_day_id} •{" "}
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  ))}
                </div>
              ) : (
                <p>No hay trazas de aplicacion para este log.</p>
              )}
              <h3>request_payload</h3>
              <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
                {JSON.stringify(selected.request_payload, null, 2)}
              </pre>
              <h3>response_payload</h3>
              <pre style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
                {JSON.stringify(selected.response_payload, null, 2)}
              </pre>
            </>
          ) : (
            <p>Selecciona un log para ver detalle.</p>
          )}
        </div>
      </div>
    </section>
  );
}
