import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat, access, rename, unlink } from 'node:fs/promises';
import { extname, join, normalize, dirname, basename, relative, resolve, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { composeFeatureRouters } from './core/router.ts';
import { createPlexClient } from './core/plex-client.ts';
import { normalizePlexConfig } from './core/validation.ts';
import { createAutomationRoutes } from './features/automations/routes.ts';
import { createCodecRoutes } from './features/codec-studio/routes.ts';
import { createCommandDeckRoutes } from './features/command-deck/routes.ts';
import { createCompanionRoutes } from './features/companion/routes.ts';
import { createConnectionRoutes } from './features/connection/routes.ts';
import { createDiscoveryRoutes } from './features/discovery/routes.ts';
import { createFutureLabRoutes } from './features/future-lab/routes.ts';
import { createLibraryRoutes } from './features/library/routes.ts';
import { createMetadataRoutes } from './features/metadata/routes.ts';
import { createPlaylistRoutes } from './features/playlists/routes.ts';
import { createPlexRoutes } from './features/plex/routes.ts';
import { createRecommendationRoutes } from './features/recommendations/routes.ts';
import { createTelemetryRoutes } from './features/telemetry/routes.ts';
import { createUtilityRoutes } from './features/utility-suite/routes.ts';
import { createAutomationEngine } from './features/automations/automation-server.ts';
import { createOptimizationStore } from './features/codec-studio/optimization-store-server.ts';
import { optimizationEta, requestOptimizationCancellation } from './features/codec-studio/optimization-queue-server.ts';
import {
  conversionTarget,
  isLegacyCodec,
  supportedTargets,
  videoArguments,
} from './features/codec-studio/codec-modernizer-server.ts';

const port = Number(process.env.PORT || 8080);
const staticRoot = join(process.cwd(), 'dist');
const configDir = process.env.CONFIG_DIR || join(process.cwd(), 'data');
const configFile = join(configDir, 'config.json');
const envConfig =
  process.env.PLEX_URL && process.env.PLEX_TOKEN
    ? { plexUrl: process.env.PLEX_URL, token: process.env.PLEX_TOKEN }
    : null;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error('Request is too large.');
  }
  return JSON.parse(raw || '{}');
}

const normalizeConfig = normalizePlexConfig;

function optimizationSettings(config: any = {}) {
  const stored = config.optimization || {};
  return {
    plexPathRoot: process.env.PLEX_MEDIA_ROOT || stored.plexPathRoot || '/media',
    mediaPathRoot: process.env.MEDIA_ROOT || stored.mediaPathRoot || '/media',
    crf: Math.min(26, Math.max(16, Number(stored.crf || process.env.HEVC_CRF || 20))),
    preset: ['fast', 'medium', 'slow'].includes(stored.preset || process.env.HEVC_PRESET)
      ? stored.preset || process.env.HEVC_PRESET
      : 'medium',
  };
}

