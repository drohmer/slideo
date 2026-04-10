import { useState } from 'react';
import type { Slide } from '../../types';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';

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
  const { theme } = useTheme();

  if (collapsed) {
    return (
      <div style={{
        width: 32, background: theme.panelBg,
        borderRight: `1px solid ${theme.border}`, flexShrink: 0,
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
              border: i === currentIndex ? '2px solid #4361ee' : '1px solid rgba(0,0,0,0.15)',
            }}
          />
        ))}
        <div
          onClick={onAdd}
          title={t('addSlide')}
          style={{
            width: 22, height: 14, borderRadius: 2, cursor: 'pointer',
            border: '1px dashed rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, opacity: 0.3,
          }}
        >+</div>
      </div>
    );
  }

  return (
    <div style={{
      width: 130, background: theme.panelBg,
      padding: 8, overflowY: 'auto',
      borderRight: `1px solid ${theme.border}`, flexShrink: 0,
    }}>
      <div
        onClick={() => setCollapsed(true)}
        title={t('hideSlides')}
        style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, cursor: 'pointer' }}
      >
        <span style={{
          background: 'rgba(0,0,0,0.06)', borderRadius: 3,
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
                border: i === currentIndex ? '2px solid #4361ee' : '1px solid rgba(0,0,0,0.1)',
                background: i === currentIndex ? 'rgba(67,97,238,0.1)' : '#fff',
                borderRadius: 4, padding: 4, marginBottom: 6, cursor: 'pointer', position: 'relative',
              }}
            >
              <div style={{
                background: slide.background, borderRadius: 2, height: 60,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 10, color: '#666' }}>
                  {slide.elements.length > 0 ? `${slide.elements.length} ${t('nElem')}` : t('empty')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                <span style={{ fontSize: 9, opacity: 0.6 }}>{i + 1}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {i === currentIndex && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                      title={`${t('duplicateSlide')} (Ctrl+D)`}
                      style={{ background: 'none', border: 'none', color: '#4361ee', cursor: 'pointer', fontSize: 10, padding: 0 }}
                    >
                      ⧉
                    </button>
                  )}
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                      style={{ background: 'none', border: 'none', color: '#e94560', cursor: 'pointer', fontSize: 10, padding: 0 }}
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
              border: '2px dashed rgba(0,0,0,0.15)', borderRadius: 4,
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
