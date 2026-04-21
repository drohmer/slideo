// Minimal PPTX parser — extracts text, images, and positions.
// Skips silently: tables, charts, SmartArt, animations, masters/themes, group transforms.
// Designed for low-fidelity import from Google Slides → Slideo, not for round-tripping PowerPoint.

import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface ParsedRect {
  x: number;  // EMU
  y: number;  // EMU
  cx: number; // EMU width
  cy: number; // EMU height
}

export interface ParsedRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;  // points
  color?: string;     // RRGGBB hex (no #)
  fontFamily?: string;
}

export interface ParsedParagraph {
  runs: ParsedRun[];
  align?: 'left' | 'center' | 'right';
}

export interface ParsedTextElement {
  type: 'text';
  rect: ParsedRect;
  paragraphs: ParsedParagraph[];
}

export interface ParsedImageElement {
  type: 'image';
  rect: ParsedRect;
  /** PPTX media filename, e.g. "image1.png". Resolve against `media`. */
  mediaName: string;
  /**
   * If the picture has a hyperlink to a Google Drive video file
   * (drive.google.com/file/d/{ID}), this is the file ID. The converter
   * may try to download the file and produce a VideoElement instead.
   */
  driveVideoId?: string;
  /** Optional human-readable title from PPTX (often the original filename). */
  title?: string;
}

export type ParsedElement = ParsedTextElement | ParsedImageElement;

export interface ParsedSlide {
  elements: ParsedElement[];
  background?: { color?: string };
}

export interface ParsedPptx {
  slideSize: { cx: number; cy: number };  // EMU
  slides: ParsedSlide[];
  /** PPTX media filenames (e.g. "image1.png") → file Buffer */
  media: Map<string, Buffer>;
  /** Optional title from docProps/core.xml */
  title?: string;
}

export class PptxParseError extends Error {
  constructor(message: string) { super(message); }
}

const DEFAULT_SLIDE_SIZE = { cx: 9144000, cy: 6858000 }; // 16:9 default

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  // Always arrays for multi-occurrence elements so we don't need to defensively wrap.
  isArray: (name) => {
    // Tags that can occur multiple times under a single parent. p:sld is intentionally
    // NOT here — each slide XML has exactly one root <p:sld> element.
    return [
      'p:sp', 'p:pic', 'p:grpSp', 'p:graphicFrame',
      'a:p', 'a:r', 'a:br',
      'Relationship', 'p:sldId',
    ].includes(name);
  },
});

