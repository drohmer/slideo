import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import { Rnd } from 'react-rnd';
import type { Slide, SlideElement, VideoElement, ImageElement } from '../../types';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { uploadFile } from '../../api';
import { VideoEl } from '../Elements/VideoElement';
import { ImageEl } from '../Elements/ImageElement';
import { TextEl } from '../Elements/TextElement';
import { ElementToolbar } from './ElementToolbar';

interface Props {
  slide: Slide;
  presentationId: string;
  selectedIds: Set<string>;
  editingId: string | null;
  onSelectElement: (id: string | null, shiftKey?: boolean) => void;
  onSelectMultiple: (ids: string[]) => void;
  onUpdateElements: (elements: SlideElement[]) => void;
  onUpdateElement: (element: SlideElement) => void;
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
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

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
  slide, presentationId, selectedIds, editingId, onSelectElement, onSelectMultiple, onUpdateElements, onUpdateElement, onMoveGroup, onStartEditing, onStopEditing, onEditorReady, previewPositions, croppingId, onStartCropping, onCommitCrop, onDeleteSelected, activeEditor,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
  // Live drag offset for group movement
  const [groupDragOffset, setGroupDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const draggingIdRef = useRef<string | null>(null);

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
      const hits = slide.elements.filter(el =>
        rectsIntersect(m, { x: el.x, y: el.y, w: el.width, h: el.height })
      );
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
      case 'video': return <VideoEl element={el} editMode background={slide.background} />;
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
    }
  };

  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 16, overflow: 'hidden', position: 'relative',
        cursor: isPanning.current ? 'grabbing' : undefined,
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
        background: 'rgba(255,255,255,0.9)', borderRadius: 6,
        padding: '3px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        fontSize: 11, color: '#1a1a1a',
      }}>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100))} style={zoomBtnStyle}>−</button>
        <span style={{ minWidth: 36, textAlign: 'center', opacity: 0.6 }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))} style={zoomBtnStyle}>+</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...zoomBtnStyle, opacity: zoom === 1 ? 0.3 : 1, marginLeft: 2 }}>Reset</button>
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
            border: isDragActive ? '2px dashed #4361ee' : '2px solid transparent',
            cursor: isMarquee.current ? 'crosshair' : undefined,
          }}
        >
          <input {...getInputProps()} />

          {isDragActive && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(67,97,238,0.1)', borderRadius: 4, zIndex: 100,
              fontSize: 16, color: '#4361ee', pointerEvents: 'none',
            }}>
              Déposez vos fichiers ici
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
              background: 'rgba(67,97,238,0.12)',
              border: '1px solid rgba(67,97,238,0.5)',
              borderRadius: 1,
              pointerEvents: 'none',
              zIndex: 200,
            }} />
          )}

          {/* Group bounding box */}
          {selectedIds.size > 1 && (() => {
            const selected = slide.elements.filter(el => selectedIds.has(el.id));
            if (selected.length < 2) return null;
            const offX = groupDragOffset?.dx ?? 0;
            const offY = groupDragOffset?.dy ?? 0;
            const minX = Math.min(...selected.map(el => el.x)) + offX;
            const minY = Math.min(...selected.map(el => el.y)) + offY;
            const maxX = Math.max(...selected.map(el => el.x + el.width)) + offX;
            const maxY = Math.max(...selected.map(el => el.y + el.height)) + offY;
            return (
              <div style={{
                position: 'absolute',
                left: minX - 4, top: minY - 4,
                width: maxX - minX + 8, height: maxY - minY + 8,
                border: '1px dashed #4361ee',
                borderRadius: 2,
                pointerEvents: 'none',
                zIndex: 150,
              }} />
            );
          })()}

          {/* Alignment preview ghosts */}
          {previewPositions && previewPositions.map(p => (
            <div key={`preview-${p.id}`} style={{
              position: 'absolute',
              left: p.x, top: p.y,
              width: p.width, height: p.height,
              border: '2px dashed rgba(220,38,38,0.7)',
              borderRadius: 2,
              background: 'rgba(220,38,38,0.08)',
              pointerEvents: 'none',
              zIndex: 140,
            }} />
          ))}

          {slide.elements.map(el => {
            const ar = getVideoAR(el);
            const isTextEditing = el.type === 'text' && editingId === el.id;
            const isSelected = selectedIds.has(el.id);
            const isMulti = selectedIds.size > 1;
            // Apply live drag offset to non-dragged selected elements
            const liveOffset = (isSelected && isMulti && groupDragOffset && draggingIdRef.current !== el.id)
              ? groupDragOffset : null;

            // Crop info for visual clip-path (not during crop mode)
            const isCroppingThis = croppingId === el.id;
            const ct = (!isCroppingThis && (el.type === 'image' || el.type === 'video')) ? ((el as any).cropTop ?? 0) : 0;
            const cr = (!isCroppingThis && (el.type === 'image' || el.type === 'video')) ? ((el as any).cropRight ?? 0) : 0;
            const cb = (!isCroppingThis && (el.type === 'image' || el.type === 'video')) ? ((el as any).cropBottom ?? 0) : 0;
            const cl = (!isCroppingThis && (el.type === 'image' || el.type === 'video')) ? ((el as any).cropLeft ?? 0) : 0;
            const hasCrop = ct > 0 || cr > 0 || cb > 0 || cl > 0;

            return (
              <Rnd
                key={el.id}
                position={{
                  x: el.x + (liveOffset?.dx ?? 0),
                  y: el.y + (liveOffset?.dy ?? 0),
                }}
                size={{ width: el.width, height: el.height }}
                scale={zoom}
                disableDragging={isTextEditing || croppingId === el.id}
                enableResizing={!isTextEditing && !isMulti && croppingId !== el.id}
                lockAspectRatio={false}
                onDragStart={() => {
                  dragStartRef.current = { x: el.x, y: el.y };
                  draggingIdRef.current = el.id;
                }}
                onDrag={(_e, d) => {
                  if (isSelected && isMulti && dragStartRef.current) {
                    setGroupDragOffset({
                      dx: d.x - dragStartRef.current.x,
                      dy: d.y - dragStartRef.current.y,
                    });
                  }
                }}
                onDragStop={(_e, d) => {
                  onUpdateElement({ ...el, x: d.x, y: d.y });
                  if (isSelected && isMulti && dragStartRef.current) {
                    const dx = d.x - dragStartRef.current.x;
                    const dy = d.y - dragStartRef.current.y;
                    onMoveGroup(el.id, dx, dy);
                  }
                  dragStartRef.current = null;
                  draggingIdRef.current = null;
                  setGroupDragOffset(null);
                }}
                onResize={el.type === 'text' ? (_e, _dir, ref) => {
                  setLiveTextScale({ id: el.id, scale: parseInt(ref.style.width) / el.width });
                } : undefined}
                onResizeStop={(_e, _dir, ref, _delta, pos) => {
                  const newWidth = parseInt(ref.style.width);
                  const newHeight = parseInt(ref.style.height);
                  if (el.type === 'text') {
                    setLiveTextScale(null);
                    const scale = newWidth / el.width;
                    onUpdateElement({
                      ...el,
                      fontSize: Math.max(8, Math.round(el.fontSize * scale)),
                      width: newWidth,
                      height: newHeight,
                      x: pos.x,
                      y: pos.y,
                    });
                  } else {
                    onUpdateElement({
                      ...el,
                      width: newWidth,
                      height: newHeight,
                      x: pos.x,
                      y: pos.y,
                    });
                  }
                }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (isTextEditing) return;
                  if (e.shiftKey) {
                    onSelectElement(el.id, true);
                  } else if (!isSelected || !isMulti) {
                    // Only change selection if not already part of a multi-selection
                    onSelectElement(el.id);
                  }
                }}
                onDoubleClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (el.type === 'text') {
                    onSelectElement(el.id);
                    onStartEditing(el.id);
                  }
                }}
                onMouseEnter={() => setHoveredId(el.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  outline: (isSelected && !hasCrop)
                    ? '2px solid #4361ee'
                    : (!hasCrop && hoveredId === el.id)
                      ? '1px dashed rgba(67,97,238,0.5)'
                      : 'none',
                  outlineOffset: isSelected ? 0 : 1,
                  cursor: isTextEditing ? 'text' : 'grab',
                }}
              >
                <div style={hasCrop ? {
                  width: '100%', height: '100%',
                  clipPath: `inset(${ct}% ${cr}% ${cb}% ${cl}%)`,
                } : undefined}>
                  {renderElement(el)}
                </div>
                {/* Selection outline at the visible (cropped) area */}
                {hasCrop && isSelected && (
                  <div style={{
                    position: 'absolute',
                    left: `${cl}%`, top: `${ct}%`,
                    right: `${cr}%`, bottom: `${cb}%`,
                    border: '2px solid #4361ee',
                    pointerEvents: 'none',
                  }} />
                )}
                {hasCrop && !isSelected && hoveredId === el.id && (
                  <div style={{
                    position: 'absolute',
                    left: `${cl}%`, top: `${ct}%`,
                    right: `${cr}%`, bottom: `${cb}%`,
                    border: '1px dashed rgba(67,97,238,0.5)',
                    pointerEvents: 'none',
                  }} />
                )}
                {isSelected && !isMulti && !isTextEditing && (
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
                  />
                )}
                {croppingId === el.id && (el.type === 'image' || el.type === 'video') && (
                  <CropHandles element={el} onUpdate={onUpdateElement} zoom={zoom} />
                )}
              </Rnd>
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
      position: 'absolute', background: 'rgba(220,38,38,0.6)', zIndex: 10,
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
            background: 'rgba(220,38,38,0.9)',
            cursor: (side === 'top' || side === 'bottom') ? 'ns-resize' : 'ew-resize',
          }} />
        </div>
      ))}
    </>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 14, color: '#1a1a1a', padding: '2px 6px', borderRadius: 3,
  lineHeight: 1,
};