async function savedConfig() {
  if (envConfig) {
    let stored = {};
    try {
      stored = JSON.parse(await readFile(configFile, 'utf8'));
    } catch {}
    return { ...normalizeConfig(envConfig), optimization: optimizationSettings(stored) };
  }
  try {
    const raw = JSON.parse(await readFile(configFile, 'utf8'));
    return { ...normalizeConfig(raw), optimization: optimizationSettings(raw) };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const plexClient = createPlexClient();
const plexFetch = plexClient.fetchJson;
const plexCommand = plexClient.command;
const plexDelete = plexClient.deleteMedia;

async function inspectPlex(config) {
  const [root, identity] = await Promise.all([plexFetch(config, '/'), plexFetch(config, '/identity')]);
  const data = { ...root.MediaContainer, ...identity.MediaContainer };
  return {
    name: data.friendlyName || data.name || 'Plex Media Server',
    version: data.version || 'Unknown',
    machineIdentifier: data.machineIdentifier || '',
  };
}

async function overview(config) {
  const [server, sectionData, sessionData] = await Promise.all([
    inspectPlex(config),
    plexFetch(config, '/library/sections'),
    plexFetch(config, '/status/sessions'),
  ]);
  const directories = sectionData.MediaContainer?.Directory || [];
  const libraries = await Promise.all(
    directories.map(async (library) => {
      try {
        const result = await plexFetch(
          config,
          `/library/sections/${encodeURIComponent(library.key)}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=0`,
        );
        return {
          key: library.key,
          title: library.title,
          type: library.type,
          count: Number(result.MediaContainer?.totalSize ?? result.MediaContainer?.size ?? 0),
        };
      } catch {
        return { key: library.key, title: library.title, type: library.type, count: 0 };
      }
    }),
  );
  const media = sessionData.MediaContainer?.Metadata || [];
  const sessions = media.map((item, index) => {
    const part = item.Media?.[0]?.Part?.[0] || {};
    const transcode = item.TranscodeSession?.[0];
    const player = item.Player?.[0] || {};
    const user = item.User?.[0]?.title || 'Unknown';
    const progress = item.duration ? Math.round((Number(item.viewOffset || 0) / Number(item.duration)) * 100) : 0;
    const mode = transcode
      ? 'Transcoding'
      : item.Media?.[0]?.videoDecision === 'copy'
        ? 'Direct Stream'
        : 'Direct Play';
    return {
      title: item.grandparentTitle ? `${item.grandparentTitle} · ${item.title}` : item.title || 'Unknown title',
      meta: [item.year, item.Media?.[0]?.videoResolution?.toUpperCase(), mode].filter(Boolean).join(' · '),
      user,
      device: player.title || player.product || 'Plex client',
      progress: Math.min(100, Math.max(0, progress)),
      tone: ['amber', 'violet', 'cyan'][index % 3],
      size: Number(part.size || 0),
      mode,
      ratingKey: item.ratingKey || null,
      poster: item.ratingKey ? `/api/art/${encodeURIComponent(item.ratingKey)}` : null,
    };
  });
  return {
    server,
    libraries,
    libraryCount: libraries.length,
    titleCount: libraries.reduce((sum, item) => sum + item.count, 0),
    sessions,
    syncedAt: new Date().toISOString(),
  };
}

let storageScanCache = null;
let discoveryCache = null;

async function libraryItems(config, library) {
  const items = [];
  const pageSize = 200;
  const mediaType = library.type === 'show' ? 4 : 1;
  for (let start = 0; start < 50_000; start += pageSize) {
    const query = new URLSearchParams({
      type: String(mediaType),
      includeMedia: '1',
      'X-Plex-Container-Start': String(start),
      'X-Plex-Container-Size': String(pageSize),
    });
    const result = await plexFetch(config, `/library/sections/${encodeURIComponent(library.key)}/all?${query}`);
    const page = result.MediaContainer?.Metadata || [];
    items.push(...page.map((item) => ({ ...item, libraryTitle: library.title })));
    const total = Number(result.MediaContainer?.totalSize ?? result.MediaContainer?.size ?? page.length);
    if (!page.length || items.length >= total || page.length < pageSize) break;
  }
  return items;
}

function storageCandidate(item) {
  const versions = (item.Media || [])
    .map((media) => ({ media, size: (media.Part || []).reduce((sum, part) => sum + Number(part.size || 0), 0) }))
    .sort((a, b) => b.size - a.size);
  const version = versions.find((entry) => isLegacyCodec(entry.media.videoCodec));
  if (!version) return null;
  const sourceCodec = String(version.media.videoCodec || 'legacy').toLowerCase();
  const minimumSize = ['h264', 'avc'].includes(sourceCodec) ? 4 * 1024 ** 3 : 1024 ** 3;
  if (version.size < minimumSize) return null;
  const resolution = String(version.media.videoResolution || '').toLowerCase(),
    bitrate = Number(version.media.bitrate || 0);
  const threshold = resolution.includes('4k') ? 20000 : resolution.includes('1080') ? 12000 : 8000;
  if (['h264', 'avc'].includes(sourceCodec) && bitrate && bitrate < threshold) return null;
  const savingRatio = ['mpeg2video', 'mpeg2', 'vc1', 'mpeg4'].includes(sourceCodec)
    ? 0.42
    : resolution.includes('4k')
      ? 0.35
      : resolution.includes('1080')
        ? 0.3
        : 0.24;
  const estimatedSaving = Math.round(version.size * savingRatio),
    score = Math.min(99, Math.round(58 + Math.min(22, bitrate / 1500) + Math.min(19, version.size / 1024 ** 3)));
  return {
    ratingKey: item.ratingKey,
    title: item.title || 'Unknown title',
    year: item.year || null,
    library: item.libraryTitle,
    resolution: resolution.toUpperCase() || 'VIDEO',
    codec: sourceCodec.toUpperCase(),
    bitrate,
    size: version.size,
    estimatedSaving,
    confidence: score,
    reason:
      (resolution.toUpperCase() || 'Video') +
      ' ' +
      sourceCodec.toUpperCase() +
      ' media is a strong modern-codec review candidate.',
  };
}

async function storageAnalysis(config, force = false) {
  if (!force && storageScanCache && Date.now() - storageScanCache.createdAt < 10 * 60_000) return storageScanCache.data;
  const sections = await plexFetch(config, '/library/sections');
  const libraries = (sections.MediaContainer?.Directory || []).filter((library) =>
    ['movie', 'show'].includes(library.type),
  );
  const batches = await Promise.all(libraries.map((library) => libraryItems(config, library)));
  const items = batches.flat();
  const candidates = items
    .map(storageCandidate)
    .filter(Boolean)
    .sort((a, b) => b.estimatedSaving - a.estimatedSaving);
  const data = {
    scanned: items.length,
    libraries: libraries.length,
    candidates: candidates.slice(0, 100),
    candidateCount: candidates.length,
    totalSize: candidates.reduce((sum, item) => sum + item.size, 0),
    estimatedSaving: candidates.reduce((sum, item) => sum + item.estimatedSaving, 0),
    averageConfidence: candidates.length
      ? Math.round(candidates.reduce((sum, item) => sum + item.confidence, 0) / candidates.length)
      : 0,
    methodology:
      'Conservative estimate for large H.264, MPEG-2, MPEG-4 and VC-1 files reviewed for HEVC or AV1 conversion. Results vary by source and encoder settings.',
    readOnly: true,
    scannedAt: new Date().toISOString(),
  };
  storageScanCache = { createdAt: Date.now(), data };
  return data;
}

const moodGenres = {
  any: [],
  intense: ['Thriller', 'Action', 'Crime', 'Horror'],
  comfort: ['Comedy', 'Family', 'Animation', 'Romance'],
  mindbend: ['Science Fiction', 'Mystery', 'Fantasy'],
  epic: ['Adventure', 'Action', 'History', 'War'],
  funny: ['Comedy'],
  real: ['Documentary', 'History', 'Biography', 'Music'],
};

function stableNoise(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}

async function discoveryCatalog(config, force = false) {
  if (!force && discoveryCache && Date.now() - discoveryCache.createdAt < 15 * 60_000) return discoveryCache.items;
  const sections = await plexFetch(config, '/library/sections');
  const libraries = (sections.MediaContainer?.Directory || []).filter((library) => library.type === 'movie');
  const items = (await Promise.all(libraries.map((library) => libraryItems(config, library)))).flat();
  discoveryCache = { createdAt: Date.now(), items };
  return items;
}

async function discoveryRecommendations(config, options) {
  const mood = moodGenres[options.mood] ? options.mood : 'any';
  const mode = ['tonight', 'hidden', 'top', 'recent', 'surprise'].includes(options.mode) ? options.mode : 'tonight';
  const maxMinutes = Math.min(300, Math.max(45, Number(options.maxMinutes || 180)));
  const unwatchedOnly = options.unwatchedOnly !== 'false';
  const catalog = await discoveryCatalog(config, options.refresh === '1');
  const now = Date.now() / 1000;
  const ranked = catalog
    .map((item) => {
      const genres = (item.Genre || []).map((genre) => genre.tag).filter(Boolean);
      const durationMinutes = Math.round(Number(item.duration || 0) / 60_000);
      const rating = Number(item.audienceRating || item.rating || 0);
      const watched = Number(item.viewCount || 0) > 0;
      const moodMatches = moodGenres[mood].filter((genre) => genres.includes(genre));
      let score = 35 + rating * 3 + (watched ? -5 : 8) + moodMatches.length * 8;
      const ageDays = item.addedAt ? (now - Number(item.addedAt)) / 86400 : 9999;
      if (mode === 'hidden') score += watched ? -18 : 8 + Math.min(5, rating / 2);
      if (mode === 'top') score += rating * 2;
      if (mode === 'recent') score += Math.max(0, 14 - ageDays / 20);
      if (mode === 'surprise') score += stableNoise(`${item.ratingKey}-${new Date().toISOString().slice(0, 10)}`) * 14;
      if (durationMinutes && durationMinutes <= maxMinutes)
        score += Math.max(1, 5 - (maxMinutes - durationMinutes) / 30);
      const reasons = [];
      if (moodMatches.length) reasons.push(`matches ${moodMatches.slice(0, 2).join(' + ').toLowerCase()} mood`);
      if (!watched) reasons.push('unwatched in your library');
      if (rating >= 8) reasons.push(`${rating.toFixed(1)} audience rating`);
      if (durationMinutes <= maxMinutes) reasons.push(`fits your ${maxMinutes}-minute window`);
      if (mode === 'recent' && ageDays < 90) reasons.push('recently added');
      return { item, score, genres, durationMinutes, rating, watched, reasons };
    })
    .filter(
      (result) =>
        (!unwatchedOnly || !result.watched) && result.durationMinutes > 0 && result.durationMinutes <= maxMinutes,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);
  return {
    catalogSize: catalog.length,
    mood,
    mode,
    maxMinutes,
    unwatchedOnly,
    results: ranked.map(({ item, genres, durationMinutes, rating, watched, reasons, score }) => ({
      ratingKey: item.ratingKey,
      title: item.title,
      year: item.year || null,
      summary: item.summary || '',
      library: item.libraryTitle,
      genres: genres.slice(0, 4),
      durationMinutes,
      rating,
      watched,
      score: Math.min(99, Math.max(50, Math.round(score))),
      reason: reasons.length ? reasons.slice(0, 3).join(' · ') : 'a strong fit from your Plex library',
      poster: `/api/art/${item.ratingKey}`,
      plexUrl: `/api/plex/open/${item.ratingKey}`,
    })),
  };
}

async function servePlexArt(res, ratingKey) {
  try {
    const config = await savedConfig();
    if (!config || !/^\d+$/.test(ratingKey)) throw new Error('Artwork unavailable.');
    const response = await plexClient.artwork(config, ratingKey);
    res.writeHead(200, {
      'Content-Type': response.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(404);
    res.end();
  }
}

const jobs = new Map();
const optimizationStore = createOptimizationStore(configDir);
let activeJob = null;
let activeOptimizationProcess = null;
let queuePaused = false;
let lastJobPersistAt = 0;

const persistOptimizationJobs = () => optimizationStore.save(jobs, { paused: queuePaused });

async function restoreOptimizationJobs() {
  try {
    const restored = await optimizationStore.load();
    for (const job of restored.jobs) jobs.set(job.id, job);
    queuePaused = restored.paused;
    if (restored.recovered) await persistOptimizationJobs();
  } catch (error) {
    console.error(error.message);
  }
}

function publicJob(job) {
  const safe = { ...job };
  delete safe.sourcePath;
  delete safe.outputPath;
  delete safe.plexDirectory;
  const etaSeconds = optimizationEta(job);
  return etaSeconds === null ? safe : { ...safe, etaSeconds };
}

function runProcess(command, args, onLine = null, onSpawn = null): Promise<any> {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    onSpawn?.(child);
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      onLine?.(chunk.toString());
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-12_000);
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolveProcess({ stdout, stderr })
        : reject(new Error(`${command} exited with code ${code}: ${stderr.slice(-600)}`)),
    );
  });
}

