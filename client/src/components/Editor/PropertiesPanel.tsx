import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { getVisibleRect, type SlideElement, type VideoElement, type TextElement, type DrawingElement } from '../../types';
import { useI18n } from '../../i18n';

type PreviewPos = Array<{ id: string; x: number; y: number; width: number; height: number }>;

interface Props {
  elements: SlideElement[];
  onUpdate: (element: SlideElement) => void;
  onUpdateMultiple: (elements: SlideElement[]) => void;
  onDelete: () => void;
  activeEditor: TiptapEditor | null;
  onAddText?: () => void;
  onAddDrawing?: () => void;
  drawingMode?: boolean;
  drawingColor?: string;
  drawingWidth?: number;
  onDrawingColorChange?: (color: string) => void;
  onDrawingWidthChange?: (width: number) => void;
  onPreview?: (positions: PreviewPos | null) => void;
  onReorder?: (elementId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  croppingId?: string | null;
  onStartCropping?: (id: string) => void;
  onStopCropping?: () => void;
  onSlideBgChange?: (color: string) => void;
  currentSlideBg?: string;
  onToggleBoldItalic?: (key: string) => void;
  videoRefs?: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  onCaptureFrame?: (blob: Blob, width: number, height: number) => void;
}

export function PropertiesPanel({ elements, onUpdate, onUpdateMultiple, onDelete, activeEditor, onAddText, onAddDrawing, drawingMode, drawingColor, drawingWidth, onDrawingColorChange, onDrawingWidthChange, onPreview, onReorder, croppingId, onStartCropping, onStopCropping, onSlideBgChange, currentSlideBg, onToggleBoldItalic, videoRefs, onCaptureFrame }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

  if (collapsed) {
    return (
      <div style={{
        width: 32, background: 'var(--panel-bg)',
        borderLeft: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '6px 0', gap: 6,
      }}>
        <div
          onClick={() => setCollapsed(false)}
          title={t('showProps')}
          style={{ cursor: 'pointer', marginBottom: 2, fontSize: 10, opacity: 0.4 }}
        >{'\u25C0'}</div>
        {onAddText && (
          <MiniBtn title={t('addTextMini')} onClick={onAddText}>T</MiniBtn>
        )}
        {onAddDrawing && (
          <MiniBtn title={t('addDrawing')} onClick={onAddDrawing}>✎</MiniBtn>
        )}
        {elements.length > 0 && (
          <MiniBtn title={t('delete')} onClick={onDelete} danger>🗑</MiniBtn>
        )}
      </div>
    );
  }

  const collapseBtn = (
    <div
      onClick={() => setCollapsed(true)}
      title={t('hideProps')}
      style={{
        display: 'flex', justifyContent: 'flex-end', marginBottom: 4, cursor: 'pointer',
      }}
    >
      <span style={{
        background: 'var(--border-light)', borderRadius: 3,
        padding: '3px 8px', fontSize: 10, opacity: 0.5,
      }}>{'\u25B6'}</span>
    </div>
  );

  if (elements.length === 0) {
    return (
      <div style={{ ...panelStyle, background: 'var(--panel-bg)', borderLeft: '1px solid var(--border)', color: 'var(--text)' }}>
        {collapseBtn}
        <div style={labelStyle}>{t('tools')}</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {onAddText && (
            <button onClick={onAddText} style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '6px 0', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
            }}>
              {t('addText')}
            </button>
          )}
          {onAddDrawing && (
            <button onClick={onAddDrawing} style={{
              flex: 1, background: drawingMode ? 'var(--accent)' : 'var(--surface)',
              border: drawingMode ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 4, padding: '6px 0',
              color: drawingMode ? 'white' : 'var(--text)', fontSize: 12, cursor: 'pointer',
            }}>
              {drawingMode ? '✓ ' + t('drawing') : t('addDrawing')}
            </button>
          )}
        </div>
        {drawingMode && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ opacity: 0.5, fontSize: 10, marginBottom: 2 }}>{t('strokeColor')}</div>
              <input
                type="color"
                value={drawingColor ?? '#000000'}
                onChange={e => onDrawingColorChange?.(e.target.value)}
                style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', background: 'transparent' }}
              />
            </div>
            <div>
              <div style={{ opacity: 0.5, fontSize: 10, marginBottom: 2 }}>{t('strokeWidth')}: {drawingWidth ?? 3}</div>
              <input
                type="range" min={1} max={20}
                value={drawingWidth ?? 3}
                onChange={e => onDrawingWidthChange?.(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
            </div>
          </div>
        )}
        {!drawingMode && (
          <p style={{ fontSize: 11, opacity: 0.4 }}>
            {t('dragHint')}
          </p>
        )}
        {onSlideBgChange && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 12 }}>
            <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>{t('slideBg')}</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <button onClick={() => onSlideBgChange('#ffffff')} style={{
                width: 28, height: 28, background: '#ffffff', border: '1px solid rgba(0,0,0,0.2)',
                borderRadius: 3, cursor: 'pointer',
              }} title={t('white')} />
              <button onClick={() => onSlideBgChange('#000000')} style={{
                width: 28, height: 28, background: '#000000', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 3, cursor: 'pointer',
              }} title={t('black')} />
              <input
                type="color"
                value={currentSlideBg || '#ffffff'}
                onChange={e => onSlideBgChange(e.target.value)}
                title={t('custom')}
                style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'transparent' }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Multi-selection panel
  if (elements.length > 1) {
    return (
      <div style={{ ...panelStyle, background: 'var(--panel-bg)', borderLeft: '1px solid var(--border)', color: 'var(--text)' }}>
        {collapseBtn}
        <div style={labelStyle}>{t('multiSelection')}</div>
        <div style={{ fontSize: 12, marginBottom: 16, opacity: 0.6 }}>
          {elements.length} {t('nSelected')}
        </div>

        <AlignSection elements={elements} onUpdateMultiple={onUpdateMultiple} onPreview={onPreview} />

        <button
          onClick={onDelete}
          style={{
            marginTop: 16, width: '100%', background: 'var(--danger-light)', border: '1px solid var(--danger)',
            borderRadius: 4, padding: '6px 0', color: 'var(--danger)', fontSize: 12, cursor: 'pointer',
          }}
        >
          {t('delete')} ({elements.length})
        </button>
      </div>
    );
  }

  // Single element panel
  const element = elements[0];

  return (
    <div style={{ ...panelStyle, background: 'var(--panel-bg)', borderLeft: '1px solid var(--border)', color: 'var(--text)' }}>
      {collapseBtn}
      <div style={labelStyle}>{t('properties')}</div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 4 }}>{t('type')}</div>
        <div style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 13 }}>{element.type}</div>
      </div>

      {(element.type === 'video' || element.type === 'image') && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 4 }}>{t('file')}</div>
          <div style={{ fontSize: 11, wordBreak: 'break-all' }}>{element.src.split('/').pop()}</div>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 4 }}>{t('position')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Field label="X" value={Math.round(element.x)} onChange={v => onUpdate({ ...element, x: v })} />
          <Field label="Y" value={Math.round(element.y)} onChange={v => onUpdate({ ...element, y: v })} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 4 }}>{t('size')}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Field label="W" value={Math.round(element.width)} onChange={v => onUpdate({ ...element, width: v })} />
          <Field label="H" value={Math.round(element.height)} onChange={v => onUpdate({ ...element, height: v })} />
        </div>
      </div>

      {element.type === 'video' && <VideoProps element={element} onUpdate={onUpdate} videoRefs={videoRefs} onCaptureFrame={onCaptureFrame} />}
      {element.type === 'text' && <TextProps element={element} onUpdate={onUpdate} activeEditor={activeEditor} onToggleBoldItalic={onToggleBoldItalic} />}
      {element.type === 'drawing' && <DrawingProps element={element} onUpdate={onUpdate} />}

      {(element.type === 'image' || element.type === 'video') && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 8 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>{t('crop')}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => {
                if (croppingId === element.id) onStopCropping?.();
                else onStartCropping?.(element.id);
              }}
              style={{
                flex: 1, background: croppingId === element.id ? 'var(--accent)' : 'var(--surface)',
                color: croppingId === element.id ? 'var(--surface)' : 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 3,
                padding: '4px 8px', fontSize: 10, cursor: 'pointer',
              }}
            >
              {'✂ ' + (croppingId === element.id ? t('cropFinish') : t('cropStart'))}
            </button>
            {(element.cropTop || element.cropRight || element.cropBottom || element.cropLeft) ? (
              <button
                onClick={() => onUpdate({ ...element, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 })}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3,
                  padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--text)',
                }}
              >
                {t('reset')}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {onReorder && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 8 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>{t('order')}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <ActionBtn label={t('toFront')} onClick={() => onReorder(element.id, 'top')} />
            <ActionBtn label="↑" onClick={() => onReorder(element.id, 'up')} />
            <ActionBtn label="↓" onClick={() => onReorder(element.id, 'down')} />
            <ActionBtn label={t('toBack')} onClick={() => onReorder(element.id, 'bottom')} />
          </div>
        </div>
      )}

      <button
        onClick={onDelete}
        style={{
          marginTop: 16, width: '100%', background: 'var(--danger-light)', border: '1px solid var(--danger)',
          borderRadius: 4, padding: '6px 0', color: 'var(--danger)', fontSize: 12, cursor: 'pointer',
        }}
      >
        {t('delete')}
      </button>
    </div>
  );
}

