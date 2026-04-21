// Convert a parsed PPTX into Slideo Slide[] structures.
// - EMU coordinates → canvas pixels
// - PPTX shapes → TextElement
// - PPTX pictures → ImageElement (after writing media to disk)
// - PPTX pictures with a Google Drive video hyperlink → VideoElement (after downloading from Drive)
// - Mixed bold/italic runs → HTML in TextElement.content (TipTap-compatible)

import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { ParsedPptx, ParsedTextElement, ParsedImageElement, ParsedRect } from './pptx-parser.js';
import { safeFetchToFile, SafeFetchError } from './ssrf.js';

// Mirror client/src/constants.ts CANVAS — kept inline to avoid a cross-package import.
const CANVAS = { WIDTH: 960, HEIGHT: 540 };

const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const VIDEO_FETCH_TIMEOUT_MS = 60_000;
const DRIVE_ALLOWED_HOSTS = ['drive.google.com', 'drive.usercontent.google.com', '*.googleusercontent.com'];

interface BaseElement { id: string; type: string; x: number; y: number; width: number; height: number; }
interface ImageElement extends BaseElement { type: 'image'; src: string; }
interface VideoElement extends BaseElement {
  type: 'video';
  src: string;
  loop: boolean;
  autoplay: boolean;
  muted: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
}
interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  color: string;
  bold: boolean;
  fontFamily?: string;
}
type SlideElement = ImageElement | VideoElement | TextElement;

interface Slide {
  id: string;
  background: string;
  elements: SlideElement[];
}

export interface ConvertOptions {
  /** Absolute path to /server/uploads/{presentationId}/ — already created by caller. */
  uploadDir: string;
  /** URL prefix for resulting `src` fields, e.g. "/uploads/{id}/" */
  uploadUrlPrefix: string;
  /**
   * Optional 1-based slide indices to keep. If omitted, all slides are converted.
   * Indices outside the deck are ignored.
   */
  slideIndices?: number[];
}

export interface FailedVideo {
  title: string;
  reason: string;
}

export interface ConvertResult {
  slides: Slide[];
  failedVideos: FailedVideo[];
}

