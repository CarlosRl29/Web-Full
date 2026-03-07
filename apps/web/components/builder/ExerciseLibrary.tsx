"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { BuilderExercise } from "../../lib/useRoutineBuilderDraft";
import { useLanguage } from "../LanguageProvider";

/** Fallback label when API returns {value, label} - use label directly, fallback to value */
function optionLabel(opt: { value: string; label: string }, locale: string): string {
  return opt.label || opt.value;
}

/** Format canonical enum (e.g. UPPER_CHEST -> Upper Chest) for display */
function formatCanonicalLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Submuscles that belong to each muscle (prevents invalid combos like BICEPS + UPPER_CHEST) */
const SUBMUSCLES_BY_MUSCLE: Record<string, string[]> = {
  CHEST: ["UPPER_CHEST", "MID_CHEST", "LOWER_CHEST"],
  BACK: ["LATS", "UPPER_BACK", "MID_BACK", "LOWER_BACK", "TRAPS"],
  SHOULDERS: ["ANTERIOR_DELTOID", "LATERAL_DELTOID", "REAR_DELTOID"],
  BICEPS: ["BICEPS"],
  TRICEPS: ["TRICEPS"],
  QUADS: ["QUADS"],
  HAMSTRINGS: ["HAMSTRINGS"],
  GLUTES: ["GLUTES"],
  CALVES: ["CALVES"],
  CORE: ["ABS", "OBLIQUES", "ERECTORS"]
};

type Filters = {
  muscle: string;
  submuscle: string;
  type: string;
};

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Filters;
  filterOptions: {
    muscles: Array<{ value: string; label: string }>;
    submuscles: Array<{ value: string; label: string }>;
    types: Array<{ value: string; label: string }>;
  };
  onFilterChange: (patch: Partial<Filters>) => void;
  exercises: BuilderExercise[];
  totalCount: number;
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpenTechnique: (exercise: BuilderExercise) => void;
  onAddTemplate: (exercise: BuilderExercise) => void;
  hasSearchCriteria?: boolean;
};

function LibraryCard({
  exercise,
  onOpenTechnique,
  onAddTemplate,
  addLabel
}: {
  exercise: BuilderExercise;
  onOpenTechnique: (exercise: BuilderExercise) => void;
  onAddTemplate: (exercise: BuilderExercise) => void;
  addLabel: string;
}) {
  const { t } = useLanguage();
  const displayName = exercise.name ?? "";
  const snippetSource = exercise.instructions ?? "";
  const displaySnippet = snippetSource.slice(0, 70) + (snippetSource.length > 70 ? "…" : "");

  const primaryLabel = exercise.primary_muscle_label ?? (exercise.primary_muscle ? formatCanonicalLabel(exercise.primary_muscle) : null);
  const subLabel = exercise.primary_submuscle_label ?? (exercise.primary_submuscle ? formatCanonicalLabel(exercise.primary_submuscle) : null);
  const secondaryLabels = exercise.secondary_muscles_labels ?? (exercise.secondary_muscles ?? []).map(formatCanonicalLabel);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `template-${exercise.id}`,
    data: { kind: "template", exercise }
  });

  return (
    <article
      ref={setNodeRef}
      className="axion-card"
      style={{
        padding: 12,
        marginBottom: 8,
        opacity: isDragging ? 0.6 : 1,
        transform: CSS.Translate.toString(transform)
      }}
      {...listeners}
      {...attributes}
    >
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr auto", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          className="axion-builder-thumb"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onOpenTechnique(exercise)}
        >
          {exercise.image_url ? (
            <img src={exercise.image_url} alt={displayName} className="axion-builder-thumb-image" />
          ) : (
            <span>{displayName.slice(0, 2).toUpperCase()}</span>
          )}
        </button>
        <div>
          <strong>{displayName}</strong>
          <div className="axion-muted" style={{ fontSize: "0.85em", marginTop: 2 }}>
            {primaryLabel && (
              <span>
                {t("library.primary")}: {primaryLabel}
              </span>
            )}
            {subLabel && (
              <span style={{ marginLeft: 8 }}>
                {t("library.sub")}: {subLabel}
              </span>
            )}
            {secondaryLabels.length > 0 && (
              <span style={{ marginLeft: 8 }}>
                {t("library.secondary")}: {secondaryLabels.join(", ")}
              </span>
            )}
          </div>
          <p className="axion-muted" style={{ marginTop: 4, fontSize: "0.8em" }}>
            {displaySnippet || (exercise.instructions ?? "").slice(0, 60)}
          </p>
        </div>
        <button
          type="button"
          className="axion-button axion-button-secondary"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onAddTemplate(exercise)}
        >
          {addLabel}
        </button>
      </div>
    </article>
  );
}