async function probe(file) {
  const { stdout } = await runProcess('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size',
    '-show_entries',
    'stream=codec_type,codec_name',
    '-of',
    'json',
    file,
  ]);
  return JSON.parse(stdout);
}

function mapPlexPath(file, settings) {
  const plexRoot = resolve(settings.plexPathRoot);
  const pathRelative = relative(plexRoot, resolve(file));
  if (!pathRelative || pathRelative.startsWith('..') || isAbsolute(pathRelative))
    throw new Error(`Media path is outside the configured Plex root (${settings.plexPathRoot}).`);
  return resolve(settings.mediaPathRoot, pathRelative);
}

async function prepareJob(config, ratingKey) {
  const metadata = await plexFetch(config, `/library/metadata/${encodeURIComponent(ratingKey)}`);
  const item = metadata.MediaContainer?.Metadata?.[0];
  if (!item) throw new Error('Plex could not find that media item.');
  const versions = (item.Media || [])
    .flatMap((media) => (media.Part || []).map((part) => ({ media, part, size: Number(part.size || 0) })))
    .sort((a, b) => b.size - a.size);
  const version = versions.find((entry) => isLegacyCodec(entry.media.videoCodec) && entry.part.file);
  if (!version) throw new Error('No supported legacy-codec media file was found for this item.');
  const settings = optimizationSettings(config);
  const sourcePath = mapPlexPath(version.part.file, settings);
  await access(sourcePath);
  return { item, version, settings, sourcePath, plexDirectory: dirname(version.part.file) };
}

