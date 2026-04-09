import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Presentation } from '../../types';
import { getPresentation } from '../../api';
import { PresenterVideo } from './PresenterVideo';
import { ImageEl } from '../Elements/ImageElement';
import { TextEl } from '../Elements/TextElement';

export function Presenter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pres, setPres] = useState<Presentation | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (id) getPresentation(id).then(setPres);
  }, [id]);

  // Fullscreen on mount
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => { document.exitFullscreen?.().catch(() => {}); };
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': goNext(); break;
        case 'ArrowLeft': case 'ArrowUp': goPrev(); break;
        case 'Escape': exit(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, exit]);

  if (!pres) return null;

  const slide = pres.slides[slideIndex];

  return (
    <div style={{
      width: '100vw', height: '100vh', background: slide.background,
      position: 'relative', overflow: 'hidden', cursor: 'none',
    }}
      onMouseMove={(e) => {
        (e.currentTarget as HTMLElement).style.cursor = 'default';
        clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>).__cursorTimer);
        (window as unknown as Record<string, ReturnType<typeof setTimeout>>).__cursorTimer = setTimeout(() => {
          (e.currentTarget as HTMLElement).style.cursor = 'none';
        }, 2000);
      }}
    >
      {/* Scale slide content to fit viewport */}
      <div style={{
        width: 960, height: 540,
        transform: `scale(${Math.min(window.innerWidth / 960, window.innerHeight / 540)})`,
        transformOrigin: 'top left',
        position: 'absolute',
        left: '50%', top: '50%',
        marginLeft: -480 * Math.min(window.innerWidth / 960, window.innerHeight / 540),
        marginTop: -270 * Math.min(window.innerWidth / 960, window.innerHeight / 540),
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
            {el.type === 'video' && <PresenterVideo element={el} slideId={slide.id} />}
            {el.type === 'image' && <ImageEl element={el} />}
            {el.type === 'text' && <TextEl element={el} />}
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
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === slideIndex ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.15)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
