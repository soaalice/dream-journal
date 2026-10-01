/** localStorage can throw (private mode, blocked storage); these helpers never do. */
export const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

export const removeStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

export const readJson = <T,>(key: string): T | null => {
  const raw = readStorage(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writeJson = (key: string, value: unknown): void => writeStorage(key, JSON.stringify(value));