async function encodeJob(job, config) {
  try {
    if (job.cancelRequested || job.state === 'cancelled')
      throw Object.assign(new Error('Optimization cancelled.'), { code: 'OPTIMIZATION_CANCELLED' });
    const target = conversionTarget(job.targetCodec);
    job.targetCodec = target.key;
    job.targetLabel = target.label;
    job.state = 'preparing';
    job.updatedAt = new Date().toISOString();
    await persistOptimizationJobs();
    const prepared = await prepareJob(config, job.ratingKey);
    if (job.cancelRequested)
      throw Object.assign(new Error('Optimization cancelled.'), { code: 'OPTIMIZATION_CANCELLED' });
    const source = await probe(prepared.sourcePath);
    const sourceSize = Number(source.format?.size || prepared.version.size);
    const duration = Number(source.format?.duration || 0);
    const extension = extname(prepared.sourcePath);
    const stem = basename(prepared.sourcePath, extension);
    const outputPath = join(
      dirname(prepared.sourcePath),
      stem + '.upc-' + target.key + '-' + job.id.slice(0, 6) + '.mkv',
    );
    if (job.recovered) {
      await unlink(outputPath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      delete job.recovered;
    } else {
      try {
        await access(outputPath);
        throw new Error('A staged output file already exists.');
      } catch (error) {
        if (error.message.includes('already exists')) throw error;
      }
    }
    Object.assign(job, {
      title: prepared.item.title || job.title,
      sourcePath: prepared.sourcePath,
      outputPath,
      plexDirectory: prepared.plexDirectory,
      sourceSize,
      duration,
      state: 'encoding',
      progress: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await persistOptimizationJobs();
    if (job.cancelRequested)
      throw Object.assign(new Error('Optimization cancelled.'), { code: 'OPTIMIZATION_CANCELLED' });
    const args = [
      '-hide_banner',
      '-nostdin',
      '-n',
      '-i',
      prepared.sourcePath,
      '-map',
      '0',
      '-map_metadata',
      '0',
      '-map_chapters',
      '0',
      '-c',
      'copy',
      ...videoArguments(target.key, prepared.settings),
      '-progress',
      'pipe:1',
      '-nostats',
      outputPath,
    ];
    try {
      await runProcess(
        'ffmpeg',
        args,
        (text) => {
          const match = text.match(/out_time_us=(\d+)/);
          if (match && duration)
            job.progress = Math.min(99, Math.round((Number(match[1]) / 1_000_000 / duration) * 100));
          job.updatedAt = new Date().toISOString();
          if (Date.now() - lastJobPersistAt > 2000) {
            lastJobPersistAt = Date.now();
            persistOptimizationJobs().catch(() => {});
          }
        },
        (child) => {
          activeOptimizationProcess = child;
        },
      );
    } finally {
      activeOptimizationProcess = null;
    }
    if (job.cancelRequested)
      throw Object.assign(new Error('Optimization cancelled.'), { code: 'OPTIMIZATION_CANCELLED' });
    job.state = 'verifying';
    job.progress = 99;
    await persistOptimizationJobs();
    const output = await probe(outputPath);
    if (job.cancelRequested)
      throw Object.assign(new Error('Optimization cancelled.'), { code: 'OPTIMIZATION_CANCELLED' });
    const outputSize = Number(output.format?.size || 0);
    const outputDuration = Number(output.format?.duration || 0);
    const sourceStreams = (source.streams || []).reduce(
      (counts, stream) => ({ ...counts, [stream.codec_type]: (counts[stream.codec_type] || 0) + 1 }),
      {},
    );
    const outputStreams = (output.streams || []).reduce(
      (counts, stream) => ({ ...counts, [stream.codec_type]: (counts[stream.codec_type] || 0) + 1 }),
      {},
    );
    const outputVideo = (output.streams || []).find((stream) => stream.codec_type === 'video')?.codec_name;
    if (target.key === 'hevc' && outputVideo !== 'hevc')
      throw new Error('HEVC codec verification failed. The original has been preserved.');
    if (target.key === 'av1' && outputVideo !== 'av1')
      throw new Error('AV1 codec verification failed. The original has been preserved.');
    if (target.key === 'vp9' && outputVideo !== 'vp9')
      throw new Error('VP9 codec verification failed. The original has been preserved.');
    const durationTolerance = Math.max(2, duration * 0.01);
    if (!outputSize || outputSize >= sourceSize)
      throw new Error('The encoded file is not smaller than its source. The original has been preserved.');
    if (duration && Math.abs(outputDuration - duration) > durationTolerance)
      throw new Error('Duration verification failed. The original has been preserved.');
    for (const type of ['audio', 'subtitle'])
      if ((outputStreams[type] || 0) < (sourceStreams[type] || 0))
        throw new Error(`${type} stream verification failed. The original has been preserved.`);
    Object.assign(job, {
      state: 'ready',
      progress: 100,
      outputSize,
      saving: sourceSize - outputSize,
      savingPercent: Math.round(((sourceSize - outputSize) / sourceSize) * 100),
      verified: true,
      updatedAt: new Date().toISOString(),
    });
    await persistOptimizationJobs();
  } catch (error) {
    if (job.cancelRequested || error.code === 'OPTIMIZATION_CANCELLED') {
      if (job.outputPath)
        await unlink(job.outputPath).catch((unlinkError) => {
          if (unlinkError.code !== 'ENOENT')
            console.error(`Could not remove cancelled optimization output: ${unlinkError.message}`);
        });
      job.state = 'cancelled';
      job.progress = 0;
      job.cancelledAt = new Date().toISOString();
      job.updatedAt = job.cancelledAt;
      delete job.cancelRequested;
      delete job.error;
      delete job.startedAt;
      delete job.outputPath;
    } else {
      job.state = 'failed';
      job.error = error.message;
      job.updatedAt = new Date().toISOString();
    }
    await persistOptimizationJobs();
  } finally {
    activeJob = null;
    await persistOptimizationJobs();
    runNextJob();
  }
}

async function runNextJob() {
  if (activeJob || queuePaused) return;
  const next = [...jobs.values()].find((job) => job.state === 'queued');
  if (!next) return;
  activeJob = next.id;
  const config = await savedConfig();
  encodeJob(next, config);
}

async function createOptimizationJob(config, ratingKey, targetCodec = 'hevc') {
  if (![...String(ratingKey)].every((char) => char >= '0' && char <= '9')) throw new Error('Invalid Plex rating key.');
  const target = conversionTarget(targetCodec);
  const capability = await runProcess('ffmpeg', ['-hide_banner', '-encoders']);
  if (!supportedTargets(capability.stdout + ' ' + capability.stderr).find((item) => item.key === target.key)?.available)
    throw new Error(target.label + ' encoding is not available in this FFmpeg installation.');
  const candidate = (await storageAnalysis(config)).candidates.find(
    (item) => String(item.ratingKey) === String(ratingKey),
  );
  if (!candidate) throw new Error('This item is not in the current optimization candidate list.');
  if (
    [...jobs.values()].some(
      (job) => job.ratingKey === String(ratingKey) && !['failed', 'replaced', 'cancelled'].includes(job.state),
    )
  )
    throw new Error('This title already has an active optimization job.');
  const job = {
    id: randomUUID(),
    ratingKey: String(ratingKey),
    title: candidate.title,
    sourceCodec: candidate.codec,
    targetCodec: target.key,
    targetLabel: target.label,
    candidateSize: candidate.size,
    estimatedSaving: candidate.estimatedSaving,
    state: 'queued',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  await persistOptimizationJobs();
  runNextJob();
  return publicJob(job);
}

async function replaceOriginal(job, config, confirmed) {
  if (job.state !== 'ready' || !job.verified) throw new Error('Only a verified encode can replace its original.');
  if (confirmed !== true) throw new Error('Confirm replacement before continuing.');
  const extension = extname(job.sourcePath);
  const stem = basename(job.sourcePath, extension);
  const target = conversionTarget(job.targetCodec);
  const finalPath = join(dirname(job.sourcePath), stem + '.' + target.key + '.mkv');
  try {
    await access(finalPath);
    throw new Error('The final modern-codec filename already exists.');
  } catch (error) {
    if (error.message.includes('already exists')) throw error;
  }
  await rename(job.outputPath, finalPath);
  try {
    await unlink(job.sourcePath);
  } catch (error) {
    job.state = 'replacement-partial';
    job.error = 'The verified modern-codec file was finalized, but the original could not be removed.';
    await persistOptimizationJobs();
    throw error;
  }
  job.state = 'replaced';
  job.reclaimed = job.saving;
  job.updatedAt = new Date().toISOString();
  await persistOptimizationJobs();
  storageScanCache = null;
  plexFetch(config, `/library/sections/${encodeURIComponent(job.libraryKey || 'all')}/refresh`).catch(() => {});
  return publicJob(job);
}

const automationEngine = createAutomationEngine({
  configDir,
  savedConfig,
  plexFetch,
  plexCommand,
  storageAnalysis,
  overview,
});

const queueController = {
  jobs,
  publicJob,
  activeJob: () => activeJob,
  isPaused: () => queuePaused,
  persist: persistOptimizationJobs,
  runNext: runNextJob,
  create: createOptimizationJob,
  replace: replaceOriginal,
  async cancel(id) {
    const job = requestOptimizationCancellation(jobs, id, activeJob);
    await persistOptimizationJobs();
    const processToStop = job.cancelRequested ? activeOptimizationProcess : null;
    if (processToStop?.exitCode === null) {
      processToStop.kill('SIGTERM');
      const forceStop = setTimeout(() => {
        if (processToStop.exitCode === null && processToStop.signalCode === null) processToStop.kill('SIGKILL');
      }, 5000);
      forceStop.unref?.();
    }
    return publicJob(job);
  },
  async setPaused(paused) {
    queuePaused = paused;
    await persistOptimizationJobs();
    if (!queuePaused) runNextJob();
  },
};

const featureRouter = composeFeatureRouters([
  createPlexRoutes(),
  createConnectionRoutes(),
  createMetadataRoutes(),
  createLibraryRoutes(),
  createUtilityRoutes(),
  createCompanionRoutes(automationEngine),
  createRecommendationRoutes(),
  createPlaylistRoutes(),
  createAutomationRoutes(automationEngine),
  createFutureLabRoutes(),
  createTelemetryRoutes(),
  createCommandDeckRoutes(),
  createDiscoveryRoutes(),
  createCodecRoutes(queueController),
]);

function requestContext(req, res, pathname) {
  return {
    req,
    res,
    pathname,
    json,
    body,
    envConfig,
    configDir,
    access,
    savedConfig,
    normalizeConfig,
    optimizationSettings,
    inspectPlex,
    plexFetch,
    plexCommand,
    plexDelete,
    libraryItems,
    overview,
    storageAnalysis,
    discoveryCatalog,
    discoveryRecommendations,
    runProcess,
    getJobs: () => [...jobs.values()].map(publicJob),
    invalidateCaches() {
      storageScanCache = null;
      discoveryCache = null;
    },
    async saveConfig(config) {
      await mkdir(configDir, { recursive: true });
      await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    },
  };
}

async function api(req, res, pathname) {
  try {
    if (pathname === '/api/health') return json(res, 200, { ok: true });
    if (await featureRouter(requestContext(req, res, pathname))) return;
    return json(res, 404, { error: 'Not found.' });
  } catch (error) {
    const message = error.cause?.code === 'ECONNREFUSED' ? 'Could not reach Plex at that address.' : error.message;
    return json(res, 400, { error: message || 'The request failed.' });
  }
}

async function serve(res, pathname) {
  let requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  let file = normalize(join(staticRoot, requested));
  if (!file.startsWith(staticRoot)) return json(res, 403, { error: 'Forbidden.' });
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const contents = await readFile(file);
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=604800',
    });
    res.end(contents);
  } catch {
    try {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(await readFile(join(staticRoot, 'index.html')));
    } catch {
      json(res, 503, { error: 'Frontend has not been built. Run npm run build.' });
    }
  }
}

await restoreOptimizationJobs();

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const artMatch = url.pathname.match(/^\/api\/art\/(\d+)$/);
  if (artMatch) return servePlexArt(res, artMatch[1]);
  if (url.pathname.startsWith('/api/')) return api(req, res, url.pathname);
  return serve(res, decodeURIComponent(url.pathname));
}).listen(port, '0.0.0.0', () => {
  console.log('Ultimate Plex Companion listening on http://0.0.0.0:' + port);
  runNextJob();
});
