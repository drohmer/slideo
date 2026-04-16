import { useEffect, useLayoutEffect, useRef } from 'react';
import type { VideoElement } from '../../types';
import { useI18n } from '../../i18n';

interface Props {
  element: VideoElement;
  editMode?: boolean;
  background?: string;
  videoRefs?: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}

function hexToRgb255(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function VideoEl({ element, editMode, background = '#ffffff', videoRefs }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chromaKeyRef = useRef(element.chromaKey);
  const rafRef = useRef<number>(0);

  // Keep chromaKeyRef current without re-triggering the RAF effect
  useLayoutEffect(() => {
    chromaKeyRef.current = element.chromaKey;
  });

  // Register video for PropertiesPanel controls
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoRefs) return;
    videoRefs.current.set(element.id, el);
    return () => { videoRefs.current.delete(element.id); };
  }, [element.id, videoRefs]);

  // Chroma key RAF — canvas is always in DOM so canvasRef is always available
  useEffect(() => {
    if (!element.chromaKey) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    const draw = () => {
      if (!running) return;
      const ck = chromaKeyRef.current;
      if (ck && video.readyState >= 2) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const cw = canvas.width;
        const ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);
        if (vw > 0 && vh > 0) {
          // object-fit: cover — scale to fill, crop excess, no stretching
          let sx = 0, sy = 0, sw = vw, sh = vh;
          const videoAspect = vw / vh;
          const canvasAspect = cw / ch;
          if (videoAspect > canvasAspect) {
            sw = vh * canvasAspect;
            sx = (vw - sw) / 2;
          } else if (videoAspect < canvasAspect) {
            sh = vw / canvasAspect;
            sy = (vh - sh) / 2;
          }
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
        }
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        const [kr, kg, kb] = hexToRgb255(ck.color);
        // Squared Euclidean distance in [0-255] space to avoid sqrt
        const tolSq = (ck.tolerance * 255) ** 2;
        for (let i = 0; i < d.length; i += 4) {
          const dr = d[i] - kr;
          const dg = d[i + 1] - kg;
          const db = d[i + 2] - kb;
          if (dr * dr + dg * dg + db * db < tolSq) d[i + 3] = 0;
        }
        ctx.putImageData(imageData, 0, 0);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!element.chromaKey]);

  const chromaKey = element.chromaKey;

  return (
    // Single container — position:relative so the absolute canvas overlays the video
    <div style={{
      width: '100%', height: '100%',
      position: 'relative', overflow: 'hidden',
      background: chromaKey ? 'transparent' : background,
    }}>
      <video
        ref={videoRef}
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
          // opacity:0 hides the video but keeps decode/playback running for the canvas
          opacity: chromaKey ? 0 : 1,
        }}
        controls={!chromaKey}
      />

      {/* Canvas always in DOM so canvasRef is set before the effect runs */}
      <canvas
        ref={canvasRef}
        width={element.width}
        height={element.height}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          display: chromaKey ? 'block' : 'none',
          pointerEvents: editMode ? 'none' : 'auto',
        }}
      />

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
