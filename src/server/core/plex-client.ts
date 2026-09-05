import { friendlyConnectionError } from './errors.ts';

const defaultHeaders = {
  'X-Plex-Product':'Ultimate Plex Companion',
  'X-Plex-Version':'0.1.0',
  'X-Plex-Client-Identifier':'ultimate-plex-companion',
};

function timeoutSignal(milliseconds) {
  const controller = new AbortController();
  return { signal:controller.signal, cancel:setTimeout(() => controller.abort(), milliseconds) };
}

export function createPlexClient(fetchImpl = fetch) {
  async function request(config, path, options: any = {}) {
    const timeout = timeoutSignal(options.timeout || 8_000);
    try {
      return await fetchImpl(config.plexUrl + path, {
        method:options.method || 'GET',
        signal:timeout.signal,
        headers:{ ...defaultHeaders, 'X-Plex-Token':config.token, ...options.headers },
      });
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Plex did not respond within 8 seconds.');
      throw new Error(friendlyConnectionError(error));
    } finally { clearTimeout(timeout.cancel); }
  }

  async function fetchJson(config, path) {
    const response = await request(config, path, { headers:{ Accept:'application/json' } });
    if (!response.ok) throw new Error(response.status === 401 ? 'Plex rejected the access token.' : `Plex returned HTTP ${response.status}.`);
    if (!(response.headers.get('content-type') || '').includes('json')) throw new Error('Plex did not return JSON. Check that this URL points to Plex Media Server.');
    return response.json();
  }

  async function command(config, path, method = 'GET') {
    const response = await request(config, path, { method });
    if (!response.ok) throw new Error(response.status === 401 ? 'Plex rejected the access token.' : `Plex returned HTTP ${response.status}.`);
  }

  async function deleteMedia(config, path) {
    const response = await request(config, path, { method:'DELETE', timeout:12_000, headers:{ 'X-Plex-Pms-Api-Version':'1.0.0' } });
    if (response.ok) return;
    if ([401,403].includes(response.status)) throw new Error('Plex refused deletion. Confirm you are the server owner and Allow Media Deletion is enabled in Plex.');
    throw new Error(`Plex could not delete this media version (HTTP ${response.status}). Nothing was changed.`);
  }

  async function artwork(config, ratingKey) {
    const response = await request(config, `/library/metadata/${ratingKey}/thumb`, { headers:{ Accept:'image/*' } });
    if (!response.ok) throw new Error('Artwork unavailable.');
    return response;
  }

  return { fetchJson, command, deleteMedia, artwork };
}
