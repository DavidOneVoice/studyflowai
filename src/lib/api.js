// Development uses Vite's local /api proxy unless an explicit backend is selected.
export const API_BASE = (
  import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "" : "https://cramless.onrender.com")
)
  .trim()
  .replace(/\/+$/, "");
