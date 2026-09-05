export function friendlyConnectionError(error: any): string {
  if (error?.name === 'AbortError') return 'Plex did not respond within 8 seconds. Check port 32400 and the container network.';
  const code = error?.cause?.code || error?.code || '';
  if (code === 'ECONNREFUSED') return 'Could not reach Plex at that address. If Companion runs in Docker, do not use localhost for a Plex server running on the host.';
  if (['ENOTFOUND','EAI_AGAIN'].includes(code)) return 'The Plex host name could not be resolved. Try the server’s LAN IP address.';
  if (/CERT|TLS|SSL/.test(code)) return 'Plex rejected the secure connection certificate. Try its HTTP LAN address on port 32400.';
  return error?.message || 'The connection failed.';
}
