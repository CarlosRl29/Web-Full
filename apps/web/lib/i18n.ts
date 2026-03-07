export type Locale = "es" | "en";

const STORAGE_KEY = "axion-locale";

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "es";
  const v = localStorage.getItem(STORAGE_KEY) as Locale | null;
  return v === "en" ? "en" : "es";
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, locale);
}

export const dict: Record<Locale, Record<string, string>> = {
  es: {
    "nav.inicio": "Inicio",
    "nav.mis_rutinas": "Mis rutinas",
    "nav.ejercicios": "Ejercicios",
    "nav.progreso": "Progreso",
    "nav.marketplace": "Marketplace",
    "nav.perfil": "Perfil",
    "nav.modo_coach": "Modo coach",
    "nav.logout": "Logout",
    "nav.crear_rutina": "Crear rutina",
    "nav.explorar_marketplace": "Explorar marketplace",
    "btn.crear_rutina": "Crear rutina",
    "btn.activa": "Activa",
    "btn.activar": "Activar",
    "btn.editar": "Editar",
    "btn.entrenar": "Entrenar",
    "btn.publicar": "Publicar",
    "btn.retirar": "Retirar",
    "empty.sin_rutinas": "Aún no tienes rutinas propias",
    "empty.crear_o_guardar": "Crea una rutina o guarda una desde marketplace para comenzar.",
    "empty.sin_asignadas": "No tienes rutinas asignadas",
    "empty.guia_asignadas": "Cuando un coach te asigne una rutina aparecerá aquí en modo solo lectura.",
    "library.title": "Biblioteca de ejercicios",
    "library.search": "Buscar ejercicio...",
    "library.muscle_all": "Músculo (todos)",
    "library.submuscle_all": "Submúsculo (todos)",
    "library.type_all": "Tipo (todos)",
    "library.found": "ejercicios encontrados",
    "library.add": "+ Agregar",
    "library.loading": "Cargando ejercicios...",
    "library.no_results": "No hay resultados",
    "library.try_filters": "Prueba otro término o ajusta los filtros.",
    "library.search_to_start": "Busca o filtra para cargar ejercicios",
    "library.search_to_start_hint": "Escribe en el buscador o elige músculo, submúsculo o tipo de equipo.",
    "library.primary": "Principal",
    "library.sub": "Sub",
    "library.secondary": "Secundarios",
    "technique.understood": "Entendido",
    "technique.no_media": "Sin media disponible",
    "technique.no_instructions": "No hay técnica detallada para este ejercicio todavía."
  },
  en: {
    "nav.inicio": "Home",
    "nav.mis_rutinas": "My routines",
    "nav.ejercicios": "Exercises",
    "nav.progreso": "Progress",
    "nav.marketplace": "Marketplace",
    "nav.perfil": "Profile",
    "nav.modo_coach": "Coach mode",
    "nav.logout": "Logout",
    "nav.crear_rutina": "Create routine",
    "nav.explorar_marketplace": "Explore marketplace",
    "btn.crear_rutina": "Create routine",
    "btn.activa": "Active",
    "btn.activar": "Set active",
    "btn.editar": "Edit",
    "btn.entrenar": "Train",
    "btn.publicar": "Publish",
    "btn.retirar": "Retract",
    "empty.sin_rutinas": "You don't have any routines yet",
    "empty.crear_o_guardar": "Create a routine or save one from marketplace to get started.",
    "empty.sin_asignadas": "No routines assigned",
    "empty.guia_asignadas": "When a coach assigns you a routine, it will appear here in read-only mode.",
    "library.title": "Exercise library",
    "library.search": "Search exercise...",
    "library.muscle_all": "Muscle (all)",
    "library.submuscle_all": "Sub-muscle (all)",
    "library.type_all": "Type (all)",
    "library.found": "exercises found",
    "library.add": "+ Add",
    "library.loading": "Loading exercises...",
    "library.no_results": "No results",
    "library.try_filters": "Try another term or adjust filters.",
    "library.search_to_start": "Search or filter to load exercises",
    "library.search_to_start_hint": "Type in the search bar or select muscle, sub-muscle, or equipment type.",
    "library.primary": "Primary",
    "library.sub": "Sub",
    "library.secondary": "Secondary",
    "technique.understood": "Got it",
    "technique.no_media": "No media available",
    "technique.no_instructions": "No detailed technique for this exercise yet."
  }
};

export function t(locale: Locale, key: string): string {
  return dict[locale]?.[key] ?? dict.es[key] ?? key;
}
