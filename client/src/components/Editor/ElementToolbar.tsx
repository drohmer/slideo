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
  onToggleBoldItalic?: (key: string) => void;
}

export function ElementToolbar({ element, onUpdate, onDelete, onStartCropping, isCropping, activeEditor, onToggleBoldItalic }: Props) {
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
        background: 'var(--surface)',
        borderRadius: 4,
        boxShadow: 'var(--shadow)',
        zIndex: 300,
        whiteSpace: 'nowrap',
      }}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {element.type === 'text' && <TextToolbar element={element} onUpdate={onUpdate} activeEditor={activeEditor} onToggleBoldItalic={onToggleBoldItalic} />}
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
      <span style={{ fontSize: 10, minWidth: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
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
        style={{ width: 20, height: 20, border: '1px solid var(--border)', borderRadius: 3, padding: 0, cursor: 'pointer', background: 'transparent' }}
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
        background: active ? 'var(--accent-light)' : 'transparent',
        border: 'none',
        borderRadius: 3,
        padding: '2px 5px',
        fontSize: 11,
        cursor: 'pointer',
        color: active ? 'var(--accent)' : 'var(--text)',
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
  return <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 2px' }} />;
}