export async function parsePptx(buffer: Buffer): Promise<ParsedPptx> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new PptxParseError('Not a valid PPTX (zip) file');
  }

  // 1. Slide size + slide order
  const presentationXml = await readText(zip, 'ppt/presentation.xml');
  if (!presentationXml) throw new PptxParseError('Missing ppt/presentation.xml');
  const presParsed = xmlParser.parse(presentationXml);
  const presRoot = presParsed['p:presentation'];
  if (!presRoot) throw new PptxParseError('Invalid presentation root');

  const sldSz = presRoot['p:sldSz'];
  const slideSize = sldSz
    ? { cx: parseInt(sldSz['@_cx'], 10) || DEFAULT_SLIDE_SIZE.cx, cy: parseInt(sldSz['@_cy'], 10) || DEFAULT_SLIDE_SIZE.cy }
    : DEFAULT_SLIDE_SIZE;

  // 2. Slide order via presentation.xml.rels + sldIdLst
  const presRels = await readRels(zip, 'ppt/_rels/presentation.xml.rels');
  const sldIdLst = presRoot['p:sldIdLst'];
  const sldIds: Array<{ rId: string }> = [];
  if (sldIdLst && sldIdLst['p:sldId']) {
    for (const s of sldIdLst['p:sldId']) {
      const rId = s['@_r:id'] || s['@_id'];
      if (rId) sldIds.push({ rId });
    }
  }

  const slidePaths: string[] = [];
  for (const { rId } of sldIds) {
    const target = presRels.get(rId);
    if (!target) continue;
    // target is like "slides/slide1.xml" — relative to ppt/
    slidePaths.push(normalizePath('ppt/' + target));
  }

  // Fallback: discover slides by filename if presentation.xml.rels is incomplete
  if (slidePaths.length === 0) {
    zip.forEach((p) => {
      if (/^ppt\/slides\/slide\d+\.xml$/.test(p)) slidePaths.push(p);
    });
    slidePaths.sort((a, b) => slideNumber(a) - slideNumber(b));
  }

  // 3. Parse each slide
  const slides: ParsedSlide[] = [];
  for (const slidePath of slidePaths) {
    const xml = await readText(zip, slidePath);
    if (!xml) continue;
    const relsPath = slidePath.replace(/\/([^/]+)$/, '/_rels/$1.rels');
    const slideRels = await readRels(zip, relsPath);
    const slide = parseSlide(xml, slideRels);
    slides.push(slide);
  }

  // 4. Media: read all ppt/media/* into the map
  const media = new Map<string, Buffer>();
  const mediaFiles: string[] = [];
  zip.forEach((p) => {
    if (p.startsWith('ppt/media/')) mediaFiles.push(p);
  });
  for (const p of mediaFiles) {
    const f = zip.file(p);
    if (!f) continue;
    const ab = await f.async('nodebuffer');
    const name = p.substring('ppt/media/'.length);
    media.set(name, ab);
  }

  // 5. Optional title
  const coreXml = await readText(zip, 'docProps/core.xml');
  let title: string | undefined;
  if (coreXml) {
    const coreParsed = xmlParser.parse(coreXml);
    const cp = coreParsed['cp:coreProperties'];
    const t = cp?.['dc:title'];
    if (typeof t === 'string') title = t.trim() || undefined;
    else if (t && typeof t === 'object' && '#text' in t) title = String(t['#text']).trim() || undefined;
  }

  return { slideSize, slides, media, title };
}

// ---------- helpers ----------

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const f = zip.file(path);
  if (!f) return null;
  return await f.async('string');
}

async function readRels(zip: JSZip, path: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const xml = await readText(zip, path);
  if (!xml) return map;
  const parsed = xmlParser.parse(xml);
  const rels = parsed.Relationships?.Relationship;
  if (!rels) return map;
  for (const r of rels) {
    const id = r['@_Id'];
    const target = r['@_Target'];
    if (id && target) map.set(id, target);
  }
  return map;
}

