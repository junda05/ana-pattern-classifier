const STORAGE_KEY = 'ana-classifier.tokens'; // localStorage key that holds the auth tokens

export function saveTokens({ access, refresh, user }) {
  const payload = { access, refresh, user };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getTokens() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return getTokens()?.access || null;
}

export function getRefreshToken() {
  return getTokens()?.refresh || null;
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEY);
}