export async function convertPptxToSlides(parsed: ParsedPptx, opts: ConvertOptions): Promise<ConvertResult> {
  const ratioX = CANVAS.WIDTH / parsed.slideSize.cx;
  const ratioY = CANVAS.HEIGHT / parsed.slideSize.cy;

  // Resolve which slides to keep (1-based input → 0-based indices into parsed.slides).
  const keepIndices = opts.slideIndices
    ? opts.slideIndices.map(i => i - 1).filter(i => i >= 0 && i < parsed.slides.length)
    : parsed.slides.map((_, i) => i);
  const keptSlides = keepIndices.map(i => parsed.slides[i]);

  // Determine which media files are referenced by the kept slides; only write those.
  const referencedMedia = new Set<string>();
  for (const ps of keptSlides) {
    for (const el of ps.elements) {
      if (el.type === 'image') referencedMedia.add(el.mediaName);
    }
  }

  const mediaUrls = new Map<string, string>();
  const baseTs = Date.now();
  let mediaCounter = 0;
  for (const [origName, buf] of parsed.media) {
    if (!referencedMedia.has(origName)) continue;
    const safeName = origName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${baseTs + mediaCounter++}-${safeName}`;
    const filePath = path.join(opts.uploadDir, filename);
    try {
      fs.writeFileSync(filePath, buf);
      mediaUrls.set(origName, opts.uploadUrlPrefix + filename);
    } catch {
      // Skip individual media that fail to write; the slide will simply omit the image.
    }
  }

  const failedVideos: FailedVideo[] = [];
  const slides: Slide[] = [];
  for (const ps of keptSlides) {
    const elements: SlideElement[] = [];
    for (const el of ps.elements) {
      if (el.type === 'text') {
        const t = convertText(el, ratioX, ratioY);
        if (t) elements.push(t);
      } else if (el.type === 'image') {
        const rect = emuRectToPx(el.rect, ratioX, ratioY);
        if (!rect) continue;

        if (el.driveVideoId) {
          const vid = await tryDownloadDriveVideo(el, rect, opts);
          if (vid.element) {
            elements.push(vid.element);
          } else {
            // Fallback to thumbnail image and report the failure
            failedVideos.push({
              title: el.title || el.driveVideoId,
              reason: vid.reason,
            });
            const img = imageFromMedia(el, rect, mediaUrls);
            if (img) elements.push(img);
          }
        } else {
          const img = imageFromMedia(el, rect, mediaUrls);
          if (img) elements.push(img);
        }
      }
    }
    slides.push({
      id: uuidv4(),
      background: ps.background?.color ? '#' + ps.background.color : '#ffffff',
      elements,
    });
  }

  // Ensure at least one (empty) slide so the editor has something to show.
  if (slides.length === 0) {
    slides.push({ id: uuidv4(), background: '#ffffff', elements: [] });
  }

  return { slides, failedVideos };
}

function convertText(el: ParsedTextElement, ratioX: number, ratioY: number): TextElement | null {
  const rect = emuRectToPx(el.rect, ratioX, ratioY);
  if (!rect) return null;

  const sizes: number[] = [];
  const colors: string[] = [];
  const fonts: string[] = [];
  let boldVotes = 0, totalVotes = 0;
  for (const p of el.paragraphs) {
    for (const r of p.runs) {
      totalVotes++;
      if (r.bold) boldVotes++;
      if (r.fontSize != null) sizes.push(r.fontSize);
      if (r.color) colors.push(r.color);
      if (r.fontFamily) fonts.push(r.fontFamily);
    }
  }
  const fontSize = sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 18;
  const color = colors.length ? '#' + mostCommon(colors) : '#000000';
  const fontFamily = fonts.length ? quoteFontFamily(mostCommon(fonts)) : 'Arial, sans-serif';
  const bold = totalVotes > 0 && boldVotes / totalVotes >= 0.5;

  const content = paragraphsToHtml(el);
  if (!content.trim()) return null;

  return {
    id: uuidv4(),
    type: 'text',
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    content, fontSize, color, bold, fontFamily,
  };
}

function imageFromMedia(el: ParsedImageElement, rect: { x: number; y: number; width: number; height: number }, mediaUrls: Map<string, string>): ImageElement | null {
  const src = mediaUrls.get(el.mediaName);
  if (!src) return null;
  return {
    id: uuidv4(),
    type: 'image',
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    src,
  };
}

async function tryDownloadDriveVideo(
  el: ParsedImageElement,
  rect: { x: number; y: number; width: number; height: number },
  opts: ConvertOptions,
): Promise<{ element: VideoElement | null; reason: string }> {
  const id = el.driveVideoId!;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;

  // Pick a stable filename from the PPTX title (when available) or the Drive ID.
  let baseName = el.title?.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || `${id}.mp4`;
  if (!/\.[a-z0-9]{2,5}$/i.test(baseName)) baseName += '.mp4';
  const filename = `${Date.now()}-${baseName}`;
  const filePath = path.join(opts.uploadDir, filename);
  const writer = fs.createWriteStream(filePath);

  try {
    const result = await safeFetchToFile(downloadUrl, filePath, {
      writeStream: writer,
      allowedHosts: DRIVE_ALLOWED_HOSTS,
      maxBytes: VIDEO_MAX_BYTES,
      timeoutMs: VIDEO_FETCH_TIMEOUT_MS,
      maxRedirects: 5,
      // Drive often returns application/octet-stream for non-mp4 (webm, mov, …).
      // The PPTX hyperlink already came from a Google Slides video embed, so we trust the source.
      allowedContentTypes: ['video/', 'application/octet-stream'],
    });

    void result;
    const element: VideoElement = {
      id: uuidv4(),
      type: 'video',
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      src: opts.uploadUrlPrefix + filename,
      // Google Slides videos are typically demo/loop clips. autoplay requires muted in browsers.
      loop: true,
      autoplay: true,
      muted: true,
    };
    return { element, reason: '' };
  } catch (e) {
    writer.destroy();
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    let reason = 'Téléchargement échoué';
    if (e instanceof SafeFetchError) {
      if (e.code === 'forbidden') reason = 'Vidéo non partagée publiquement';
      else if (e.code === 'tooLarge') reason = `Fichier > ${Math.round(VIDEO_MAX_BYTES / 1024 / 1024)} MB`;
      else if (e.code === 'badContentType') reason = 'Le fichier Drive n\'est pas une vidéo';
      else reason = e.message;
    }
    return { element: null, reason };
  }
}

function emuRectToPx(rect: ParsedRect, ratioX: number, ratioY: number): { x: number; y: number; width: number; height: number } | null {
  const x = Math.round(rect.x * ratioX);
  const y = Math.round(rect.y * ratioY);
  const width = Math.round(rect.cx * ratioX);
  const height = Math.round(rect.cy * ratioY);
  if (width < 4 || height < 4) return null;
  if (x < -CANVAS.WIDTH || y < -CANVAS.HEIGHT) return null;
  if (x > CANVAS.WIDTH * 2 || y > CANVAS.HEIGHT * 2) return null;
  return { x, y, width, height };
}

function paragraphsToHtml(el: ParsedTextElement): string {
  const parts: string[] = [];
  for (const p of el.paragraphs) {
    if (p.runs.length === 0) {
      parts.push('<p></p>');
      continue;
    }
    const inner = p.runs.map(r => {
      let html = escapeHtml(r.text);
      if (r.italic) html = `<em>${html}</em>`;
      if (r.bold) html = `<strong>${html}</strong>`;
      return html;
    }).join('');
    const align = p.align && p.align !== 'left' ? ` style="text-align:${p.align}"` : '';
    parts.push(`<p${align}>${inner}</p>`);
  }
  return parts.join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mostCommon<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = arr[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best;
}

function quoteFontFamily(name: string): string {
  const needsQuotes = /\s/.test(name);
  const quoted = needsQuotes ? `"${name.replace(/"/g, '\\"')}"` : name;
  return `${quoted}, Arial, sans-serif`;
}
