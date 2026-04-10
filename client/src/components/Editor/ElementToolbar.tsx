import type { SlideElement, TextElement } from '../../types';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { useI18n } from '../../i18n';

interface Props {
  element: SlideElement;
  onUpdate: (element: SlideElement) => void;
  onDelete: () => void;
  onStartCropping: () => void;
  isCropping: boolean;
  activeEditor: TiptapEditor | null;
}

export function ElementToolbar({ element, onUpdate, onDelete, onStartCropping, isCropping, activeEditor }: Props) {
  const { t } = useI18n();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '2px 4px',
        background: 'rgba(255,255,255,0.95)',
        borderRadius: 4,
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        zIndex: 300,
        whiteSpace: 'nowrap',
      }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {element.type === 'text' && <TextToolbar element={element} onUpdate={onUpdate} activeEditor={activeEditor} />}
      {(element.type === 'image' || element.type === 'video') && (
        <MediaToolbar onStartCropping={onStartCropping} isCropping={isCropping} />
      )}
      <Sep />
      <ToolBtn label="🗑" title={t('delete')} onClick={onDelete} />
    </div>
  );
}

function TextToolbar({ element, onUpdate, activeEditor }: {
  element: TextElement;
  onUpdate: (el: SlideElement) => void;
  activeEditor: TiptapEditor | null;
}) {
  const { t } = useI18n();
  return (
    <>
      <ToolBtn
        label="A−"
        title={t('fontSmaller')}
        onClick={() => onUpdate({ ...element, fontSize: Math.max(8, element.fontSize - 2) })}
      />
      <span style={{ fontSize: 10, minWidth: 20, textAlign: 'center', color: '#666' }}>
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
        active={activeEditor?.isActive('bold')}
        onClick={() => activeEditor?.chain().focus().toggleBold().run()}
        bold
      />
      <ToolBtn
        label="I"
        title={t('italic')}
        active={activeEditor?.isActive('italic')}
        onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
        italic
      />
      <Sep />
      <input
        type="color"
        value={element.color}
        onChange={e => onUpdate({ ...element, color: e.target.value })}
        title={t('color')}
        style={{ width: 20, height: 20, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'transparent' }}
      />
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
        background: active ? '#e8ecff' : 'transparent',
        border: 'none',
        borderRadius: 3,
        padding: '2px 5px',
        fontSize: 11,
        cursor: 'pointer',
        color: active ? '#4361ee' : '#333',
        fontWeight: bold ? 700 : 400,
        fontStyle: italic ? 'italic' : 'normal',
        lineHeight: 1.2,
      }}
    >
      {label}
    </button>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.12)', margin: '0 2px' }} />;
}