function AlignSection({ elements, onUpdateMultiple, onPreview }: {
  elements: SlideElement[];
  onUpdateMultiple: (elements: SlideElement[]) => void;
  onPreview?: (positions: PreviewPos | null) => void;
}) {
  const { t } = useI18n();
  // Use visible rects (after crop) for alignment calculations
  const vis = elements.map(el => ({ el, v: getVisibleRect(el) }));

  const toPreview = (items: typeof vis): PreviewPos =>
    items.map(({ el, v }) => ({ id: el.id, x: v.x, y: v.y, width: v.width, height: v.height }));

  // Align by moving el.x/y so that the visible rect reaches the target position
  const alignLeft = () => {
    const minX = Math.min(...vis.map(({ v }) => v.x));
    return vis.map(({ el, v }) => ({ ...el, x: el.x + (minX - v.x) }));
  };
  const alignCenterH = () => {
    const avgCX = vis.reduce((s, { v }) => s + v.x + v.width / 2, 0) / vis.length;
    return vis.map(({ el, v }) => ({ ...el, x: Math.round(el.x + (avgCX - v.width / 2 - v.x)) }));
  };
  const alignRight = () => {
    const maxR = Math.max(...vis.map(({ v }) => v.x + v.width));
    return vis.map(({ el, v }) => ({ ...el, x: Math.round(el.x + (maxR - v.width - v.x)) }));
  };
  const alignTop = () => {
    const minY = Math.min(...vis.map(({ v }) => v.y));
    return vis.map(({ el, v }) => ({ ...el, y: el.y + (minY - v.y) }));
  };
  const alignCenterV = () => {
    const avgCY = vis.reduce((s, { v }) => s + v.y + v.height / 2, 0) / vis.length;
    return vis.map(({ el, v }) => ({ ...el, y: Math.round(el.y + (avgCY - v.height / 2 - v.y)) }));
  };
  const alignBottom = () => {
    const maxB = Math.max(...vis.map(({ v }) => v.y + v.height));
    return vis.map(({ el, v }) => ({ ...el, y: Math.round(el.y + (maxB - v.height - v.y)) }));
  };
  const sameWidth = () => {
    const maxW = Math.max(...vis.map(({ v }) => v.width));
    return vis.map(({ el, v }) => ({ ...el, width: Math.round(el.width * maxW / v.width) }));
  };
  const sameHeight = () => {
    const maxH = Math.max(...vis.map(({ v }) => v.height));
    return vis.map(({ el, v }) => ({ ...el, height: Math.round(el.height * maxH / v.height) }));
  };
  const sameBoth = () => {
    const maxW = Math.max(...vis.map(({ v }) => v.width));
    const maxH = Math.max(...vis.map(({ v }) => v.height));
    return vis.map(({ el, v }) => ({ ...el, width: Math.round(el.width * maxW / v.width), height: Math.round(el.height * maxH / v.height) }));
  };

  const previewFn = (compute: () => SlideElement[]) => () => {
    const result = compute();
    onPreview?.(result.map(el => { const v = getVisibleRect(el); return { id: el.id, x: v.x, y: v.y, width: v.width, height: v.height }; }));
  };
  const clearPreview = () => onPreview?.(null);
  const apply = (compute: () => SlideElement[]) => () => { onUpdateMultiple(compute()); onPreview?.(null); };

  return (
    <>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>{t('alignH')}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PreviewBtn label={t('left')} onClick={apply(alignLeft)} onEnter={previewFn(alignLeft)} onLeave={clearPreview} />
          <PreviewBtn label={t('center')} onClick={apply(alignCenterH)} onEnter={previewFn(alignCenterH)} onLeave={clearPreview} />
          <PreviewBtn label={t('right')} onClick={apply(alignRight)} onEnter={previewFn(alignRight)} onLeave={clearPreview} />
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>{t('alignV')}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PreviewBtn label={t('top')} onClick={apply(alignTop)} onEnter={previewFn(alignTop)} onLeave={clearPreview} />
          <PreviewBtn label={t('center')} onClick={apply(alignCenterV)} onEnter={previewFn(alignCenterV)} onLeave={clearPreview} />
          <PreviewBtn label={t('bottom')} onClick={apply(alignBottom)} onEnter={previewFn(alignBottom)} onLeave={clearPreview} />
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>{t('sameSize')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <PreviewBtn label={t('width')} onClick={apply(sameWidth)} onEnter={previewFn(sameWidth)} onLeave={clearPreview} />
          <PreviewBtn label={t('height')} onClick={apply(sameHeight)} onEnter={previewFn(sameHeight)} onLeave={clearPreview} />
          <PreviewBtn label={t('both')} onClick={apply(sameBoth)} onEnter={previewFn(sameBoth)} onLeave={clearPreview} />
        </div>
      </div>
    </>
  );
}

function PreviewBtn({ label, onClick, onEnter, onLeave }: {
  label: string; onClick: () => void; onEnter: () => void; onLeave: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={panelBtnStyle}
    >
      {label}
    </button>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={panelBtnStyle}>
      {label}
    </button>
  );
}

const panelBtnStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4,
  padding: '5px 10px', fontSize: 11, cursor: 'pointer', color: 'var(--text)',
  minHeight: 26,
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];
const FRAME_STEP = 1 / 30;

