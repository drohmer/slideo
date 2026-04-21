import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import { getVisibleRect, type Slide, type SlideElement, type VideoElement, type ImageElement, type Stroke, type ShapeElement } from '../../types';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { uploadFile } from '../../api';
import { VideoEl } from '../Elements/VideoElement';
import { ImageEl } from '../Elements/ImageElement';
import { TextEl } from '../Elements/TextElement';
import { DrawingEl } from '../Elements/DrawingElement';
import { ShapeEl } from '../Elements/ShapeElement';
import { ElementToolbar } from './ElementToolbar';
import { DraggableElement } from './DraggableElement';
import { useI18n } from '../../i18n';
import { CANVAS, ZOOM, SNAP, MEDIA } from '../../constants';

// --- Group resize ---
type GroupResizeDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const GR_HANDLE_SIZE = 12;

const GR_CURSORS: Record<GroupResizeDir, string> = {
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  nw: 'nwse-resize', se: 'nwse-resize',
};

const GR_DIRS: { dir: GroupResizeDir; style: React.CSSProperties }[] = [
  { dir: 'nw', style: { top: -GR_HANDLE_SIZE / 2, left: -GR_HANDLE_SIZE / 2 } },
  { dir: 'ne', style: { top: -GR_HANDLE_SIZE / 2, right: -GR_HANDLE_SIZE / 2 } },
  { dir: 'se', style: { bottom: -GR_HANDLE_SIZE / 2, right: -GR_HANDLE_SIZE / 2 } },
  { dir: 'sw', style: { bottom: -GR_HANDLE_SIZE / 2, left: -GR_HANDLE_SIZE / 2 } },
  { dir: 'n',  style: { top: -GR_HANDLE_SIZE / 2, left: '50%', marginLeft: -GR_HANDLE_SIZE / 2 } },
  { dir: 's',  style: { bottom: -GR_HANDLE_SIZE / 2, left: '50%', marginLeft: -GR_HANDLE_SIZE / 2 } },
  { dir: 'e',  style: { right: -GR_HANDLE_SIZE / 2, top: '50%', marginTop: -GR_HANDLE_SIZE / 2 } },
  { dir: 'w',  style: { left: -GR_HANDLE_SIZE / 2, top: '50%', marginTop: -GR_HANDLE_SIZE / 2 } },
];

const GR_MIN_EL_SIZE = 20;

interface GrResizeState {
  dir: GroupResizeDir;
  origBbox: { x: number; y: number; w: number; h: number };
  origEls: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  startClientX: number;
  startClientY: number;
}

function computeGroupResize(
  state: GrResizeState,
  clientX: number,
  clientY: number,
  zoom: number,
): Map<string, { x: number; y: number; width: number; height: number }> {
  const { dir, origBbox, origEls, startClientX, startClientY } = state;
  const dx = (clientX - startClientX) / zoom;
  const dy = (clientY - startClientY) / zoom;

  const hasX = dir.includes('e') || dir.includes('w');
  const hasY = dir.includes('n') || dir.includes('s');

  let newW = origBbox.w;
  let newH = origBbox.h;
  if (dir.includes('e')) newW = Math.max(GR_MIN_EL_SIZE, origBbox.w + dx);
  if (dir.includes('w')) newW = Math.max(GR_MIN_EL_SIZE, origBbox.w - dx);
  if (dir.includes('s')) newH = Math.max(GR_MIN_EL_SIZE, origBbox.h + dy);
  if (dir.includes('n')) newH = Math.max(GR_MIN_EL_SIZE, origBbox.h - dy);

  const scaleX = newW / origBbox.w;
  const scaleY = newH / origBbox.h;

  const anchorX = dir.includes('w') ? origBbox.x + origBbox.w : origBbox.x;
  const anchorY = dir.includes('n') ? origBbox.y + origBbox.h : origBbox.y;

  const overrides = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const el of origEls) {
    overrides.set(el.id, {
      x:      hasX ? anchorX + (el.x - anchorX) * scaleX : el.x,
      y:      hasY ? anchorY + (el.y - anchorY) * scaleY : el.y,
      width:  hasX ? Math.max(GR_MIN_EL_SIZE, el.width  * scaleX) : el.width,
      height: hasY ? Math.max(GR_MIN_EL_SIZE, el.height * scaleY) : el.height,
    });
  }
  return overrides;
}

interface Props {
  slide: Slide;
  presentationId: string;
  selectedIds: Set<string>;
  editingId: string | null;
  onSelectElement: (id: string | null, shiftKey?: boolean) => void;
  onSelectMultiple: (ids: string[]) => void;
  onUpdateElements: (elements: SlideElement[]) => void;
  onUpdateElement: (element: SlideElement) => void;
  onUpdateMultiple: (elements: SlideElement[]) => void;
  onMoveGroup: (draggedId: string, dx: number, dy: number) => void;
  onStartEditing: (id: string) => void;
  onStopEditing: () => void;
  onEditorReady: (editor: TiptapEditor | null) => void;
  previewPositions?: Array<{ id: string; x: number; y: number; width: number; height: number }> | null;
  croppingId: string | null;
  onStartCropping: (id: string) => void;
  onCommitCrop: () => void;
  onDeleteSelected: () => void;
  activeEditor: TiptapEditor | null;
  onToggleBoldItalic: (key: string) => void;
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  drawingMode?: boolean;
  drawingColor?: string;
  drawingWidth?: number;
  onDrawingComplete?: (strokes: Stroke[], bounds: { x: number; y: number; width: number; height: number }) => void;
  shapeMode?: 'segment' | 'rect' | 'ellipse' | null;
  shapeColor?: string;
  shapeStrokeWidth?: number;
  shapeFill?: string;
  shapeHasArrow?: boolean;
  onShapeComplete?: (type: 'segment' | 'rect' | 'ellipse', p1: { x: number; y: number }, p2: { x: number; y: number }) => void;
}

