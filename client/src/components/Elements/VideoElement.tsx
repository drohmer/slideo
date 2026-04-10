import { useEffect, useRef } from 'react';
import type { VideoElement } from '../../types';
import { useI18n } from '../../i18n';

interface Props {
  element: VideoElement;
  editMode?: boolean;
  background?: string;
  videoRefs?: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}

export function VideoEl({ element, editMode, background = '#ffffff', videoRefs }: Props) {
  const { t } = useI18n();
  const localRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el || !videoRefs) return;
    videoRefs.current.set(element.id, el);
    return () => { videoRefs.current.delete(element.id); };
  }, [element.id, videoRefs]);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {/* Video clipped inside */}
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', background }}>
        <video
          ref={localRef}
          src={element.src}
          loop={element.loop}
          autoPlay={element.autoplay}
          muted={element.muted}
          playsInline
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover',
            display: 'block',
            pointerEvents: editMode ? 'none' : 'auto',
          }}
          controls
        />
      </div>
      {editMode && (
        <div style={{
          position: 'absolute', bottom: 4, left: 4, right: 4, zIndex: 2,
          display: 'flex', gap: 4, alignItems: 'center',
        }}>
          {element.loop && (
            <span style={{ background: 'var(--accent)', borderRadius: 3, padding: '1px 5px', fontSize: 9, color: 'white' }}>
              {t('loopBadge')}
            </span>
          )}
          <span style={{ fontSize: 9, opacity: 0.6, color: 'white' }}>
            {element.src.split('/').pop()}
          </span>
        </div>
      )}
    </div>
  );
}
