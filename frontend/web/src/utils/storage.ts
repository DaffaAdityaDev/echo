const hasWindow = typeof window !== "undefined";

export function getStorage(key: string): string | null {
  if (!hasWindow) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStorage(key: string, value: string): void {
  if (!hasWindow) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable — write is best-effort
  }
}

export function removeStorage(key: string): void {
  if (!hasWindow) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
}

export function getStorageJSON<T>(key: string): T | null {
  const stored = getStorage(key);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return null;
  }
}

export function setStorageJSON(key: string, value: unknown): void {
  setStorage(key, JSON.stringify(value));
}
