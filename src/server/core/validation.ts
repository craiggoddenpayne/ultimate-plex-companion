export function normalizePlexConfig(input) {
  const url = new URL(String(input?.plexUrl || '').trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Plex URL must use http:// or https://.');
  if (url.username || url.password) throw new Error('Do not include credentials in the Plex URL.');
  const token = String(input?.token || '').trim();
  if (!token) throw new Error('A Plex access token is required.');
  return { plexUrl:url.toString().replace(/\/$/, ''), token };
}

export function isNumericId(value) {
  return /^\d+$/.test(String(value || ''));
}
