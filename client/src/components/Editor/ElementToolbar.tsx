import { useState, useEffect, useCallback, useRef } from 'react';
import type { SlideElement, TextElement, VideoElement } from '../../types';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { useI18n } from '../../i18n';

const FRAME_STEP = 1 / 30;

interface Props {
  element: SlideElement;
  onUpdate: (element: SlideElement) => void;
  onDelete: () => void;
  onStartCropping: () => void;
  isCropping: boolean;
  activeEditor: TiptapEditor | null;
  onToggleBoldItalic?: (key: string) => void;
  videoRefs?: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}

export function ElementToolbar({ element, onUpdate, onDelete, onStartCropping, isCropping, activeEditor, onToggleBoldItalic, videoRefs }: Props) {
  const { t } = useI18n();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '3px 6px',
        background: 'var(--surface)',
        borderRadius: 6,
        boxShadow: 'var(--shadow)',
        zIndex: 300,
        whiteSpace: 'nowrap',
      }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {element.type === 'text' && <TextToolbar element={element} onUpdate={onUpdate} activeEditor={activeEditor} onToggleBoldItalic={onToggleBoldItalic} />}
      {element.type === 'video' && videoRefs && (
        <>
          <VideoToolbar element={element} videoRefs={videoRefs} />
          <Sep />
        </>
      )}
      {(element.type === 'image' || element.type === 'video') && (
        <MediaToolbar onStartCropping={onStartCropping} isCropping={isCropping} />
      )}
      <Sep />
      <ToolBtn label="🗑" title={t('delete')} onClick={onDelete} />
    </div>
  );
}

function TextToolbar({ element, onUpdate, activeEditor, onToggleBoldItalic }: {
  element: TextElement;
  onUpdate: (el: SlideElement) => void;
  activeEditor: TiptapEditor | null;
  onToggleBoldItalic?: (key: string) => void;
}) {
  const { t } = useI18n();
  const isBold = activeEditor ? activeEditor.isActive('bold') : element.content.includes('<strong>');
  const isItalic = activeEditor ? activeEditor.isActive('italic') : element.content.includes('<em>');
  return (
    <>
      <ToolBtn
        label="A−"
        title={t('fontSmaller')}
        onClick={() => onUpdate({ ...element, fontSize: Math.max(8, element.fontSize - 2) })}
      />
      <span style={{ fontSize: 10, minWidth: 22, textAlign: 'center', color: 'var(--text-muted)' }}>
        {element.fontSize}
      </span>
      <ToolBtn
        label="A+"
        title={t('fontLarger')}
        onClick={() => onUpdate({ ...element, fontSize: element.fontSize + 2 })}
      />
      <Sep />
      <ToolBtn
        label="B"
        title={t('bold')}
        active={isBold}
        onClick={() => {
          if (activeEditor) activeEditor.chain().focus().toggleBold().run();
          else onToggleBoldItalic?.('b');
        }}
        bold
      />
      <ToolBtn
        label="I"
        title={t('italic')}
        active={isItalic}
        onClick={() => {
          if (activeEditor) activeEditor.chain().focus().toggleItalic().run();
          else onToggleBoldItalic?.('i');
        }}
        italic
      />
      <Sep />
      <input
        type="color"
        value={element.color}
        onChange={e => onUpdate({ ...element, color: e.target.value })}
        title={t('color')}
        style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 4, padding: 0, cursor: 'pointer', background: 'transparent' }}
      />
    </>
  );
}

function VideoToolbar({ element, videoRefs }: {
  element: VideoElement;
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number>(0);

  const getVideo = useCallback(
    () => videoRefs.current.get(element.id) ?? null,
    [videoRefs, element.id],
  );

  useEffect(() => {
    const video = getVideo();
    if (!video) return;
    setPlaying(!video.paused);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      cancelAnimationFrame(rafRef.current);
    };
  }, [getVideo]);

  const togglePlay = () => {
    const v = getVideo();
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const step = (delta: number) => {
    const v = getVideo();
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  };

  return (
    <>
      <ToolBtn label="⏮" title={t('videoStepBack')} onClick={() => step(-FRAME_STEP)} />
      <ToolBtn label={playing ? '⏸' : '▶'} title={playing ? t('videoStop') : 'Play'} onClick={togglePlay} />
      <ToolBtn label="⏭" title={t('videoStepForward')} onClick={() => step(FRAME_STEP)} />
    </>
  );
}

function MediaToolbar({ onStartCropping, isCropping }: {
  onStartCropping: () => void;
  isCropping: boolean;
}) {
  const { t } = useI18n();
  return (
    <ToolBtn
      label="✂"
      title={isCropping ? t('cropFinishTooltip') : t('cropTooltip')}
      active={isCropping}
      onClick={onStartCropping}
    />
  );
}

function ToolBtn({ label, title, onClick, active, bold, italic }: {
  label: string; title: string; onClick?: () => void;
  active?: boolean; bold?: boolean; italic?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'var(--accent-light)' : 'transparent',
        border: 'none',
        borderRadius: 4,
        padding: '4px 8px',
        fontSize: 12,
        cursor: 'pointer',
        color: active ? 'var(--accent)' : 'var(--text)',
        fontWeight: bold ? 700 : 400,
        fontStyle: italic ? 'italic' : 'normal',
        lineHeight: 1.2,
        minWidth: 28,
        minHeight: 26,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px' }} />;
}
