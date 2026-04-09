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
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  color: string;
  bold: boolean;
}

export type SlideElement = VideoElement | ImageElement | TextElement;

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
}

export interface PresentationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
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
