import { useRef, useCallback, type ReactNode, type PointerEvent as ReactPointerEvent, type CSSProperties } from 'react';

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  disableDrag?: boolean;
  disableResize?: boolean;
  lockAspectRatio?: boolean;
  children: ReactNode;
  onDragStart?: () => void;
  onDrag?: (dx: number, dy: number) => void;
  onDragStop?: (x: number, y: number) => void;
  onResize?: (width: number, height: number) => void;
  onResizeStop?: (width: number, height: number, x: number, y: number) => void;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  style?: CSSProperties;
}

type ResizeDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const HANDLE_SIZE = 8;

const CURSORS: Record<ResizeDir, string> = {
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  nw: 'nwse-resize', se: 'nwse-resize',
};

export function DraggableElement({
  x, y, width, height, zoom,
  disableDrag, disableResize, lockAspectRatio,
  children, style,
  onDragStart, onDrag, onDragStop,
  onResize, onResizeStop,
  onClick, onDoubleClick,
  onMouseEnter, onMouseLeave,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const dragMoved = useRef(false);
  const propsRef = useRef({ x, y, width, height });
  propsRef.current = { x, y, width, height };

  // Apply live transform directly to DOM for smooth dragging (no React re-render)
  const applyLive = useCallback((lx: number, ly: number, lw: number, lh: number) => {
    const el = elRef.current;
    if (!el) return;
    el.style.left = `${lx}px`;
    el.style.top = `${ly}px`;
    el.style.width = `${lw}px`;
    el.style.height = `${lh}px`;
  }, []);

  // --- DRAG ---
  const handlePointerDown = useCallback((e: ReactPointerEvent) => {
    if (disableDrag) return;
    if ((e.target as HTMLElement).dataset.resize || (e.target as HTMLElement).dataset.noDrag) return;
    if (e.button !== 0) return;

    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const { x: origX, y: origY, width: origW, height: origH } = propsRef.current;
    dragMoved.current = false;

    onDragStart?.();

    const onMove = (ev: globalThis.PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragMoved.current = true;
      applyLive(origX + dx, origY + dy, origW, origH);
      onDrag?.(dx, dy);
    };
    const onUp = (ev: globalThis.PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      onDragStop?.(origX + dx, origY + dy);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [disableDrag, zoom, onDragStart, onDrag, onDragStop, applyLive]);

  // --- RESIZE ---
  const handleResizePointerDown = useCallback((dir: ResizeDir) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const { x: origX, y: origY, width: origW, height: origH } = propsRef.current;

    const aspect = origW / origH;

    const calc = (ev: { clientX: number; clientY: number }) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      let newX = origX, newY = origY, newW = origW, newH = origH;
      if (dir.includes('e')) newW = Math.max(20, origW + dx);
      if (dir.includes('w')) { newW = Math.max(20, origW - dx); newX = origX + origW - newW; }
      if (dir.includes('s')) newH = Math.max(20, origH + dy);
      if (dir.includes('n')) { newH = Math.max(20, origH - dy); newY = origY + origH - newH; }

      // Lock aspect ratio: adjust the secondary dimension
      if (lockAspectRatio) {
        const isCorner = dir.length === 2;
        const isHoriz = dir === 'e' || dir === 'w';
        if (isCorner || isHoriz) {
          // Width drives height
          const targetH = newW / aspect;
          if (dir.includes('n')) newY = newY + newH - targetH;
          newH = targetH;
        } else {
          // Height drives width
          const targetW = newH * aspect;
          if (dir.includes('w')) newX = newX + newW - targetW;
          newW = targetW;
        }
      }

      return { newX, newY, newW, newH };
    };

    const onMove = (ev: globalThis.PointerEvent) => {
      const { newX, newY, newW, newH } = calc(ev);
      applyLive(newX, newY, newW, newH);
      onResize?.(newW, newH);
    };
    const onUp = (ev: globalThis.PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const { newX, newY, newW, newH } = calc(ev);
      onResizeStop?.(newW, newH, newX, newY);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [zoom, onResize, onResizeStop, applyLive]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (dragMoved.current) { dragMoved.current = false; return; }
    onClick?.(e);
  }, [onClick]);

  return (
    <div
      ref={elRef}
      style={{
        position: 'absolute',
        left: x, top: y,
        width, height,
        ...style,
      }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
      {!disableResize && <ResizeHandles onPointerDown={handleResizePointerDown} />}
    </div>
  );
}

function ResizeHandles({ onPointerDown }: {
  onPointerDown: (dir: ResizeDir) => (e: ReactPointerEvent) => void;
}) {
  const dirs: { dir: ResizeDir; style: CSSProperties }[] = [
    { dir: 'nw', style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
    { dir: 'ne', style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
    { dir: 'se', style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
    { dir: 'sw', style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
    { dir: 'n', style: { top: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2 } },
    { dir: 's', style: { bottom: -HANDLE_SIZE / 2, left: '50%', marginLeft: -HANDLE_SIZE / 2 } },
    { dir: 'e', style: { right: -HANDLE_SIZE / 2, top: '50%', marginTop: -HANDLE_SIZE / 2 } },
    { dir: 'w', style: { left: -HANDLE_SIZE / 2, top: '50%', marginTop: -HANDLE_SIZE / 2 } },
  ];

  return (
    <>
      {dirs.map(({ dir, style }) => (
        <div
          key={dir}
          data-resize="true"
          onPointerDown={onPointerDown(dir)}
          style={{
            position: 'absolute',
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: '#4361ee',
            border: '1px solid #fff',
            borderRadius: 1,
            cursor: CURSORS[dir],
            zIndex: 10,
            ...style,
          }}
        />
      ))}
    </>
  );
}