export function ExerciseLibrary({
  search,
  onSearchChange,
  filters,
  filterOptions,
  onFilterChange,
  exercises,
  totalCount,
  loading,
  hasMore,
  onLoadMore,
  onOpenTechnique,
  onAddTemplate,
  hasSearchCriteria = false
}: Props) {
  const { t, locale } = useLanguage();
  return (
    <section className="axion-card axion-builder-column">
      <h2>{t("library.title")}</h2>
      <input
        className="axion-input"
        placeholder={t("library.search")}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        style={{ marginTop: 10, width: "100%" }}
      />
      <div className="axion-builder-filters">
        <select
          className="axion-select"
          value={filters.muscle}
          onChange={(event) => {
            const value = event.target.value;
            onFilterChange({ muscle: value, submuscle: "" });
          }}
        >
          <option value="">{t("library.muscle_all")}</option>
          {filterOptions.muscles.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {optionLabel(opt, locale)}
            </option>
          ))}
        </select>
        <select
          className="axion-select"
          value={filters.submuscle}
          onChange={(event) => onFilterChange({ submuscle: event.target.value })}
          disabled={!filters.muscle}
        >
          <option value="">{t("library.submuscle_all")}</option>
          {(filters.muscle ? (SUBMUSCLES_BY_MUSCLE[filters.muscle] ?? []) : []).map((subValue) => {
            const opt = filterOptions.submuscles.find((o) => o.value === subValue);
            return opt ? (
              <option key={opt.value} value={opt.value}>
                {optionLabel(opt, locale)}
              </option>
            ) : (
              <option key={subValue} value={subValue}>
                {subValue.replace(/_/g, " ")}
              </option>
            );
          })}
        </select>
        <select
          className="axion-select"
          value={filters.type}
          onChange={(event) => onFilterChange({ type: event.target.value })}
        >
          <option value="">{t("library.type_all")}</option>
          {filterOptions.types.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {optionLabel(opt, locale)}
            </option>
          ))}
        </select>
      </div>
      <p className="axion-muted" style={{ marginTop: 10 }}>
        {totalCount} {t("library.found")}
      </p>

      <div
        className="axion-builder-scroll"
        onScroll={(event) => {
          const target = event.currentTarget;
          if (loading || !hasMore) {
            return;
          }
          const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 64;
          if (nearBottom) {
            onLoadMore();
          }
        }}
      >
        {exercises.map((exercise) => (
          <LibraryCard
            key={exercise.id}
            exercise={exercise}
            onOpenTechnique={onOpenTechnique}
            onAddTemplate={onAddTemplate}
            addLabel={t("library.add")}
          />
        ))}
        {loading ? <p className="axion-muted">{t("library.loading")}</p> : null}
        {!loading && exercises.length === 0 ? (
          <div className="axion-empty">
            {hasSearchCriteria ? (
              <>
                <strong>{t("library.no_results")}</strong>
                <p>{t("library.try_filters")}</p>
              </>
            ) : (
              <>
                <strong>{t("library.search_to_start")}</strong>
                <p>{t("library.search_to_start_hint")}</p>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
