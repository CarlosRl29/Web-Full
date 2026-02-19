"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";
import { useToast } from "../../../components/ToastProvider";

export default function CoachAssignmentsPage() {
  const { token, loading } = useCoachAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [routines, setRoutines] = useState<Array<{ id: string; name: string }>>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoutineId, setAssignRoutineId] = useState("");
  const [coachNotes, setCoachNotes] = useState("");
  const [message, setMessage] = useState("");
  const [updatingAssignmentId, setUpdatingAssignmentId] = useState<string | null>(null);

  const loadData = async (accessToken: string, search = "") => {
    const searchQuery = search.trim()
      ? `/coach/users?search=${encodeURIComponent(search.trim())}`
      : "/coach/users";
    const [userData, routineData, assignmentData] = await Promise.all([
      apiRequest<Array<{ id: string; full_name: string; email: string }>>(
        searchQuery,
        {},
        accessToken
      ),
      apiRequest<Array<{ id: string; name: string }>>("/routines/owned", {}, accessToken),
      apiRequest<any[]>("/coach/clients", {}, accessToken)
    ]);
    setUsers(userData);
    setRoutines(routineData);
    setAssignments(assignmentData);
    if (!assignRoutineId && routineData[0]) {
      setAssignRoutineId(routineData[0].id);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadData(token, userSearch);
  }, [token, userSearch]);

  const assignRoutine = async () => {
    if (!token || !assignUserId || !assignRoutineId) {
      return;
    }
    try {
      await apiRequest("/coach/assignments", {
        method: "POST",
        body: JSON.stringify({
          user_id: assignUserId,
          routine_id: assignRoutineId,
          is_active: true,
          coach_notes: coachNotes || undefined
        })
      }, token);
      setCoachNotes("");
      setMessage("Rutina asignada.");
      showToast("success", "Asignacion creada correctamente.");
      await loadData(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo asignar rutina");
      showToast("error", "No se pudo crear la asignacion.");
    }
  };

  const updateAssignmentState = async (assignmentId: string, isActive: boolean) => {
    if (!token) {
      return;
    }
    setUpdatingAssignmentId(assignmentId);
    try {
      await apiRequest(
        `/coach/assignments/${assignmentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_active: isActive })
        },
        token
      );
      showToast("success", isActive ? "Asignación activada." : "Asignación desactivada.");
      await loadData(token, userSearch);
    } catch (error) {
      const text = error instanceof Error ? error.message : "No se pudo actualizar la asignación";
      setMessage(text);
      showToast("error", text);
    } finally {
      setUpdatingAssignmentId(null);
    }
  };

  if (loading) {
    return <p className="axion-loading">Cargando asignaciones...</p>;
  }

  return (
    <section className="axion-page">
      <section className="axion-hero">
        <h1>Asignaciones</h1>
        <p>Asigna rutinas activas a clientes y centraliza el seguimiento desde el panel de coach.</p>
      </section>
      <section className="axion-card">
      <h1>Coach • Asignaciones</h1>
      {message ? <p className="axion-muted">{message}</p> : null}

      <div style={{ display: "grid", gap: 10 }}>
        <input
          className="axion-input"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="Buscar cliente por nombre o email"
        />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <select className="axion-select" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
          <option value="">Seleccionar usuario</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name} ({user.email})
            </option>
          ))}
        </select>
        <select className="axion-select" value={assignRoutineId} onChange={(e) => setAssignRoutineId(e.target.value)}>
          <option value="">Seleccionar rutina</option>
          {routines.map((routine) => (
            <option key={routine.id} value={routine.id}>
              {routine.name}
            </option>
          ))}
        </select>
        <input
          className="axion-input"
          value={coachNotes}
          onChange={(e) => setCoachNotes(e.target.value)}
          placeholder="Notas para el cliente"
        />
        <button className="axion-button axion-button-primary" onClick={() => void assignRoutine()}>Asignar</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Clientes y asignaciones</h3>
      {assignments.length === 0 ? (
        <div className="axion-empty">
          <strong>Aún no hay asignaciones</strong>
          <p>Asigna una rutina para comenzar a gestionar clientes.</p>
          <div style={{ marginTop: 16 }}>
            <button
              className="axion-button axion-button-primary"
              onClick={() => {
                setMessage("Selecciona cliente y rutina para asignar.");
                showToast("info", "Selecciona cliente y rutina.");
              }}
            >
              Asignar rutina
            </button>
          </div>
        </div>
      ) : (
        <div className="axion-table-wrap">
          <table className="axion-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Rutina</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.user?.full_name ?? assignment.user_name}</td>
                  <td>{assignment.routine?.name ?? assignment.routine_name}</td>
                  <td>{assignment.is_active ? "activa" : "inactiva"}</td>
                  <td>
                    <button
                      className="axion-button axion-button-secondary"
                      disabled={updatingAssignmentId === assignment.id}
                      onClick={() =>
                        void updateAssignmentState(assignment.id, !assignment.is_active)
                      }
                    >
                      {assignment.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>
    </section>
  );
}
