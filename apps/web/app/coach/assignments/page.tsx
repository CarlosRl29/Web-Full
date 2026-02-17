"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { useCoachAuth } from "../../../lib/useCoachAuth";

export default function CoachAssignmentsPage() {
  const { token, loading } = useCoachAuth();
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [routines, setRoutines] = useState<Array<{ id: string; name: string }>>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoutineId, setAssignRoutineId] = useState("");
  const [coachNotes, setCoachNotes] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async (accessToken: string) => {
    const [userData, routineData, assignmentData] = await Promise.all([
      apiRequest<Array<{ id: string; full_name: string; email: string }>>(
        "/coach/users",
        {},
        accessToken
      ),
      apiRequest<Array<{ id: string; name: string }>>("/routines", {}, accessToken),
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
    void loadData(token);
  }, [token]);

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
      await loadData(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo asignar rutina");
    }
  };

  if (loading) {
    return <p>Cargando...</p>;
  }

  return (
    <section style={{ marginTop: 20, border: "1px solid #ddd", padding: 16 }}>
      <h1>Coach • Asignaciones</h1>
      {message ? <p>{message}</p> : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
          <option value="">Seleccionar usuario</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name} ({user.email})
            </option>
          ))}
        </select>
        <select value={assignRoutineId} onChange={(e) => setAssignRoutineId(e.target.value)}>
          <option value="">Seleccionar rutina</option>
          {routines.map((routine) => (
            <option key={routine.id} value={routine.id}>
              {routine.name}
            </option>
          ))}
        </select>
        <input
          value={coachNotes}
          onChange={(e) => setCoachNotes(e.target.value)}
          placeholder="Coach notes"
        />
        <button onClick={() => void assignRoutine()}>Asignar</button>
      </div>

      <h3>Clientes y asignaciones</h3>
      <ul>
        {assignments.map((assignment) => (
          <li key={assignment.id}>
            {assignment.user?.full_name ?? assignment.user_name} -{" "}
            {assignment.routine?.name ?? assignment.routine_name} (
            {assignment.is_active ? "activa" : "inactiva"})
          </li>
        ))}
      </ul>
    </section>
  );
}
