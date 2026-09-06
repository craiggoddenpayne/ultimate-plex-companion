import { createServer } from 'node:http';
import { constants as fsConstants } from 'node:fs';
import { readFile, stat, access, rename, unlink, mkdir } from 'node:fs/promises';
import { extname, join, dirname, basename, relative, resolve, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { composeFeatureRouters } from './core/router.ts';
import { createPlexClient } from './core/plex-client.ts';
import { normalizePlexConfig } from './core/validation.ts';
import { readJsonFile, writeJsonAtomic } from './core/atomic-json-store.ts';
import { applySecurityHeaders, errorResponse, readJsonBody, sendJson } from './core/http.ts';
import { resolveWithin } from './core/safe-path.ts';
import { contentTypeFor } from './core/static-files.ts';
import { createLogger } from './core/logger.ts';
import { friendlyConnectionError } from './core/errors.ts';
import { createAutomationRoutes } from './features/automations/routes.ts';
import { createCodecRoutes } from './features/codec-studio/routes.ts';
import { createCommandDeckRoutes } from './features/command-deck/routes.ts';
import { createCompanionRoutes } from './features/companion/routes.ts';
import { createConnectionRoutes } from './features/connection/routes.ts';
import { createDiscoveryRoutes } from './features/discovery/routes.ts';
import { buildDiscoveryRecommendations } from './features/discovery/discovery-recommendations.ts';
import { createDiagnosticsRoutes } from './features/diagnostics/routes.ts';
import { createFutureLabRoutes } from './features/future-lab/routes.ts';
import { createLibraryRoutes } from './features/library/routes.ts';
import { createMetadataRoutes } from './features/metadata/routes.ts';
import { createPlaylistRoutes } from './features/playlists/routes.ts';
import { createPlexRoutes } from './features/plex/routes.ts';
import { createRecommendationRoutes } from './features/recommendations/routes.ts';
import { createServerInfoRoutes } from './features/server-info/routes.ts';
import { createTelemetryRoutes } from './features/telemetry/routes.ts';
import { createUtilityRoutes } from './features/utility-suite/routes.ts';
import { createDataManagementRoutes } from './features/data-management/routes.ts';
import { createAutomationEngine } from './features/automations/automation-server.ts';
import { createOptimizationStore } from './features/codec-studio/optimization-store-server.ts';
import {
  optimizationEta,
  optimizationSummary,
  parseFfmpegProgress,
  removeOptimizationJob,
  requestOptimizationCancellation,
} from './features/codec-studio/optimization-queue-server.ts';
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
const logger = createLogger({ level: process.env.LOG_LEVEL });
const startupState: Record<string, unknown> = { complete: false, checks: {} };
const envConfig =
  process.env.PLEX_URL && process.env.PLEX_TOKEN
    ? { plexUrl: process.env.PLEX_URL, token: process.env.PLEX_TOKEN }
    : null;

const json = sendJson;
const body = readJsonBody;

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
      stored = await readJsonFile(configFile);
    } catch {}
    return { ...normalizeConfig(envConfig), optimization: optimizationSettings(stored) };
  }
  try {
    const raw = await readJsonFile(configFile);
    return { ...normalizeConfig(raw), optimization: optimizationSettings(raw) };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const plexClient = createPlexClient(fetch, logger.child({ component: 'plex' }));
const plexFetch = plexClient.fetchJson;
const plexCommand = plexClient.command;
const plexDelete = plexClient.deleteMedia;
const plexMedia = plexClient.media;

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
      includeAllStreams: '1',
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

async function discoveryCatalog(config, force = false) {
  if (!force && discoveryCache && Date.now() - discoveryCache.createdAt < 15 * 60_000) return discoveryCache.items;
  const sections = await plexFetch(config, '/library/sections');
  const libraries = (sections.MediaContainer?.Directory || []).filter((library) => library.type === 'movie');
  const items = (await Promise.all(libraries.map((library) => libraryItems(config, library)))).flat();
  discoveryCache = { createdAt: Date.now(), items };
  return items;
}

async function discoveryRecommendations(config, options) {
  const catalog = await discoveryCatalog(config, options.refresh === '1');
  return buildDiscoveryRecommendations(catalog, options);
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
  } catch (error) {
    logger.debug('artwork.proxy_failed', { ratingKey, error });
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
    logger.info('optimization.queue_restored', {
      jobs: restored.jobs.length,
      recovered: restored.recovered,
      paused: restored.paused,
    });
  } catch (error) {
    logger.error('optimization.queue_restore_failed', { error });
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
    'format=duration,size,format_name,bit_rate',
    '-show_entries',
    'stream=codec_type,codec_name,profile,width,height,pix_fmt,avg_frame_rate,channels,channel_layout,sample_rate',
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
    logger.info('optimization.started', { jobId: job.id, ratingKey: job.ratingKey, targetCodec: job.targetCodec });
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
    const sourceVideo = (source.streams || []).find((stream) => stream.codec_type === 'video') || {};
    const sourceStreams = (source.streams || []).reduce(
      (counts, stream) => ({ ...counts, [stream.codec_type]: (counts[stream.codec_type] || 0) + 1 }),
      {},
    );
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
      sourceTechnical: {
        container: source.format?.format_name || prepared.version.media.container || 'unknown',
        bitrate: Number(
          source.format?.bit_rate ||
            (prepared.version.media.bitrate ? Number(prepared.version.media.bitrate) * 1000 : 0),
        ),
        video: {
          codec: sourceVideo.codec_name || prepared.version.media.videoCodec || job.sourceCodec,
          profile: sourceVideo.profile || null,
          width: Number(sourceVideo.width || prepared.version.media.width || 0),
          height: Number(sourceVideo.height || prepared.version.media.height || 0),
          pixelFormat: sourceVideo.pix_fmt || null,
          frameRate: sourceVideo.avg_frame_rate || null,
        },
        streams: sourceStreams,
      },
      state: 'encoding',
      progress: 0,
      telemetry: {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await persistOptimizationJobs();
    if (job.cancelRequested)
      throw Object.assign(new Error('Optimization cancelled.'), { code: 'OPTIMIZATION_CANCELLED' });
    const encoderArguments = videoArguments(target.key, prepared.settings);
    const argumentValue = (name) => {
      const index = encoderArguments.indexOf(name);
      return index >= 0 ? encoderArguments[index + 1] : null;
    };
    job.encodingSettings = {
      encoder: target.encoder,
      crf: Number(argumentValue('-crf')),
      preset: argumentValue('-preset') || argumentValue('-deadline'),
      cpuUsed: argumentValue('-cpu-used'),
      container: 'Matroska',
      copiedStreams: ['audio', 'subtitles', 'chapters', 'metadata'],
    };
    await persistOptimizationJobs();
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
      ...encoderArguments,
      '-progress',
      'pipe:1',
      '-nostats',
      outputPath,
    ];
    let progressBuffer = '';
    try {
      await runProcess(
        'ffmpeg',
        args,
        (text) => {
          progressBuffer += text;
          const completeAt = progressBuffer.lastIndexOf('\n');
          if (completeAt < 0) return;
          const complete = progressBuffer.slice(0, completeAt + 1);
          progressBuffer = progressBuffer.slice(completeAt + 1);
          job.telemetry = {
            ...parseFfmpegProgress(complete, job.telemetry),
            sampledAt: new Date().toISOString(),
          };
          if (job.telemetry.encodedSeconds && duration)
            job.progress = Math.min(99, Math.round((job.telemetry.encodedSeconds / duration) * 100));
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
    logger.info('optimization.ready', {
      jobId: job.id,
      ratingKey: job.ratingKey,
      savingBytes: job.saving,
      savingPercent: job.savingPercent,
    });
  } catch (error) {
    if (job.cancelRequested || error.code === 'OPTIMIZATION_CANCELLED') {
      if (job.outputPath)
        await unlink(job.outputPath).catch((unlinkError) => {
          if (unlinkError.code !== 'ENOENT')
            logger.error('optimization.cancel_cleanup_failed', { jobId: job.id, error: unlinkError });
        });
      job.state = 'cancelled';
      job.progress = 0;
      job.cancelledAt = new Date().toISOString();
      job.updatedAt = job.cancelledAt;
      delete job.cancelRequested;
      delete job.error;
      delete job.startedAt;
      delete job.outputPath;
      logger.info('optimization.cancelled', { jobId: job.id, ratingKey: job.ratingKey });
    } else {
      job.state = 'failed';
      job.error = error.message;
      job.updatedAt = new Date().toISOString();
      logger.error('optimization.failed', { jobId: job.id, ratingKey: job.ratingKey, error });
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
  logger.info('optimization.queued', { jobId: job.id, ratingKey: job.ratingKey, targetCodec: target.key });
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
  logger.info('optimization.original_replaced', {
    jobId: job.id,
    ratingKey: job.ratingKey,
    reclaimedBytes: job.reclaimed,
  });
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
  logger: logger.child({ component: 'automations' }),
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
    logger.info('optimization.cancellation_requested', { jobId: job.id, state: job.state });
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
  async remove(id) {
    const job = removeOptimizationJob(jobs, id, activeJob);
    await persistOptimizationJobs();
    logger.info('optimization.removed', { jobId: job.id, ratingKey: job.ratingKey, previousState: job.state });
    runNextJob();
    return publicJob(job);
  },
  async setPaused(paused) {
    queuePaused = paused;
    await persistOptimizationJobs();
    logger.info('optimization.queue_pause_changed', { paused: queuePaused });
    if (!queuePaused) runNextJob();
  },
  summary() {
    return optimizationSummary(jobs, activeJob);
  },
  async clearAll() {
    const summary = optimizationSummary(jobs, activeJob);
    if (activeJob) throw new Error('Cancel or finish the active optimization before clearing application data.');
    jobs.clear();
    queuePaused = false;
    await persistOptimizationJobs();
    logger.warn('optimization.database_cleared', { jobs: summary.total });
    return summary;
  },
};

const featureRouter = composeFeatureRouters([
  createDiagnosticsRoutes(),
  createPlexRoutes(),
  createConnectionRoutes(),
  createMetadataRoutes(),
  createLibraryRoutes(),
  createUtilityRoutes(),
  createDataManagementRoutes({ queue: queueController, automations: automationEngine }),
  createCompanionRoutes(automationEngine),
  createRecommendationRoutes(),
  createServerInfoRoutes(),
  createPlaylistRoutes(),
  createAutomationRoutes(automationEngine),
  createFutureLabRoutes(),
  createTelemetryRoutes(),
  createCommandDeckRoutes(),
  createDiscoveryRoutes(),
  createCodecRoutes(queueController),
]);

function plexOrigin(config) {
  try {
    return new URL(config?.plexUrl || '').origin;
  } catch {
    return null;
  }
}

async function diagnosticSnapshot() {
  let config = null;
  let configError = null;
  try {
    config = await savedConfig();
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
  }
  const stateCounts = {};
  for (const job of jobs.values()) stateCounts[job.state] = (stateCounts[job.state] || 0) + 1;
  return {
    generatedAt: new Date().toISOString(),
    application: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
      logLevel: process.env.LOG_LEVEL || 'info',
    },
    setup: {
      ...startupState,
      configured: Boolean(config),
      configSource: envConfig ? 'environment' : config ? 'saved' : 'none',
      plexOrigin: plexOrigin(config),
      configError,
      optimization: config ? optimizationSettings(config) : optimizationSettings(),
    },
    queue: { paused: queuePaused, activeJob, jobs: jobs.size, stateCounts },
    logs: logger.entries(),
  };
}

function requestContext(req, res, pathname) {
  return {
    req,
    res,
    pathname,
    json,
    body,
    logger,
    diagnostics: diagnosticSnapshot,
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
    plexMedia,
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
      await writeJsonAtomic(configFile, config);
      logger.info('setup.configuration_saved', { plexOrigin: plexOrigin(config), source: 'saved' });
    },
  };
}

async function api(req, res, pathname, requestId) {
  try {
    if (pathname === '/api/health')
      return json(res, 200, {
        ok: true,
        status: shuttingDown ? 'stopping' : 'ready',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    if (await featureRouter(requestContext(req, res, pathname))) return;
    return json(res, 404, { error: 'Not found.' });
  } catch (error) {
    const response = errorResponse(error);
    const context = { requestId, method: req.method, path: pathname, status: response.status, error };
    if (response.status >= 500) logger.error('http.request_failed', context);
    else logger.warn('http.request_rejected', context);
    return json(res, response.status, response.body);
  }
}

async function serve(res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  let file = resolveWithin(staticRoot, requested);
  if (!file) return json(res, 403, { error: 'Forbidden.', code: 'PATH_OUTSIDE_STATIC_ROOT' });
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const contents = await readFile(file);
    res.writeHead(200, {
      'Content-Type': contentTypeFor(file),
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

async function runStartupDiagnostics() {
  logger.info('startup.begin', {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    pid: process.pid,
    port,
    configDir,
    staticRoot,
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  });
  const checks: Record<string, unknown> = {};
  startupState.checks = checks;
  try {
    await mkdir(configDir, { recursive: true, mode: 0o700 });
    await access(configDir, fsConstants.R_OK | fsConstants.W_OK);
    checks.dataDirectory = 'available';
    logger.info('startup.data_directory_ready', { configDir });
  } catch (error) {
    checks.dataDirectory = 'unavailable';
    logger.error('startup.data_directory_failed', { configDir, error });
  }
  try {
    await access(join(staticRoot, 'index.html'), fsConstants.R_OK);
    checks.frontend = 'available';
    logger.info('startup.frontend_ready', { staticRoot });
  } catch (error) {
    checks.frontend = 'missing';
    logger.error('startup.frontend_missing', { staticRoot, error });
  }
  for (const command of ['ffmpeg', 'ffprobe']) {
    try {
      const result = await runProcess(command, ['-version']);
      const version = String(result.stdout || result.stderr)
        .split('\n', 1)[0]
        .slice(0, 300);
      checks[command] = 'available';
      logger.info('startup.media_tool_ready', { command, version });
    } catch (error) {
      checks[command] = 'unavailable';
      logger.error('startup.media_tool_missing', { command, error });
    }
  }
  let config;
  try {
    config = await savedConfig();
    if (!config) {
      checks.plexConfiguration = 'missing';
      logger.warn('startup.plex_not_configured', {
        advice: 'Open Manage connection, or set both PLEX_URL and PLEX_TOKEN in Docker.',
      });
    } else {
      checks.plexConfiguration = 'available';
      logger.info('startup.plex_configuration_loaded', {
        source: envConfig ? 'environment' : 'saved',
        plexOrigin: plexOrigin(config),
        optimization: optimizationSettings(config),
      });
      const mediaSettings = optimizationSettings(config);
      try {
        await access(mediaSettings.mediaPathRoot, fsConstants.R_OK | fsConstants.W_OK);
        checks.mediaRoot = 'read-write';
        logger.info('startup.media_root_ready', { mediaPathRoot: mediaSettings.mediaPathRoot });
      } catch (error) {
        checks.mediaRoot = 'unavailable';
        logger.warn('startup.media_root_unavailable', {
          mediaPathRoot: mediaSettings.mediaPathRoot,
          plexPathRoot: mediaSettings.plexPathRoot,
          advice: 'Mount the media directory into Docker and ensure MEDIA_ROOT points to the container path.',
          error,
        });
      }
      if (!envConfig)
        try {
          const details = await stat(configFile);
          const permissions = details.mode & 0o777;
          checks.configPermissions = permissions === 0o600 ? 'private' : `mode-${permissions.toString(8)}`;
          if (permissions !== 0o600)
            logger.warn('startup.config_permissions_open', {
              mode: permissions.toString(8),
              advice: 'Expected config.json permissions to be 600.',
            });
        } catch (error) {
          logger.warn('startup.config_stat_failed', { error });
        }
    }
  } catch (error) {
    checks.plexConfiguration = 'invalid';
    logger.error('startup.plex_configuration_invalid', { configFile, error });
  }
  if (config)
    try {
      const serverInfo = await inspectPlex(config);
      checks.plexConnection = 'connected';
      startupState.plexServer = { name: serverInfo.name, version: serverInfo.version };
      logger.info('startup.plex_connected', { name: serverInfo.name, version: serverInfo.version });
    } catch (error) {
      checks.plexConnection = 'failed';
      logger.error('startup.plex_connection_failed', {
        plexOrigin: plexOrigin(config),
        advice: friendlyConnectionError(error),
        error,
      });
    }
  startupState.complete = true;
  logger.info('startup.diagnostics_complete', { checks });
}

await restoreOptimizationJobs();

const server = createServer(async (req, res) => {
  applySecurityHeaders(res);
  const requestId = randomUUID();
  const startedAt = performance.now();
  let requestPath = '/';
  res.setHeader('X-Request-ID', requestId);
  res.once('finish', () => {
    const context = {
      requestId,
      method: req.method,
      path: requestPath,
      status: res.statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    };
    if (requestPath === '/api/health') logger.debug('http.request_completed', context);
    else if (res.statusCode >= 500) logger.error('http.request_completed', context);
    else if (res.statusCode >= 400) logger.warn('http.request_completed', context);
    else logger.info('http.request_completed', context);
  });
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    requestPath = url.pathname;
    const artMatch = url.pathname.match(/^\/api\/art\/(\d+)$/);
    if (artMatch) return servePlexArt(res, artMatch[1]);
    if (url.pathname.startsWith('/api/')) return api(req, res, url.pathname, requestId);
    return serve(res, decodeURIComponent(url.pathname));
  } catch (error) {
    const response = errorResponse(error);
    logger.error('http.request_crashed', { requestId, method: req.method, path: requestPath, error });
    return json(res, response.status, response.body);
  }
});

server.listen(port, '0.0.0.0', () => {
  logger.info('startup.listening', { address: '0.0.0.0', port });
  runNextJob();
  void runStartupDiagnostics().catch((error) => logger.error('startup.diagnostics_failed', { error }));
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutdown.started', { signal, activeJob });
  if (activeOptimizationProcess?.exitCode === null) activeOptimizationProcess.kill('SIGTERM');
  server.close(() => {
    persistOptimizationJobs()
      .catch((error) => logger.error('shutdown.queue_persist_failed', { error }))
      .finally(() => process.exit(0));
  });
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', { error });
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (error) => {
  logger.error('process.unhandled_rejection', { error });
  shutdown('unhandledRejection');
});