function VideoProps({ element, onUpdate, videoRefs, onCaptureFrame }: { element: VideoElement; onUpdate: (el: SlideElement) => void; videoRefs?: React.MutableRefObject<Map<string, HTMLVideoElement>>; onCaptureFrame?: (blob: Blob, width: number, height: number) => void }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const rafRef = useRef<number>(0);
  const seekingRef = useRef(false);

  const getVideo = useCallback(() => videoRefs?.current.get(element.id) ?? null, [videoRefs, element.id]);

  // Sync playback state from video element
  useEffect(() => {
    const video = getVideo();
    if (!video) return;

    setDuration(video.duration || 0);
    setPlaying(!video.paused);
    setCurrentTime(video.currentTime);
    setPlaybackRate(video.playbackRate);

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => setDuration(video.duration || 0);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onMeta);

    const tick = () => {
      if (!seekingRef.current) setCurrentTime(video.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadedmetadata', onMeta);
      cancelAnimationFrame(rafRef.current);
    };
  }, [getVideo]);

  const togglePlay = () => {
    const video = getVideo();
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const handleStop = () => {
    const video = getVideo();
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  const handleStep = (delta: number) => {
    const video = getVideo();
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + delta));
  };

  const handleSpeedChange = (rate: number) => {
    const video = getVideo();
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleCaptureFrame = () => {
    const video = getVideo();
    if (!video || !onCaptureFrame) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) onCaptureFrame(blob, canvas.width, canvas.height);
    }, 'image/png');
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = getVideo();
    if (!video) return;
    const v = Number(e.target.value);
    video.currentTime = v;
    setCurrentTime(v);
  };

  const btnStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3,
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 12, color: 'var(--text)', flexShrink: 0,
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
      <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>{t('video')}</div>

      {duration > 0 && (
        <div style={{ marginBottom: 8 }}>
          {/* Playback controls row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <button onClick={() => handleStep(-FRAME_STEP)} style={btnStyle} title={t('videoStepBack')}>⏮</button>
            <button onClick={togglePlay} style={btnStyle} title={playing ? t('videoStop') : undefined}>
              {playing ? '⏸' : '▶'}
            </button>
            <button onClick={handleStop} style={btnStyle} title={t('videoStop')}>⏹</button>
            <button onClick={() => handleStep(FRAME_STEP)} style={btnStyle} title={t('videoStepForward')}>⏭</button>
            <span style={{ fontSize: 9, opacity: 0.6, whiteSpace: 'nowrap', marginLeft: 2 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            onPointerDown={() => { seekingRef.current = true; }}
            onPointerUp={() => { seekingRef.current = false; }}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', marginBottom: 6 }}
          />

          {/* Speed buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, opacity: 0.5, marginRight: 2 }}>{t('videoSpeed')}</span>
            {SPEED_OPTIONS.map(rate => (
              <button
                key={rate}
                onClick={() => handleSpeedChange(rate)}
                style={{
                  ...btnStyle,
                  width: 'auto', padding: '0 5px', fontSize: 10,
                  background: playbackRate === rate ? 'var(--accent)' : 'var(--surface)',
                  color: playbackRate === rate ? 'white' : 'var(--text)',
                  borderColor: playbackRate === rate ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {rate === 1 ? '1×' : rate < 1 ? `${rate}×` : `${rate}×`}
              </button>
            ))}
          </div>

          {onCaptureFrame && (
            <button
              onClick={handleCaptureFrame}
              style={{
                marginTop: 6, width: '100%', padding: '4px 8px', fontSize: 10,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3,
                cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
              title={t('captureFrame')}
            >
              📷 {t('captureFrame')}
            </button>
          )}
        </div>
      )}

      <Checkbox label={t('loop')} checked={element.loop} onChange={v => onUpdate({ ...element, loop: v })} />
      <Checkbox label={t('autoplay')} checked={element.autoplay} onChange={v => onUpdate({ ...element, autoplay: v })} />
      <Checkbox label={t('muted')} checked={element.muted} onChange={v => onUpdate({ ...element, muted: v })} />
    </div>
  );
}

function TextProps({ element, onUpdate, activeEditor, onToggleBoldItalic }: { element: TextElement; onUpdate: (el: SlideElement) => void; activeEditor: TiptapEditor | null; onToggleBoldItalic?: (key: string) => void }) {
  const { t } = useI18n();
  const isBold = activeEditor ? activeEditor.isActive('bold') : element.content.includes('<strong>');
  const isItalic = activeEditor ? activeEditor.isActive('italic') : element.content.includes('<em>');
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
      <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>{t('text')}</div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ opacity: 0.5, fontSize: 10, marginBottom: 2 }}>{t('fontSize')}</div>
        <input
          type="number"
          value={element.fontSize}
          onChange={e => onUpdate({ ...element, fontSize: Number(e.target.value) })}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ opacity: 0.5, fontSize: 10, marginBottom: 2 }}>{t('color')}</div>
        <input
          type="color"
          value={element.color}
          onChange={e => onUpdate({ ...element, color: e.target.value })}
          style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', background: 'transparent' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button
          onMouseDown={e => {
            e.preventDefault();
            if (activeEditor) activeEditor.chain().focus().toggleBold().run();
            else onToggleBoldItalic?.('b');
          }}
          style={{
            ...formatBtnStyle,
            fontWeight: 700,
            background: isBold ? 'var(--accent-light)' : 'var(--surface)',
          }}
        >
          B
        </button>
        <button
          onMouseDown={e => {
            e.preventDefault();
            if (activeEditor) activeEditor.chain().focus().toggleItalic().run();
            else onToggleBoldItalic?.('i');
          }}
          style={{
            ...formatBtnStyle,
            fontStyle: 'italic',
            background: isItalic ? 'var(--accent-light)' : 'var(--surface)',
          }}
        >
          I
        </button>
      </div>
    </div>
  );
}

function DrawingProps({ element, onUpdate }: { element: DrawingElement; onUpdate: (el: SlideElement) => void }) {
  const { t } = useI18n();
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
      <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>{t('drawing')}</div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ opacity: 0.5, fontSize: 10, marginBottom: 2 }}>{t('strokeColor')}</div>
        <input
          type="color"
          value={element.strokeColor}
          onChange={e => onUpdate({ ...element, strokeColor: e.target.value })}
          style={{ width: '100%', height: 28, border: 'none', cursor: 'pointer', background: 'transparent' }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ opacity: 0.5, fontSize: 10, marginBottom: 2 }}>{t('strokeWidth')}: {element.strokeWidth}</div>
        <input
          type="range"
          min={1}
          max={20}
          value={element.strokeWidth}
          onChange={e => onUpdate({ ...element, strokeWidth: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
      </div>
      {element.strokes.length > 0 && (
        <button
          onClick={() => onUpdate({ ...element, strokes: [] })}
          style={{
            width: '100%', background: 'var(--danger-light)', border: '1px solid var(--danger)',
            borderRadius: 3, padding: '4px 0', color: 'var(--danger)', fontSize: 11, cursor: 'pointer',
          }}
        >
          {t('clearDrawing')}
        </button>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <span style={{ fontSize: 9, opacity: 0.4 }}>{label}: </span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={inputStyle}
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, cursor: 'pointer', fontSize: 12 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
      {label}
    </label>
  );
}

function MiniBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4,
        cursor: 'pointer', fontSize: 12, color: danger ? 'var(--danger)' : 'var(--text)',
      }}
    >{children}</button>
  );
}

const panelStyle: React.CSSProperties = {
  width: 190, padding: 12,
  fontSize: 11, overflowY: 'auto', flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', opacity: 0.4, marginBottom: 12, letterSpacing: 1,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 3, padding: '3px 6px', color: 'var(--text)', fontSize: 11,
};

const formatBtnStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4,
  padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text)',
  minWidth: 34, minHeight: 28, textAlign: 'center',
};
