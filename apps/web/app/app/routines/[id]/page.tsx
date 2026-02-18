"use client";

import { useParams } from "next/navigation";
import { UserRoutineEditorPage } from "../../../../components/UserRoutineEditorPage";

export default function EditRoutinePage() {
  const params = useParams<{ id: string }>();
  return <UserRoutineEditorPage routineId={params.id} />;
}
