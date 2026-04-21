// Shared SSRF protections for any server-side fetch of an external URL.
// Used by routes/uploads.ts (upload-url) and routes/presentations.ts (import-from-url).

export const PRIVATE_HOST_RE = /^(localhost|127\.|0\.0\.0\.0|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)/i;

export class SafeFetchError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface SafeFetchOptions {
  /** Allowed hostnames. Exact match (case-insensitive) or wildcard prefix `*.example.com` matching any subdomain. If omitted, only the SSRF blocklist applies. */
  allowedHosts?: string[];
  /** Hard byte cap on the downloaded body. */
  maxBytes: number;
  /** Network timeout (ms). */
  timeoutMs: number;
  /** Optional content-type prefixes. If omitted, any content-type is accepted. */
  allowedContentTypes?: string[];
  /** Number of 3xx redirects to follow. Each hop is re-validated against `allowedHosts` and the SSRF blocklist. Default 0 (any 3xx is rejected). */
  maxRedirects?: number;
}

function hostMatches(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase();
  for (const a of allowed) {
    const al = a.toLowerCase();
    if (al.startsWith('*.')) {
      const suffix = al.slice(1); // ".example.com"
      if (h.endsWith(suffix) && h.length > suffix.length) return true;
    } else if (h === al) {
      return true;
    }
  }
  return false;
}

export interface SafeFetchResult {
  buffer: Buffer;
  contentType: string;
  url: URL;
}

/**
 * Fetch an external URL with SSRF protections:
 * - http/https only
 * - blocks private IP ranges and loopback (RFC1918, link-local, IPv6 ULA, ::1, 127/8)
 * - optional hostname allowlist
 * - manual redirect handling (3xx is rejected to prevent redirect-based SSRF bypass)
 * - timeout + size cap
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  let currentUrl = rawUrl;
  let redirectsLeft = opts.maxRedirects ?? 0;
  let parsed: URL;
  let response: Response;

  while (true) {
    try { parsed = new URL(currentUrl); }
    catch { throw new SafeFetchError(400, 'invalidUrl', 'Invalid URL'); }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SafeFetchError(400, 'invalidProtocol', 'Only http/https allowed');
    }
    if (PRIVATE_HOST_RE.test(parsed.hostname)) {
      throw new SafeFetchError(400, 'privateHost', 'Private addresses not allowed');
    }
    if (opts.allowedHosts && !hostMatches(parsed.hostname, opts.allowedHosts)) {
      throw new SafeFetchError(400, 'hostNotAllowed', `Host not allowed: ${parsed.hostname}`);
    }

    try {
      response = await fetch(currentUrl, {
        signal: AbortSignal.timeout(opts.timeoutMs),
        redirect: 'manual',
      });
    } catch {
      throw new SafeFetchError(504, 'fetchFailed', 'Failed to reach URL');
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (redirectsLeft > 0 && location) {
        // Resolve relative redirects against the current URL, then re-validate at the top of the loop.
        currentUrl = new URL(location, currentUrl).toString();
        redirectsLeft--;
        continue;
      }
      throw new SafeFetchError(400, 'redirect', 'URL redirects are not allowed (security)');
    }
    break;
  }

  if (response.status === 401 || response.status === 403) {
    throw new SafeFetchError(403, 'forbidden', `Remote returned ${response.status}`);
  }
  if (!response.ok || !response.body) {
    throw new SafeFetchError(400, 'remoteError', `Remote returned ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (opts.allowedContentTypes && !opts.allowedContentTypes.some(p => contentType.startsWith(p))) {
    throw new SafeFetchError(400, 'badContentType', `Unexpected content-type: ${contentType}`);
  }

  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > opts.maxBytes) {
        await reader.cancel();
        throw new SafeFetchError(413, 'tooLarge', 'Response exceeds size limit');
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof SafeFetchError) throw e;
    throw new SafeFetchError(400, 'streamError', 'Stream read failed');
  }

  return { buffer: Buffer.concat(chunks), contentType, url: parsed };
}

/**
 * Stream an external URL directly to disk with the same SSRF protections.
 * Used when content can be very large (e.g. video uploads).
 */
export async function safeFetchToFile(rawUrl: string, filePath: string, opts: SafeFetchOptions & { writeStream: NodeJS.WritableStream }): Promise<{ contentType: string; bytesWritten: number; url: URL }> {
  let currentUrl = rawUrl;
  let redirectsLeft = opts.maxRedirects ?? 0;
  let parsed: URL;
  let response: Response;

  while (true) {
    try { parsed = new URL(currentUrl); }
    catch { throw new SafeFetchError(400, 'invalidUrl', 'Invalid URL'); }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SafeFetchError(400, 'invalidProtocol', 'Only http/https allowed');
    }
    if (PRIVATE_HOST_RE.test(parsed.hostname)) {
      throw new SafeFetchError(400, 'privateHost', 'Private addresses not allowed');
    }
    if (opts.allowedHosts && !hostMatches(parsed.hostname, opts.allowedHosts)) {
      throw new SafeFetchError(400, 'hostNotAllowed', `Host not allowed: ${parsed.hostname}`);
    }

    try {
      response = await fetch(currentUrl, {
        signal: AbortSignal.timeout(opts.timeoutMs),
        redirect: 'manual',
      });
    } catch {
      throw new SafeFetchError(504, 'fetchFailed', 'Failed to reach URL');
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (redirectsLeft > 0 && location) {
        currentUrl = new URL(location, currentUrl).toString();
        redirectsLeft--;
        continue;
      }
      throw new SafeFetchError(400, 'redirect', 'URL redirects are not allowed (security)');
    }
    break;
  }

  if (!response.ok || !response.body) {
    throw new SafeFetchError(400, 'remoteError', `Remote returned ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (opts.allowedContentTypes && !opts.allowedContentTypes.some(p => contentType.startsWith(p))) {
    throw new SafeFetchError(400, 'badContentType', `Unexpected content-type: ${contentType}`);
  }

  const writer = opts.writeStream;
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  let written = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      written += value.length;
      if (written > opts.maxBytes) {
        await reader.cancel();
        throw new SafeFetchError(413, 'tooLarge', 'Response exceeds size limit');
      }
      await new Promise<void>((ok, ko) => writer.write(value, e => e ? ko(e) : ok()));
    }
    await new Promise<void>((ok, ko) => {
      writer.end();
      writer.on('finish', ok);
      writer.on('error', ko);
    });
  } catch (e) {
    if (e instanceof SafeFetchError) throw e;
    throw new SafeFetchError(400, 'streamError', 'Stream read failed');
  }

  return { contentType, bytesWritten: written, url: parsed };
}
