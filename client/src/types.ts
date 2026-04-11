export interface BaseElement {
  id: string;
  type: 'video' | 'image' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoElement extends BaseElement {
  type: 'video';
  src: string;
  loop: boolean;
  autoplay: boolean;
  muted: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  cropTop?: number;    // 0-50%, how much to cut from top
  cropRight?: number;  // 0-50%
  cropBottom?: number; // 0-50%
  cropLeft?: number;   // 0-50%
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  color: string;
  bold: boolean;
}

export type SlideElement = VideoElement | ImageElement | TextElement;

/** Returns the visible rect after crop (or the full rect if no crop) */
export function getVisibleRect(el: SlideElement): { x: number; y: number; width: number; height: number } {
  if (el.type !== 'image' && el.type !== 'video') return el;
  const t = el.cropTop ?? 0;
  const r = el.cropRight ?? 0;
  const b = el.cropBottom ?? 0;
  const l = el.cropLeft ?? 0;
  if (t === 0 && r === 0 && b === 0 && l === 0) return el;
  return {
    x: el.x + el.width * l / 100,
    y: el.y + el.height * t / 100,
    width: el.width * (100 - l - r) / 100,
    height: el.height * (100 - t - b) / 100,
  };
}

export interface Slide {
  id: string;
  background: string;
  elements: SlideElement[];
}

export interface Presentation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
  ownerId?: string;
  anonymous?: true;
  editToken?: string;
  expiresAt?: string;
}

export interface PresentationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  ownerId?: string;
  anonymous?: true;
  expiresAt?: string;
}

// WebSocket messages
export type WsMessage =
  | { type: 'join'; presentationId: string }
  | { type: 'leave' }
  | { type: 'element:update'; slideId: string; element: SlideElement }
  | { type: 'element:add'; slideId: string; elements: SlideElement[] }
  | { type: 'element:delete'; slideId: string; elementIds: string[] }
  | { type: 'slide:add'; slide: Slide; index: number }
  | { type: 'slide:delete'; slideId: string }
  | { type: 'slide:reorder'; slideIds: string[] }
  | { type: 'title:update'; title: string };