const CANVAS_WIDTH = CANVAS.WIDTH;
const CANVAS_HEIGHT = CANVAS.HEIGHT;
const MIN_ZOOM = ZOOM.MIN;
const MAX_ZOOM = ZOOM.MAX;
const ZOOM_STEP = ZOOM.STEP;

function probeVideoDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const timeout = setTimeout(() => { video.remove(); resolve({ width: 1920, height: 1080 }); }, 10000);
    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve({ width: video.videoWidth || 1920, height: video.videoHeight || 1080 });
      video.remove();
    };
    video.onerror = () => { clearTimeout(timeout); video.remove(); resolve({ width: 1920, height: 1080 }); };
    video.src = src;
  });
}

function probeImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => resolve({ width: 300, height: 200 }), 10000);
    img.onload = () => {
      clearTimeout(timeout);
      resolve({ width: img.naturalWidth || 300, height: img.naturalHeight || 200 });
    };
    img.onerror = () => { clearTimeout(timeout); resolve({ width: 300, height: 200 }); };
    img.src = src;
  });
}

function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function SlideCanvas({
  slide, presentationId, selectedIds, editingId, onSelectElement, onSelectMultiple, onUpdateElements, onUpdateElement, onUpdateMultiple, onMoveGroup, onStartEditing, onStopEditing, onEditorReady, previewPositions, croppingId, onStartCropping, onCommitCrop, onDeleteSelected, activeEditor, onToggleBoldItalic, videoRefs,
  drawingMode, drawingColor = '#000000', drawingWidth = 3, onDrawingComplete,
  shapeMode, shapeColor = '#000000', shapeStrokeWidth = 2, shapeFill = 'transparent', shapeHasArrow = false, onShapeComplete,
}: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapGuides, setSnapGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Cache of video natural aspect ratios (keyed by element id)
  const videoARCache = useRef<Map<string, number>>(new Map());
  const probedIds = useRef<Set<string>>(new Set());
  const onUpdateElementRef = useRef(onUpdateElement);
  onUpdateElementRef.current = onUpdateElement;

  // Probe natural dimensions for video elements that don't have them stored
  useEffect(() => {
    for (const el of slide.elements) {
      if (el.type === 'video' && !el.naturalWidth && !probedIds.current.has(el.id)) {
        probedIds.current.add(el.id);
        probeVideoDimensions(el.src).then(dims => {
          videoARCache.current.set(el.id, dims.width / dims.height);
          onUpdateElementRef.current({ ...el, naturalWidth: dims.width, naturalHeight: dims.height });
        });
      }
    }
  }, [slide.elements]);

  const getVideoAR = useCallback((el: SlideElement): number | null => {
    if (el.type !== 'video') return null;
    if (el.naturalWidth && el.naturalHeight) return el.naturalWidth / el.naturalHeight;
    return videoARCache.current.get(el.id) ?? null;
  }, []);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [liveTextScale, setLiveTextScale] = useState<{ id: string; scale: number } | null>(null);
  // Live drag offset for group movement and outline tracking
  const [groupDragOffset, setGroupDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const [liveDragDelta, setLiveDragDelta] = useState<{ id: string; dx: number; dy: number } | null>(null);
  // Group resize
  const [groupResizeOverrides, setGroupResizeOverrides] =
    useState<Map<string, { x: number; y: number; width: number; height: number }> | null>(null);
  const groupResizeRef = useRef<GrResizeState | null>(null);

  // Alt key toggles snap
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Alt') { e.preventDefault(); setSnapEnabled(s => !s); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const SNAP_THRESHOLD = SNAP.THRESHOLD;
  const CANVAS_W = CANVAS_WIDTH;
  const CANVAS_H = CANVAS_HEIGHT;

  // Snap function: finds nearest edges/centers of other elements + canvas bounds
  const makeSnapFn = useCallback((draggedId: string) => {
    if (!snapEnabled) return undefined;
    return (px: number, py: number, pw: number, ph: number) => {
      const others = slide.elements.filter(el => el.id !== draggedId);
      const guidesX: number[] = [0, CANVAS_W / 2, CANVAS_W]; // canvas edges + center
      const guidesY: number[] = [0, CANVAS_H / 2, CANVAS_H];
      for (const el of others) {
        const v = getVisibleRect(el);
        guidesX.push(v.x, v.x + v.width / 2, v.x + v.width);
        guidesY.push(v.y, v.y + v.height / 2, v.y + v.height);
      }
      // Points to snap: left, center, right of dragged element
      const myXs = [px, px + pw / 2, px + pw];
      const myYs = [py, py + ph / 2, py + ph];

      let bestDx = 0, bestDistX = SNAP_THRESHOLD + 1;
      let bestDy = 0, bestDistY = SNAP_THRESHOLD + 1;
      const activeGuidesX: number[] = [];
      const activeGuidesY: number[] = [];

      for (const mx of myXs) {
        for (const gx of guidesX) {
          const dist = Math.abs(mx - gx);
          if (dist < bestDistX) { bestDistX = dist; bestDx = gx - mx; }
        }
      }
      for (const my of myYs) {
        for (const gy of guidesY) {
          const dist = Math.abs(my - gy);
          if (dist < bestDistY) { bestDistY = dist; bestDy = gy - my; }
        }
      }

      const sx = bestDistX <= SNAP_THRESHOLD ? px + bestDx : px;
      const sy = bestDistY <= SNAP_THRESHOLD ? py + bestDy : py;

      // Collect active guides for visualization
      if (bestDistX <= SNAP_THRESHOLD) {
        for (const mx of [sx, sx + pw / 2, sx + pw]) {
          for (const gx of guidesX) { if (Math.abs(mx - gx) < 1) activeGuidesX.push(gx); }
        }
      }
      if (bestDistY <= SNAP_THRESHOLD) {
        for (const my of [sy, sy + ph / 2, sy + ph]) {
          for (const gy of guidesY) { if (Math.abs(my - gy) < 1) activeGuidesY.push(gy); }
        }
      }

      setSnapGuides({ x: [...new Set(activeGuidesX)], y: [...new Set(activeGuidesY)] });
      return { x: sx, y: sy };
    };
  }, [snapEnabled, slide.elements]);
  const draggingIdRef = useRef<string | null>(null);

  // Group resize callback
  const handleGroupResizePointerDown = useCallback(
    (dir: GroupResizeDir) => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const origEls = slide.elements
        .filter(el => selectedIds.has(el.id))
        .map(el => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }));

      const bboxX = Math.min(...origEls.map(el => el.x));
      const bboxY = Math.min(...origEls.map(el => el.y));
      const bboxMaxX = Math.max(...origEls.map(el => el.x + el.width));
      const bboxMaxY = Math.max(...origEls.map(el => el.y + el.height));

      groupResizeRef.current = {
        dir,
        origBbox: { x: bboxX, y: bboxY, w: bboxMaxX - bboxX, h: bboxMaxY - bboxY },
        origEls,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };

      const onMove = (ev: PointerEvent) => {
        const state = groupResizeRef.current;
        if (!state) return;
        setGroupResizeOverrides(computeGroupResize(state, ev.clientX, ev.clientY, zoom));
      };

      const onUp = (ev: PointerEvent) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const state = groupResizeRef.current;
        if (!state) return;
        groupResizeRef.current = null;
        const overrides = computeGroupResize(state, ev.clientX, ev.clientY, zoom);
        setGroupResizeOverrides(null);
        const updatedEls = slide.elements
          .filter(el => selectedIds.has(el.id))
          .map(el => {
            const o = overrides.get(el.id);
            if (!o) return el;
            const base = { ...el, x: o.x, y: o.y, width: o.width, height: o.height };
            if (el.type === 'text') {
              return { ...base, fontSize: Math.max(8, Math.round(el.fontSize * (o.width / el.width))) };
            }
            return base;
          });
        onUpdateMultiple(updatedEls);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [slide.elements, selectedIds, zoom, onUpdateMultiple],
  );

  // Marquee selection state
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const isMarquee = useRef(false);
  const marqueeStart = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(prev => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((prev + delta) * 100) / 100));
      });
    }
  }, []);

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }, [zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Ctrl/Cmd + click = panning
    if ((e.ctrlKey || e.metaKey) && e.button === 0) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }
  }, [pan]);

  const startMarquee = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) return; // panning takes priority
    if (e.button !== 0) return;
    // Only start on background clicks (not on child elements like Rnd, buttons, etc.)
    if (e.target !== e.currentTarget) return;

    e.preventDefault();
    const pos = screenToCanvas(e.clientX, e.clientY);
    isMarquee.current = true;
    marqueeStart.current = pos;
    const m = { x: pos.x, y: pos.y, w: 0, h: 0 };
    marqueeRef.current = m;
    setMarquee(m);
    onSelectElement(null); // deselect all on marquee start
  }, [screenToCanvas, onSelectElement]);

  const handleMarqueeMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = screenToCanvas(e.clientX, e.clientY);
    const sx = marqueeStart.current.x;
    const sy = marqueeStart.current.y;
    const m = {
      x: Math.min(sx, pos.x),
      y: Math.min(sy, pos.y),
      w: Math.abs(pos.x - sx),
      h: Math.abs(pos.y - sy),
    };
    marqueeRef.current = m;
    setMarquee(m);
    // Live-select elements that intersect the marquee
    if (m.w > 5 && m.h > 5) {
      const hits = slide.elements.filter(el => {
        const v = getVisibleRect(el);
        return rectsIntersect(m, { x: v.x, y: v.y, w: v.width, h: v.height });
      });
      onSelectMultiple(hits.map(el => el.id));
    }
  }, [screenToCanvas, slide.elements, onSelectMultiple]);

  const handleMarqueeMouseUp = useCallback(() => {
    isMarquee.current = false;
    marqueeRef.current = null;
    setMarquee(null);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
      return;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isPanning.current) {
      isPanning.current = false;
      return;
    }
  }, []);

  const onDrop = useCallback(async (files: File[]) => {
    const newElements: SlideElement[] = [...slide.elements];

    for (const file of files) {
      const result = await uploadFile(presentationId, file);
      const isVideo = file.type.startsWith('video/');
      const id = crypto.randomUUID();

      if (isVideo) {
        const dims = await probeVideoDimensions(result.path);
        const el: VideoElement = {
          id, type: 'video', src: result.path,
          x: 50, y: 50, width: 480, height: 270,
          loop: true, autoplay: true, muted: true,
          naturalWidth: dims.width, naturalHeight: dims.height,
        };
        newElements.push(el);
      } else {
        const dims = await probeImageDimensions(result.path);
        const maxSide = 400;
        const scale = Math.min(maxSide / dims.width, maxSide / dims.height, 1);
        const el: ImageElement = {
          id, type: 'image', src: result.path,
          x: 50, y: 50,
          width: Math.round(dims.width * scale),
          height: Math.round(dims.height * scale),
        };
        newElements.push(el);
      }
    }
    onUpdateElements(newElements);
  }, [slide.elements, presentationId, onUpdateElements]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: { 'video/*': [], 'image/*': [] },
  });

  const renderElement = (el: SlideElement) => {
    const isSelected = selectedIds.has(el.id);
    switch (el.type) {
      case 'video': return <VideoEl element={el} editMode background={slide.background} videoRefs={videoRefs} />;
      case 'image': return <ImageEl element={el} />;
      case 'text': {
        const scaleOverride = liveTextScale?.id === el.id ? liveTextScale.scale : undefined;
        const displayEl = scaleOverride ? { ...el, fontSize: Math.max(8, Math.round(el.fontSize * scaleOverride)) } : el;
        const isEditing = editingId === el.id;
        return (
          <TextEl
            element={displayEl}
            onUpdate={onUpdateElement}
            editing={isEditing}
            onStopEditing={onStopEditing}
            onEditorReady={onEditorReady}
          />
        );
      }
      case 'drawing':
        return (
          <DrawingEl
            element={el}
            isEditing={editingId === el.id}
            onUpdate={onUpdateElement}
          />
        );
      case 'shape':
        return <ShapeEl element={el as ShapeElement} />;
    }
  };

  // === Free drawing mode state ===
  const [freeStrokes, setFreeStrokes] = useState<Array<{ points: Array<{ x: number; y: number }>; color: string; width: number }>>([]);
  const [freeCurrentStroke, setFreeCurrentStroke] = useState<{ points: Array<{ x: number; y: number }>; color: string; width: number } | null>(null);
  const freeDrawing = useRef(false);

  const getCanvasPoint = useCallback((e: React.PointerEvent) => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return { x: 0, y: 0 };
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }, [zoom]);

  const handleFreePointerDown = useCallback((e: React.PointerEvent) => {
    if (!drawingMode) return;
    e.stopPropagation();
    e.preventDefault();
    freeDrawing.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    setFreeCurrentStroke({ points: [pt], color: drawingColor, width: drawingWidth });
  }, [drawingMode, getCanvasPoint, drawingColor, drawingWidth]);

  const handleFreePointerMove = useCallback((e: React.PointerEvent) => {
    if (!freeDrawing.current || !freeCurrentStroke) return;
    e.stopPropagation();
    const pt = getCanvasPoint(e);
    setFreeCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pt] } : prev);
  }, [getCanvasPoint, freeCurrentStroke]);

  const handleFreePointerUp = useCallback((e: React.PointerEvent) => {
    if (!freeDrawing.current || !freeCurrentStroke) return;
    e.stopPropagation();
    freeDrawing.current = false;
    if (freeCurrentStroke.points.length > 1) {
      setFreeStrokes(prev => [...prev, freeCurrentStroke]);
    }
    setFreeCurrentStroke(null);
  }, [freeCurrentStroke]);

  // Finalize free drawing: compute bounds, normalize points, create element
  const finalizeFreeDrawing = useCallback(() => {
    if (freeStrokes.length === 0) return;
    const allPts = freeStrokes.flatMap(s => s.points);
    const padding = 10;
    const minX = Math.min(...allPts.map(p => p.x)) - padding;
    const minY = Math.min(...allPts.map(p => p.y)) - padding;
    const maxX = Math.max(...allPts.map(p => p.x)) + padding;
    const maxY = Math.max(...allPts.map(p => p.y)) + padding;
    const w = Math.max(maxX - minX, 20);
    const h = Math.max(maxY - minY, 20);
    // Store points as pixel offsets from bounding box origin
    const normalized: Stroke[] = freeStrokes.map(s => ({
      color: s.color,
      width: s.width,
      points: s.points.map(p => ({ x: p.x - minX, y: p.y - minY })),
    }));
    onDrawingComplete?.(normalized, { x: minX, y: minY, width: w, height: h });
    setFreeStrokes([]);
    setFreeCurrentStroke(null);
  }, [freeStrokes, onDrawingComplete]);

  // When drawingMode is turned off, finalize any pending strokes
  useEffect(() => {
    if (!drawingMode && freeStrokes.length > 0) {
      finalizeFreeDrawing();
    }
  }, [drawingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // === Shape drawing mode state ===
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [shapeCurrent, setShapeCurrent] = useState<{ x: number; y: number } | null>(null);
  const shapeDrawing = useRef(false);

  const handleShapePointerDown = useCallback((e: React.PointerEvent) => {
    if (!shapeMode) return;
    e.stopPropagation();
    e.preventDefault();
    shapeDrawing.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    setShapeStart(pt);
    setShapeCurrent(pt);
  }, [shapeMode, getCanvasPoint]);

  const handleShapePointerMove = useCallback((e: React.PointerEvent) => {
    if (!shapeDrawing.current || !shapeMode) return;
    e.stopPropagation();
    setShapeCurrent(getCanvasPoint(e));
  }, [shapeMode, getCanvasPoint]);

  const handleShapePointerUp = useCallback((e: React.PointerEvent) => {
    if (!shapeDrawing.current || !shapeStart || !shapeMode) return;
    e.stopPropagation();
    shapeDrawing.current = false;
    const pt = getCanvasPoint(e);
    onShapeComplete?.(shapeMode, shapeStart, pt);
    setShapeStart(null);
    setShapeCurrent(null);
  }, [shapeMode, shapeStart, getCanvasPoint, onShapeComplete]);

  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 16, overflow: 'hidden', position: 'relative',
        cursor: (drawingMode || shapeMode) ? 'crosshair' : (isPanning.current ? 'grabbing' : undefined),
      }}
      onWheel={handleWheel}
      onMouseDown={(e) => {
        handleMouseDown(e);
        startMarquee(e);
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSelectElement(null);
        }
      }}
    >
      {/* Zoom controls — floating bottom-right */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12, zIndex: 300,
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'var(--surface)', borderRadius: 6,
        padding: '3px 8px', boxShadow: 'var(--shadow)',
        fontSize: 11, color: 'var(--text)',
      }}>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100))} style={zoomBtnStyle}>−</button>
        <span style={{ minWidth: 36, textAlign: 'center', opacity: 0.6 }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))} style={zoomBtnStyle}>+</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...zoomBtnStyle, opacity: zoom === 1 ? 0.3 : 1, marginLeft: 2 }}>Reset</button>
        <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px' }} />
        <button
          onClick={() => setSnapEnabled(s => !s)}
          title={snapEnabled ? t('snapOn') + ' (Alt)' : t('snapOff') + ' (Alt)'}
          style={{ ...zoomBtnStyle, opacity: snapEnabled ? 1 : 0.3 }}
        >
          ⊞
        </button>
      </div>

      {/* Canvas wrapper with zoom + pan */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isPanning.current ? 'none' : 'transform 0.1s ease-out',
        }}
        onMouseDown={startMarquee}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelectElement(null);
          }
        }}
      >
        <div
          {...getRootProps()}
          ref={canvasRef}
          onMouseDown={startMarquee}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onSelectElement(null);
            }
          }}
          style={{
            width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
            background: slide.background, borderRadius: 4, position: 'relative',
            overflow: 'visible',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            border: isDragActive ? '2px dashed var(--accent)' : '2px solid transparent',
            cursor: isMarquee.current ? 'crosshair' : undefined,
          }}
        >
          <input {...getInputProps()} />

          {isDragActive && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent-light)', borderRadius: 4, zIndex: 100,
              fontSize: 16, color: 'var(--accent)', pointerEvents: 'none',
            }}>
              {t('dropFiles')}
            </div>
          )}

          {/* Marquee overlay — captures all mouse events, extends far beyond canvas */}
          {marquee && (
            <div
              style={{
                position: 'absolute',
                left: -5000, top: -5000,
                width: 10000 + CANVAS_WIDTH, height: 10000 + CANVAS_HEIGHT,
                zIndex: 199, cursor: 'crosshair',
              }}
              onMouseMove={handleMarqueeMouseMove}
              onMouseUp={handleMarqueeMouseUp}
            />
          )}

          {/* Marquee selection rectangle */}
          {marquee && marquee.w > 2 && marquee.h > 2 && (
            <div style={{
              position: 'absolute',
              left: marquee.x, top: marquee.y,
              width: marquee.w, height: marquee.h,
              background: 'var(--accent-light)',
              border: '1px solid var(--accent-mid)',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 200,
            }} />
          )}

          {/* Group bounding box + resize handles */}
          {selectedIds.size > 1 && !drawingMode && !shapeMode && !croppingId && (() => {
            const selectedEls = slide.elements.filter(el => selectedIds.has(el.id));
            if (selectedEls.length < 2) return null;

            let minX: number, minY: number, maxX: number, maxY: number;
            if (groupResizeOverrides) {
              const rects = selectedEls.map(el =>
                groupResizeOverrides.get(el.id) ?? { x: el.x, y: el.y, width: el.width, height: el.height }
              );
              minX = Math.min(...rects.map(r => r.x));
              minY = Math.min(...rects.map(r => r.y));
              maxX = Math.max(...rects.map(r => r.x + r.width));
              maxY = Math.max(...rects.map(r => r.y + r.height));
            } else {
              const offX = groupDragOffset?.dx ?? 0;
              const offY = groupDragOffset?.dy ?? 0;
              const rects = selectedEls.map(getVisibleRect);
              minX = Math.min(...rects.map(r => r.x)) + offX;
              minY = Math.min(...rects.map(r => r.y)) + offY;
              maxX = Math.max(...rects.map(r => r.x + r.width)) + offX;
              maxY = Math.max(...rects.map(r => r.y + r.height)) + offY;
            }

            const pad = 4;
            return (
              <div style={{
                position: 'absolute',
                left: minX - pad, top: minY - pad,
                width: maxX - minX + pad * 2, height: maxY - minY + pad * 2,
                border: '1px dashed var(--accent)',
                borderRadius: 2,
                pointerEvents: 'none',
                zIndex: 150,
              }}>
                {GR_DIRS.map(({ dir, style }) => (
                  <div
                    key={dir}
                    onPointerDown={handleGroupResizePointerDown(dir)}
                    style={{
                      position: 'absolute',
                      width: GR_HANDLE_SIZE, height: GR_HANDLE_SIZE,
                      background: 'var(--accent)',
                      border: '1px solid var(--surface)',
                      borderRadius: 1,
                      cursor: GR_CURSORS[dir],
                      pointerEvents: 'auto',
                      zIndex: 10,
                      ...style,
                    }}
                  />
                ))}
              </div>
            );
          })()}

          {/* Drawing / shape overlay — active in either mode */}
          {(drawingMode || shapeMode) && (
            <svg
              style={{
                position: 'absolute', inset: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
                zIndex: 200, cursor: 'crosshair',
              }}
              onPointerDown={drawingMode ? handleFreePointerDown : handleShapePointerDown}
              onPointerMove={drawingMode ? handleFreePointerMove : handleShapePointerMove}
              onPointerUp={drawingMode ? handleFreePointerUp : handleShapePointerUp}
            >
              {/* Free drawing strokes */}
              {drawingMode && freeStrokes.map((s, i) => (
                <path
                  key={i}
                  d={s.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                  fill="none" stroke={s.color} strokeWidth={s.width}
                  strokeLinecap="round" strokeLinejoin="round"
                />
              ))}
              {drawingMode && freeCurrentStroke && (
                <path
                  d={freeCurrentStroke.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                  fill="none" stroke={freeCurrentStroke.color} strokeWidth={freeCurrentStroke.width}
                  strokeLinecap="round" strokeLinejoin="round"
                />
              )}
              {/* Shape preview */}
              {shapeMode && shapeStart && shapeCurrent && (() => {
                const x1 = shapeStart.x, y1 = shapeStart.y;
                const x2 = shapeCurrent.x, y2 = shapeCurrent.y;
                const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
                const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
                if (shapeMode === 'segment') return (
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={shapeColor} strokeWidth={shapeStrokeWidth} strokeLinecap="round" />
                );
                if (shapeMode === 'rect') return (
                  <rect x={rx} y={ry} width={rw} height={rh}
                    stroke={shapeColor} strokeWidth={shapeStrokeWidth} fill={shapeFill} />
                );
                if (shapeMode === 'ellipse') return (
                  <ellipse cx={rx + rw / 2} cy={ry + rh / 2} rx={rw / 2} ry={rh / 2}
                    stroke={shapeColor} strokeWidth={shapeStrokeWidth} fill={shapeFill} />
                );
                return null;
              })()}
            </svg>
          )}

          {/* Alignment preview ghosts */}
          {previewPositions && previewPositions.map(p => (
            <div key={`preview-${p.id}`} style={{
              position: 'absolute',
              left: p.x, top: p.y,
              width: p.width, height: p.height,
              border: '2px dashed var(--preview-border)',
              borderRadius: 2,
              background: 'var(--preview-bg)',
              pointerEvents: 'none',
              zIndex: 140,
            }} />
          ))}

          {/* Snap guides */}
          {snapGuides.x.map((gx, i) => (
            <div key={`sg-x-${i}`} style={{
              position: 'absolute', left: gx, top: -2000, width: 1, height: 5000,
              background: 'var(--snap-color)', pointerEvents: 'none', zIndex: 180,
            }} />
          ))}
          {snapGuides.y.map((gy, i) => (
            <div key={`sg-y-${i}`} style={{
              position: 'absolute', top: gy, left: -2000, height: 1, width: 5000,
              background: 'var(--snap-color)', pointerEvents: 'none', zIndex: 180,
            }} />
          ))}

          {slide.elements.map(el => {
            const isTextEditing = el.type === 'text' && editingId === el.id;
            const isDrawingEditing = el.type === 'drawing' && editingId === el.id;
            const isElementEditing = isTextEditing || isDrawingEditing;
            const isSelected = selectedIds.has(el.id);
            const isMulti = selectedIds.size > 1;
            const liveOffset = (isSelected && isMulti && groupDragOffset && draggingIdRef.current !== el.id)
              ? groupDragOffset : null;

            const isCroppingThis = croppingId === el.id;
            const ct = (!isCroppingThis && (el.type === 'image' || el.type === 'video')) ? ((el as any).cropTop ?? 0) : 0;
            const cr = (!isCroppingThis && (el.type === 'image' || el.type === 'video')) ? ((el as any).cropRight ?? 0) : 0;
            const cb = (!isCroppingThis && (el.type === 'image' || el.type === 'video')) ? ((el as any).cropBottom ?? 0) : 0;
            const cl = (!isCroppingThis && (el.type === 'image' || el.type === 'video')) ? ((el as any).cropLeft ?? 0) : 0;
            const hasCrop = ct > 0 || cr > 0 || cb > 0 || cl > 0;

            return (
              <DraggableElement
                key={el.id}
                x={el.x + (liveOffset?.dx ?? 0)}
                y={el.y + (liveOffset?.dy ?? 0)}
                width={el.width}
                height={el.height}
                zoom={zoom}
                disableDrag={isElementEditing || isCroppingThis || !!groupResizeOverrides}
                disableResize={isElementEditing || isMulti || isCroppingThis || !isSelected}
                lockAspectRatio={el.type === 'image' || el.type === 'video'}
                liveOverride={groupResizeOverrides?.get(el.id)}
                snapFn={makeSnapFn(el.id)}
                onDragStart={() => {
                  if (!isSelected) {
                    onSelectElement(el.id);
                  }
                  dragStartRef.current = { x: el.x, y: el.y };
                  draggingIdRef.current = el.id;
                }}
                onDrag={(dx, dy) => {
                  setLiveDragDelta({ id: el.id, dx, dy });
                  if (isSelected && isMulti && dragStartRef.current) {
                    setGroupDragOffset({ dx, dy });
                  }
                }}
                onDragStop={(newX, newY) => {
                  setLiveDragDelta(null);
                  setSnapGuides({ x: [], y: [] });
                  onUpdateElement({ ...el, x: newX, y: newY });
                  if (isSelected && isMulti && dragStartRef.current) {
                    const dx = newX - dragStartRef.current.x;
                    const dy = newY - dragStartRef.current.y;
                    onMoveGroup(el.id, dx, dy);
                  }
                  dragStartRef.current = null;
                  draggingIdRef.current = null;
                  setGroupDragOffset(null);
                }}
                onResize={el.type === 'text' ? (w) => {
                  setLiveTextScale({ id: el.id, scale: w / el.width });
                } : undefined}
                onResizeStop={(w, h, newX, newY) => {
                  if (el.type === 'text') {
                    setLiveTextScale(null);
                    const scale = w / el.width;
                    onUpdateElement({ ...el, fontSize: Math.max(8, Math.round(el.fontSize * scale)), width: w, height: h, x: newX, y: newY });
                  } else {
                    onUpdateElement({ ...el, width: w, height: h, x: newX, y: newY });
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTextEditing) return;
                  if (e.shiftKey) {
                    onSelectElement(el.id, true);
                  } else if (!isSelected || !isMulti) {
                    onSelectElement(el.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (el.type === 'text' || el.type === 'drawing') {
                    onSelectElement(el.id);
                    onStartEditing(el.id);
                  }
                }}
                onMouseEnter={() => setHoveredId(el.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  outline: (isSelected && !hasCrop)
                    ? '2px solid var(--accent)'
                    : (!hasCrop && hoveredId === el.id)
                      ? '1px dashed var(--accent-mid)'
                      : 'none',
                  outlineOffset: isSelected ? 0 : 1,
                  cursor: isTextEditing ? 'text' : 'grab',
                }}
              >
                {/* Content with crop clip-path */}
                <div style={{
                  width: '100%', height: '100%',
                  ...(hasCrop && { clipPath: `inset(${ct}% ${cr}% ${cb}% ${cl}%)` }),
                }}>
                  {renderElement(el)}
                </div>
                {/* Block pointer events on cropped area when not selected */}
                {hasCrop && !isSelected && (
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      clipPath: `inset(0 0 0 0)`,
                      // Inverted: cover everything EXCEPT the visible area
                    }}
                  >
                    {ct > 0 && <CropBlocker style={{ top: 0, left: 0, right: 0, height: `${ct}%` }} />}
                    {cb > 0 && <CropBlocker style={{ bottom: 0, left: 0, right: 0, height: `${cb}%` }} />}
                    {cl > 0 && <CropBlocker style={{ top: 0, left: 0, bottom: 0, width: `${cl}%` }} />}
                    {cr > 0 && <CropBlocker style={{ top: 0, right: 0, bottom: 0, width: `${cr}%` }} />}
                  </div>
                )}
                {isSelected && !isMulti && !isTextEditing && !hasCrop && (
                  <ElementToolbar
                    element={el}
                    onUpdate={onUpdateElement}
                    onDelete={onDeleteSelected}
                    onStartCropping={() => {
                      if (croppingId === el.id) onCommitCrop();
                      else onStartCropping(el.id);
                    }}
                    isCropping={croppingId === el.id}
                    activeEditor={editingId === el.id ? activeEditor : null}
                    onToggleBoldItalic={onToggleBoldItalic}
                    videoRefs={videoRefs}
                  />
                )}
                {isCroppingThis && (el.type === 'image' || el.type === 'video') && (
                  <CropHandles element={el} onUpdate={onUpdateElement} zoom={zoom} />
                )}
              </DraggableElement>
            );
          })}

          {/* Selection outlines + resize handles for cropped elements */}
          {slide.elements.map(el => {
            if (el.type !== 'image' && el.type !== 'video') return null;
            const ct = (el as any).cropTop ?? 0;
            const cr = (el as any).cropRight ?? 0;
            const cb = (el as any).cropBottom ?? 0;
            const cl = (el as any).cropLeft ?? 0;
            if (ct === 0 && cr === 0 && cb === 0 && cl === 0) return null;
            if (croppingId === el.id) return null;
            const isSelected = selectedIds.has(el.id);
            const isHovered = hoveredId === el.id;
            const isMulti = selectedIds.size > 1;
            if (!isSelected && !isHovered) return null;
            const v = getVisibleRect(el);
            const dragOff = liveDragDelta?.id === el.id ? liveDragDelta : null;
            return (
              <CroppedOutline
                key={`outline-${el.id}`}
                vx={v.x + (dragOff?.dx ?? 0)} vy={v.y + (dragOff?.dy ?? 0)}
                vw={v.width} vh={v.height}
                isSelected={isSelected}
              >
                {isSelected && !isMulti && (
                  <ElementToolbar
                    element={el}
                    onUpdate={onUpdateElement}
                    onDelete={onDeleteSelected}
                    onStartCropping={() => {
                      if (croppingId === el.id) onCommitCrop();
                      else onStartCropping(el.id);
                    }}
                    isCropping={croppingId === el.id}
                    activeEditor={null}
                    videoRefs={videoRefs}
                  />
                )}
              </CroppedOutline>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CropHandles({ element, onUpdate, zoom }: {
  element: SlideElement & { cropTop?: number; cropRight?: number; cropBottom?: number; cropLeft?: number };
  onUpdate: (el: SlideElement) => void;
  zoom: number;
}) {
  const t = element.cropTop ?? 0;
  const r = element.cropRight ?? 0;
  const b = element.cropBottom ?? 0;
  const l = element.cropLeft ?? 0;
  const w = element.width;
  const h = element.height;

  // Keep a ref to the latest element to avoid stale closures during drag
  const elementRef = useRef(element);
  elementRef.current = element;

  const handleDrag = (side: 'top' | 'right' | 'bottom' | 'left') => (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startVal = side === 'top' ? t : side === 'right' ? r : side === 'bottom' ? b : l;

    const onMove = (ev: globalThis.PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      let delta: number;
      if (side === 'top') delta = dy / h * 100;
      else if (side === 'bottom') delta = -dy / h * 100;
      else if (side === 'left') delta = dx / w * 100;
      else delta = -dx / w * 100;
      const val = Math.max(0, Math.min(45, Math.round(startVal + delta)));
      const key = `crop${side[0].toUpperCase()}${side.slice(1)}`;
      onUpdate({ ...elementRef.current, [key]: val });
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleStyle = (side: 'top' | 'right' | 'bottom' | 'left'): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute', background: 'var(--crop-color)', zIndex: 10,
    };
    const val = side === 'top' ? t : side === 'right' ? r : side === 'bottom' ? b : l;
    if (side === 'top' || side === 'bottom') {
      return {
        ...base,
        left: 0, right: 0, height: `${val}%`,
        ...(side === 'top' ? { top: 0 } : { bottom: 0 }),
        cursor: 'ns-resize',
      };
    }
    return {
      ...base,
      top: 0, bottom: 0, width: `${val}%`,
      ...(side === 'left' ? { left: 0 } : { right: 0 }),
      cursor: 'ew-resize',
    };
  };

  return (
    <>
      {(['top', 'right', 'bottom', 'left'] as const).map(side => (
        <div
          key={side}
          style={handleStyle(side)}
          onPointerDown={handleDrag(side)}
        >
          {/* Drag handle line */}
          <div style={{
            position: 'absolute',
            ...(side === 'top' ? { bottom: 0, left: 0, right: 0, height: 3 } :
                side === 'bottom' ? { top: 0, left: 0, right: 0, height: 3 } :
                side === 'left' ? { right: 0, top: 0, bottom: 0, width: 3 } :
                { left: 0, top: 0, bottom: 0, width: 3 }),
            background: 'var(--crop-line)',
            cursor: (side === 'top' || side === 'bottom') ? 'ns-resize' : 'ew-resize',
          }} />
        </div>
      ))}
    </>
  );
}

function CroppedOutline({ vx, vy, vw, vh, isSelected, children }: {
  vx: number; vy: number; vw: number; vh: number;
  isSelected: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      position: 'absolute',
      left: vx, top: vy, width: vw, height: vh,
      border: isSelected ? '2px solid var(--accent)' : '1px dashed var(--accent-mid)',
      pointerEvents: 'none',
      zIndex: 160,
    }}>
      {children}
    </div>
  );
}

function CropBlocker({ style }: { style: React.CSSProperties }) {
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); };
  return <div style={{ position: 'absolute', ...style }} data-no-drag="true" onPointerDown={stop} onClick={stop} />;
}

const zoomBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 14, color: 'var(--text)', padding: '4px 8px', borderRadius: 4,
  lineHeight: 1, minWidth: 28, minHeight: 26,
};
