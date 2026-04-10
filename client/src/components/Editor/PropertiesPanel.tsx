import { useState } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { getVisibleRect, type SlideElement, type VideoElement, type TextElement } from '../../types';
import { useI18n } from '../../i18n';

type PreviewPos = Array<{ id: string; x: number; y: number; width: number; height: number }>;

interface Props {
  elements: SlideElement[];
  onUpdate: (element: SlideElement) => void;
  onUpdateMultiple: (elements: SlideElement[]) => void;
  onDelete: () => void;
  activeEditor: TiptapEditor | null;
  onAddText?: () => void;
  onPreview?: (positions: PreviewPos | null) => void;
  onReorder?: (elementId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  croppingId?: string | null;
  onStartCropping?: (id: string) => void;
  onStopCropping?: () => void;
  onSlideBgChange?: (color: string) => void;
  currentSlideBg?: string;
}

export function PropertiesPanel({ elements, onUpdate, onUpdateMultiple, onDelete, activeEditor, onAddText, onPreview, onReorder, croppingId, onStartCropping, onStopCropping, onSlideBgChange, currentSlideBg }: Props) {
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
        {onAddText && (
          <button onClick={onAddText} style={{
            width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '6px 0', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
            marginBottom: 12,
          }}>
            {t('addText')}
          </button>
        )}
        <p style={{ fontSize: 11, opacity: 0.4 }}>
          {t('dragHint')}
        </p>
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

      {element.type !== 'text' && (
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

      {element.type === 'video' && <VideoProps element={element} onUpdate={onUpdate} />}
      {element.type === 'text' && <TextProps element={element} onUpdate={onUpdate} activeEditor={activeEditor} />}

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
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3,
        padding: '3px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--text)',
      }}
    >
      {label}
    </button>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3,
        padding: '3px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--text)',
      }}
    >
      {label}
    </button>
  );
}

function VideoProps({ element, onUpdate }: { element: VideoElement; onUpdate: (el: SlideElement) => void }) {
  const { t } = useI18n();
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
      <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>{t('video')}</div>
      <Checkbox label={t('loop')} checked={element.loop} onChange={v => onUpdate({ ...element, loop: v })} />
      <Checkbox label={t('autoplay')} checked={element.autoplay} onChange={v => onUpdate({ ...element, autoplay: v })} />
      <Checkbox label={t('muted')} checked={element.muted} onChange={v => onUpdate({ ...element, muted: v })} />
    </div>
  );
}

function TextProps({ element, onUpdate, activeEditor }: { element: TextElement; onUpdate: (el: SlideElement) => void; activeEditor: TiptapEditor | null }) {
  const { t } = useI18n();
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
            activeEditor?.chain().focus().toggleBold().run();
          }}
          style={{
            ...formatBtnStyle,
            fontWeight: 700,
            background: activeEditor?.isActive('bold') ? 'var(--accent-light)' : 'var(--surface)',
          }}
        >
          B
        </button>
        <button
          onMouseDown={e => {
            e.preventDefault();
            activeEditor?.chain().focus().toggleItalic().run();
          }}
          style={{
            ...formatBtnStyle,
            fontStyle: 'italic',
            background: activeEditor?.isActive('italic') ? 'var(--accent-light)' : 'var(--surface)',
          }}
        >
          I
        </button>
      </div>
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
        width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3,
        cursor: 'pointer', fontSize: 11, color: danger ? 'var(--danger)' : 'var(--text)',
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
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3,
  padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text)',
  minWidth: 30, textAlign: 'center',
};
