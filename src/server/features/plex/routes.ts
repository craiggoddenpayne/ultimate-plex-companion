import { requirePlex } from '../../core/router.ts';
import { plexItemUrl } from './plex-link-server.ts';
import { Readable } from 'node:stream';
import { basename } from 'node:path';

const validId = (value) => /^\d+$/.test(String(value || ''));
const safeName = (value) =>
  String(value || 'media-download')
    .replace(/[\r\n"]/g, '')
    .slice(0, 220);

function contentDisposition(fileName) {
  const safe = safeName(fileName);
  const fallback = safe.normalize('NFKD').replace(/[^\x20-\x7e]/g, '_') || 'media-download';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/'/g, '%27')}`;
}

function downloadItem(item) {
  return {
    ratingKey: String(item.ratingKey || ''),
    title: item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Untitled',
    year: Number(item.year || item.grandparentYear || 0) || null,
    type: item.type || 'video',
    poster: item.ratingKey ? `/api/art/${item.ratingKey}` : '',
  };
}

async function mediaVersions(config, plexFetch, ratingKey) {
  const data = await plexFetch(config, `/library/metadata/${ratingKey}?includeMedia=1`);
  const item = data.MediaContainer?.Metadata?.[0];
  if (!item) throw new Error('Plex could not find that media item.');
  return {
    ...downloadItem(item),
    versions: (item.Media || []).flatMap((media) =>
      (media.Part || [])
        .filter((part) => validId(part.id))
        .map((part) => ({
          partId: String(part.id),
          fileName: basename(String(part.file || '')) || `${item.title || 'media'}.${media.container || 'bin'}`,
          size: Number(part.size || 0),
          container: String(media.container || ''),
          resolution: String(media.videoResolution || '').toUpperCase(),
          videoCodec: String(media.videoCodec || '').toUpperCase(),
          audioCodec: String(media.audioCodec || '').toUpperCase(),
        })),
    ),
  };
}

export function createPlexRoutes() {
  return async (context) => {
    const openMatch = context.pathname.match(/^\/api\/plex\/open\/(\d+)$/);
    const itemMatch = context.pathname.match(/^\/api\/downloads\/item\/(\d+)$/);
    const fileMatch = context.pathname.match(/^\/api\/downloads\/file\/(\d+)\/(\d+)$/);
    const searching = context.pathname === '/api/downloads/search';
    if ((!openMatch && !itemMatch && !fileMatch && !searching) || context.req.method !== 'GET') return false;
    const config = await requirePlex(context);
    if (!config) return true;
    if (searching) {
      const query = String(new URL(context.req.url, 'http://localhost').searchParams.get('q') || '').trim();
      if (query.length < 2) {
        context.json(context.res, 200, { results: [] });
        return true;
      }
      const data = await context.plexFetch(
        config,
        `/hubs/search?query=${encodeURIComponent(query)}&limit=30&includeCollections=0`,
      );
      const results = (data.MediaContainer?.Hub || [])
        .flatMap((hub) => hub.Metadata || [])
        .filter((item) => ['movie', 'episode'].includes(item.type) && validId(item.ratingKey))
        .map(downloadItem)
        .filter((item, index, all) => all.findIndex((other) => other.ratingKey === item.ratingKey) === index)
        .slice(0, 30);
      context.json(context.res, 200, { results });
      return true;
    }
    if (itemMatch) {
      context.json(context.res, 200, await mediaVersions(config, context.plexFetch, itemMatch[1]));
      return true;
    }
    if (fileMatch) {
      const item = await mediaVersions(config, context.plexFetch, fileMatch[1]);
      const version = item.versions.find((candidate) => candidate.partId === fileMatch[2]);
      if (!version) throw new Error('That Plex media version is no longer available.');
      const metadata = await context.plexFetch(config, `/library/metadata/${fileMatch[1]}?includeMedia=1`);
      const part = (metadata.MediaContainer?.Metadata?.[0]?.Media || [])
        .flatMap((media) => media.Part || [])
        .find((candidate) => String(candidate.id) === fileMatch[2]);
      const upstream = await context.plexMedia(config, String(part?.key || ''), context.req.headers.range);
      const headers = {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': contentDisposition(version.fileName),
        'Cache-Control': 'no-store',
        'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
      };
      for (const name of ['content-length', 'content-range']) {
        const value = upstream.headers.get(name);
        if (value) headers[name] = value;
      }
      context.res.writeHead(upstream.status, headers);
      if (!upstream.body) context.res.end();
      else {
        const source = Readable.fromWeb(upstream.body);
        source.on('error', (error) => {
          context.logger.warn('download.stream_failed', { ratingKey: fileMatch[1], partId: fileMatch[2], error });
          context.res.destroy(error);
        });
        context.res.once('close', () => source.destroy());
        source.pipe(context.res);
      }
      return true;
    }
    const identity = await context.inspectPlex(config);
    context.res.writeHead(302, {
      Location: plexItemUrl(identity.machineIdentifier, openMatch[1]),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    });
    context.res.end();
    return true;
  };
}
