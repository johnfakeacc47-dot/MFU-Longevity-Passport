// ── Safe localStorage helpers ───────────────────────────────────────────────
// Plain `JSON.parse(localStorage.getItem(key) || fallback)` throws a SyntaxError
// whenever the stored value isn't valid JSON (empty string, "undefined", data
// left over from an old schema, etc). With no error boundary above a render-time
// call, that throw white-screens the whole app. These helpers make a bad value
// degrade to `fallback` instead of crashing.

/** Parse a raw string that may not be valid JSON, falling back safely on error. */
export function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('[safeStorage] Failed to parse stored value, using fallback:', err);
    return fallback;
  }
}

/** Read + parse a localStorage key, falling back safely if it's missing, malformed, or storage is unavailable. */
export function safeGetItem<T>(key: string, fallback: T): T {
  try {
    return safeParse(localStorage.getItem(key), fallback);
  } catch (err) {
    // localStorage.getItem itself can throw (private browsing, storage disabled, etc.)
    console.warn(`[safeStorage] Failed to read localStorage key "${key}":`, err);
    return fallback;
  }
}
