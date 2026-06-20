/**
 * Centralized configurations for API paths.
 * Resolves API URLs dynamically depending on the current environment (Production/Local).
 */

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8080";

// Standardize API_BASE_URL by removing any trailing "/api" or "/api/" to avoid duplicate "/api/api" routing issues.
export const API_BASE_URL = rawApiBaseUrl.replace(/\/api\/?$/, "");

// Standardize AUTOMACAO_BASE_URL:
// - In production, routes like "/api/automacoes" go through Caddy proxy to the Python worker.
// - In a local environment, we fallback directly to the Python worker port (http://localhost:8000).
export const AUTOMACAO_BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? rawApiBaseUrl.replace(/\/api\/?$/, "")
  : "http://localhost:8000";
