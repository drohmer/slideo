import { useState } from 'react';
import type { Slide, SlideElement } from '../../types';
import { useI18n } from '../../i18n';


interface Props {
  slides: Slide[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onDuplicate: () => void;
}

export function SlidesSidebar({ slides, currentIndex, onSelect, onAdd, onDelete, onDuplicate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

  if (collapsed) {
    return (
      <div style={{
        width: 32, background: 'var(--panel-bg)',
        borderRight: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '6px 0', gap: 3, overflowY: 'auto',
      }}>
        <div
          onClick={() => setCollapsed(false)}
          title={t('showSlides')}
          style={{ cursor: 'pointer', marginBottom: 4, fontSize: 10, opacity: 0.4 }}
        >{'\u25B6'}</div>
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            onClick={() => onSelect(i)}
            title={`${t('slideN')} ${i + 1}`}
            style={{
              width: 22, height: 14, borderRadius: 2, cursor: 'pointer',
              background: slide.background,
              border: i === currentIndex ? '2px solid var(--accent)' : '1px solid var(--border)',
            }}
          />
        ))}
        <div
          onClick={onAdd}
          title={t('addSlide')}
          style={{
            width: 22, height: 14, borderRadius: 2, cursor: 'pointer',
            border: '1px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, opacity: 0.3,
          }}
        >+</div>
      </div>
    );
  }

  return (
    <div style={{
      width: 130, background: 'var(--panel-bg)',
      padding: 8, overflowY: 'auto',
      borderRight: '1px solid var(--border)', flexShrink: 0,
    }}>
      <div
        onClick={() => setCollapsed(true)}
        title={t('hideSlides')}
        style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, cursor: 'pointer' }}
      >
        <span style={{
          background: 'var(--border-light)', borderRadius: 3,
          padding: '3px 8px', fontSize: 10, opacity: 0.5,
        }}>{'\u25C0'}</span>
      </div>

      {(
        <>
          <div style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.4, marginBottom: 8, letterSpacing: 1 }}>
            {t('slides')}
          </div>

          {slides.map((slide, i) => (
            <div
              key={slide.id}
              onClick={() => onSelect(i)}
              style={{
                border: i === currentIndex ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: i === currentIndex ? 'var(--accent-light)' : 'var(--surface)',
                borderRadius: 4, padding: 4, marginBottom: 6, cursor: 'pointer', position: 'relative',
              }}
            >
              <SlideThumbnail slide={slide} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                <span style={{ fontSize: 9, opacity: 0.6 }}>{i + 1}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {i === currentIndex && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                      title={`${t('duplicateSlide')} (Ctrl+D)`}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, padding: 0 }}
                    >
                      ⧉
                    </button>
                  )}
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 10, padding: 0 }}
                    >
                      x
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div
            onClick={onAdd}
            style={{
              border: '2px dashed var(--border)', borderRadius: 4,
              height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', marginTop: 4,
            }}
          >
            <span style={{ fontSize: 18, opacity: 0.3 }}>+</span>
          </div>
        </>
      )}
    </div>
  );
}

const THUMB_W = 110;
const THUMB_H = 62;
const CANVAS_W = 960;
const CANVAS_H = 540;
const THUMB_SCALE = THUMB_W / CANVAS_W;

function SlideThumbnail({ slide }: { slide: Slide }) {
  return (
    <div style={{
      width: THUMB_W, height: THUMB_H, borderRadius: 2,
      overflow: 'hidden', position: 'relative', background: slide.background,
    }}>
      <div style={{
        width: CANVAS_W, height: CANVAS_H,
        transform: `scale(${THUMB_SCALE})`,
        transformOrigin: 'top left',
        position: 'absolute', top: 0, left: 0,
      }}>
        {slide.elements.map(el => (
          <ThumbnailElement key={el.id} element={el} />
        ))}
      </div>
    </div>
  );
}

function ThumbnailElement({ element }: { element: SlideElement }) {
  const cropTop = (element.type === 'video' || element.type === 'image') ? ((element as any).cropTop ?? 0) : 0;
  const cropRight = (element.type === 'video' || element.type === 'image') ? ((element as any).cropRight ?? 0) : 0;
  const cropBottom = (element.type === 'video' || element.type === 'image') ? ((element as any).cropBottom ?? 0) : 0;
  const cropLeft = (element.type === 'video' || element.type === 'image') ? ((element as any).cropLeft ?? 0) : 0;
  const hasCrop = cropTop > 0 || cropRight > 0 || cropBottom > 0 || cropLeft > 0;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.x, top: element.y,
    width: element.width, height: element.height,
    overflow: 'hidden',
    ...(hasCrop && { clipPath: `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)` }),
  };

  if (element.type === 'video') {
    return (
      <div style={style}>
        <video
          src={element.src}
          muted
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  if (element.type === 'image') {
    return (
      <div style={style}>
        <img
          src={element.src}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  // text
  return (
    <div style={{
      ...style,
      fontSize: element.fontSize,
      color: element.color,
      lineHeight: 1.3,
      overflow: 'hidden',
    }}>
      <div dangerouslySetInnerHTML={{ __html: element.content }} />
    </div>
  );
}
