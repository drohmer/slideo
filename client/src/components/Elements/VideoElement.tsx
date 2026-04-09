import type { VideoElement } from '../../types';

interface Props {
  element: VideoElement;
  editMode?: boolean;
  background?: string;
  selected?: boolean;
  hovered?: boolean;
}

export function VideoEl({ element, editMode, background = '#ffffff', selected, hovered }: Props) {
  const showGlow = hovered;

  return (
    <div
      style={{
        width: '100%', height: '100%', position: 'relative',
        boxShadow: showGlow ? '0 0 0 2px rgba(220,38,38,0.5)' : '0 0 0 0px rgba(220,38,38,0)',
        transition: showGlow ? 'box-shadow 0s' : 'box-shadow 0.2s',
      }}
    >
      {/* Video clipped inside */}
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', background }}>
        <video
          src={element.src}
          loop={element.loop}
          autoPlay={element.autoplay}
          muted={element.muted}
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: editMode ? 'none' : 'auto' }}
          controls
        />
      </div>
      {/* Selection outline */}
      {selected && (
        <div style={{
          position: 'absolute', inset: 0,
          border: '2px solid #4361ee',
          pointerEvents: 'none', zIndex: 2,
        }} />
      )}
      {editMode && (
        <div style={{
          position: 'absolute', bottom: 4, left: 4, right: 4, zIndex: 2,
          display: 'flex', gap: 4, alignItems: 'center',
        }}>
          {element.loop && (
            <span style={{ background: 'rgba(67,97,238,0.8)', borderRadius: 3, padding: '1px 5px', fontSize: 9, color: 'white' }}>
              boucle
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
