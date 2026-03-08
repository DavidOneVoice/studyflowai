// src/lib/api.js

/**
 * Base URL for backend API requests.
 *
 * - Uses VITE_API_BASE from environment variables when available.
 * - Falls back to the production Render URL if not defined.
 * - Trims whitespace and removes trailing slashes to ensure consistent URL building.
 */
export const API_BASE = (
  import.meta?.env?.VITE_API_BASE || "https://cramless.onrender.com"
)
  .trim()
  .replace(/\/+$/, "");
