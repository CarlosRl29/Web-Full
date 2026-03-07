import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "2rem", textAlign: "center", minHeight: "50vh" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>404</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Página no encontrada
      </p>
      <Link href="/" style={{ color: "var(--accent-blue)" }}>
        Volver al inicio
      </Link>
    </div>
  );
}
