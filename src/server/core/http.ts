import type { IncomingMessage, ServerResponse } from 'node:http';

const BODY_LIMIT = 16_384;

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self' https://fonts.gstatic.com",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    ].join('; '),
  );
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

export function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(value));
}

export async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const contentType = String(req.headers['content-type'] || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType && contentType !== 'application/json')
    throw new HttpError(415, 'This endpoint accepts application/json.', 'UNSUPPORTED_MEDIA_TYPE');

  const declaredSize = Number(req.headers['content-length'] || 0);
  if (declaredSize > BODY_LIMIT) throw new HttpError(413, 'Request body exceeds the 16 KB limit.', 'PAYLOAD_TOO_LARGE');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > BODY_LIMIT) throw new HttpError(413, 'Request body exceeds the 16 KB limit.', 'PAYLOAD_TOO_LARGE');
    chunks.push(buffer);
  }
  try {
    const raw = Buffer.concat(chunks).toString('utf8');
    const value = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new HttpError(400, 'Request body must be a JSON object.', 'INVALID_JSON_BODY');
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Request body contains invalid JSON.', 'INVALID_JSON_BODY');
  }
}

export function errorResponse(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof HttpError) return { status: error.status, body: { error: error.message, code: error.code } };
  const candidate = error as { message?: string; cause?: { code?: string }; code?: string };
  const connectionRefused = candidate?.cause?.code === 'ECONNREFUSED' || candidate?.code === 'ECONNREFUSED';
  return {
    status: connectionRefused ? 502 : 400,
    body: {
      error: connectionRefused ? 'Could not reach Plex at that address.' : candidate?.message || 'The request failed.',
      code: connectionRefused ? 'PLEX_UNAVAILABLE' : 'REQUEST_FAILED',
    },
  };
}