function normalizePath(p: string): string {
  // Resolve "../" and "./" relative segments
  const parts: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function slideNumber(p: string): number {
  const m = /slide(\d+)\.xml$/.exec(p);
  return m ? parseInt(m[1], 10) : 0;
}

function parseSlide(xml: string, rels: Map<string, string>): ParsedSlide {
  const parsed = xmlParser.parse(xml);
  const sld = parsed['p:sld'];
  if (!sld) return { elements: [] };
  const cSld = sld['p:cSld'];
  if (!cSld) return { elements: [] };
  const spTree = cSld['p:spTree'];
  if (!spTree) return { elements: [] };

  const elements: ParsedElement[] = [];
  collectElementsFromTree(spTree, rels, elements);

  const background = parseBackground(cSld['p:bg']);
  return { elements, background };
}

function collectElementsFromTree(tree: any, rels: Map<string, string>, out: ParsedElement[]) {
  // Shapes (text)
  if (tree['p:sp']) {
    for (const sp of tree['p:sp']) {
      const el = parseShape(sp);
      if (el) out.push(el);
    }
  }
  // Pictures
  if (tree['p:pic']) {
    for (const pic of tree['p:pic']) {
      const el = parsePicture(pic, rels);
      if (el) out.push(el);
    }
  }
  // Groups: descend recursively (group transforms not applied — simplification)
  if (tree['p:grpSp']) {
    for (const grp of tree['p:grpSp']) {
      collectElementsFromTree(grp, rels, out);
    }
  }
  // Tables, charts, SmartArt: silently skipped
}

function parseShape(sp: any): ParsedTextElement | null {
  const txBody = sp['p:txBody'];
  if (!txBody) return null;
  const rect = parseXfrm(sp['p:spPr']?.['a:xfrm']);
  if (!rect) return null;

  const paragraphs: ParsedParagraph[] = [];
  const aps = txBody['a:p'];
  if (!aps) return null;
  for (const ap of aps) {
    const para = parseParagraph(ap);
    if (para) paragraphs.push(para);
  }
  if (paragraphs.length === 0 || paragraphs.every(p => p.runs.length === 0)) return null;

  return { type: 'text', rect, paragraphs };
}

function parseParagraph(ap: any): ParsedParagraph | null {
  const runs: ParsedRun[] = [];
  // pPr alignment (algn = "ctr" | "r" | "l" | "just")
  const algn = ap['a:pPr']?.['@_algn'];
  let align: 'left' | 'center' | 'right' | undefined;
  if (algn === 'ctr') align = 'center';
  else if (algn === 'r') align = 'right';
  else if (algn === 'l') align = 'left';

  const ars = ap['a:r'];
  if (ars) {
    for (const ar of ars) {
      const text = extractText(ar['a:t']);
      if (text === '') continue;
      const rPr = ar['a:rPr'];
      runs.push({
        text,
        bold: rPr?.['@_b'] === '1' || undefined,
        italic: rPr?.['@_i'] === '1' || undefined,
        fontSize: rPr?.['@_sz'] ? parseInt(rPr['@_sz'], 10) / 100 : undefined,
        color: extractColor(rPr?.['a:solidFill']),
        fontFamily: rPr?.['a:latin']?.['@_typeface'],
      });
    }
  }
  // Skip <a:br/> — paragraphs themselves are line breaks
  return { runs, align };
}

function parsePicture(pic: any, rels: Map<string, string>): ParsedImageElement | null {
  const rect = parseXfrm(pic['p:spPr']?.['a:xfrm']);
  if (!rect) return null;
  const blip = pic['p:blipFill']?.['a:blip'];
  const embedId = blip?.['@_r:embed'];
  if (!embedId) return null;
  const target = rels.get(embedId);
  if (!target) return null;
  const m = /(?:^|\/)media\/([^/]+)$/.exec(target);
  if (!m) return null;

  // Detect a Google Drive video link via <p:nvPicPr><p:cNvPr><a:hlinkClick r:id="..."/>
  // Google Slides renders embedded Drive videos as a static thumbnail picture with
  // this hyperlink — there is no <p:videoFile> tag in the export.
  const cNvPr = pic['p:nvPicPr']?.['p:cNvPr'];
  const linkId = cNvPr?.['a:hlinkClick']?.['@_r:id'];
  let driveVideoId: string | undefined;
  if (linkId) {
    const linkTarget = rels.get(linkId);
    if (linkTarget) {
      const driveMatch = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/.exec(linkTarget);
      if (driveMatch) driveVideoId = driveMatch[1];
    }
  }
  const title = cNvPr?.['@_title'] || undefined;

  return { type: 'image', rect, mediaName: m[1], driveVideoId, title };
}

function parseXfrm(xfrm: any): ParsedRect | null {
  if (!xfrm) return null;
  const off = xfrm['a:off'];
  const ext = xfrm['a:ext'];
  if (!off || !ext) return null;
  const x = parseInt(off['@_x'], 10);
  const y = parseInt(off['@_y'], 10);
  const cx = parseInt(ext['@_cx'], 10);
  const cy = parseInt(ext['@_cy'], 10);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  if (cx <= 0 || cy <= 0) return null;
  return { x, y, cx, cy };
}

function extractText(t: any): string {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  if (typeof t === 'object' && '#text' in t) return String(t['#text']);
  return String(t);
}

function extractColor(solidFill: any): string | undefined {
  if (!solidFill) return undefined;
  const srgb = solidFill['a:srgbClr'];
  if (srgb?.['@_val']) return String(srgb['@_val']).toUpperCase();
  return undefined;
}

function parseBackground(bg: any): { color?: string } | undefined {
  if (!bg) return undefined;
  const fill = bg['p:bgPr']?.['a:solidFill'];
  const color = extractColor(fill);
  return color ? { color } : undefined;
}
