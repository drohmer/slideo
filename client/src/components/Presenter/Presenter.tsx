import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Presentation } from '../../types';
import { getPresentation } from '../../api';
import { PresenterVideo } from './PresenterVideo';
import { VideoEl } from '../Elements/VideoElement';
import { ImageEl } from '../Elements/ImageElement';
import { TextEl } from '../Elements/TextElement';
import { DrawingEl } from '../Elements/DrawingElement';
import { ShapeEl } from '../Elements/ShapeElement';

export function Presenter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (id) getPresentation(id).then(setPres);
  }, [id]);

  // Fullscreen on mount (best effort)
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { document.exitFullscreen?.().catch(() => {}); };
  }, []);

  // Track viewport size for responsive scaling
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const goNext = useCallback(() => {
    if (pres) setSlideIndex(i => Math.min(i + 1, pres.slides.length - 1));
  }, [pres]);

  const goPrev = useCallback(() => {
    setSlideIndex(i => Math.max(i - 1, 0));
  }, []);

  const exit = useCallback(() => {
    document.exitFullscreen?.().catch(() => {});
    navigate(`/edit/${id}`);
  }, [navigate, id]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': goNext(); break;
        case 'ArrowLeft': case 'ArrowUp': goPrev(); break;
        case 'Escape': exit(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, exit]);

  // Touch swipe navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    if (dx < -50) goNext();
    else if (dx > 50) goPrev();
    touchStart.current = null;
  }, [goNext, goPrev]);

  if (!pres) return null;

  const slide = pres.slides[slideIndex];
  const scale = Math.min(viewport.w / 960, viewport.h / 540);

  return (
    <div
      style={{
        width: '100vw', height: '100vh', background: slide.background,
        position: 'relative', overflow: 'hidden', cursor: 'none',
        touchAction: 'none',
      }}
      onMouseMove={(e) => {
        (e.currentTarget as HTMLElement).style.cursor = 'default';
        clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>).__cursorTimer);
        (window as unknown as Record<string, ReturnType<typeof setTimeout>>).__cursorTimer = setTimeout(() => {
          (e.currentTarget as HTMLElement).style.cursor = 'none';
        }, 2000);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Tap zones for navigation */}
      <div
        onClick={goPrev}
        style={{ position: 'fixed', top: 0, left: 0, width: '30%', height: '100%', zIndex: 5 }}
      />
      <div
        onClick={goNext}
        style={{ position: 'fixed', top: 0, right: 0, width: '30%', height: '100%', zIndex: 5 }}
      />

      {/* Scale slide content to fit viewport */}
      <div style={{
        width: 960, height: 540,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        position: 'absolute',
        left: (viewport.w - 960 * scale) / 2,
        top: (viewport.h - 540 * scale) / 2,
      }}>
        {slide.elements.map(el => (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: el.x, top: el.y,
              width: el.width, height: el.height,
            }}
          >
            {el.type === 'video' && (el.chromaKey
              ? <VideoEl element={el} background={slide.background} />
              : <PresenterVideo element={el} slideId={slide.id} />
            )}
            {el.type === 'image' && <ImageEl element={el} />}
            {el.type === 'text' && <TextEl element={el} />}
            {el.type === 'drawing' && <DrawingEl element={el} isEditing={false} onUpdate={() => {}} />}
            {el.type === 'shape' && <ShapeEl element={el} />}
          </div>
        ))}
      </div>

      {/* Slide indicator */}
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6, zIndex: 10,
      }}>
        {pres.slides.map((_, i) => (
          <div
            key={i}
            onClick={() => setSlideIndex(i)}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === slideIndex ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.15)',
              transition: 'background 0.2s',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  );
}
