import type { Editor as TiptapEditor } from '@tiptap/react';
import type { SlideElement, VideoElement, TextElement } from '../../types';

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
}

export function PropertiesPanel({ elements, onUpdate, onUpdateMultiple, onDelete, activeEditor, onAddText, onPreview, onReorder, croppingId, onStartCropping, onStopCropping }: Props) {
  if (elements.length === 0) {
    return (
      <div style={panelStyle}>
        <div style={labelStyle}>Outils</div>
        {onAddText && (
          <button onClick={onAddText} style={{
            width: '100%', background: '#fff', border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 4, padding: '6px 0', color: '#1a1a1a', fontSize: 12, cursor: 'pointer',
            marginBottom: 12,
          }}>
            + Texte
          </button>
        )}
        <p style={{ fontSize: 11, opacity: 0.4 }}>
          Glissez des fichiers sur le canvas pour ajouter des vidéos ou images
        </p>
      </div>
    );
  }

  // Multi-selection panel
  if (elements.length > 1) {
    return (
      <div style={panelStyle}>
        <div style={labelStyle}>Multi-sélection</div>
        <div style={{ fontSize: 12, marginBottom: 16, opacity: 0.6 }}>
          {elements.length} éléments sélectionnés
        </div>

        <AlignSection elements={elements} onUpdateMultiple={onUpdateMultiple} onPreview={onPreview} />

        <button
          onClick={onDelete}
          style={{
            marginTop: 16, width: '100%', background: 'rgba(233,69,96,0.15)', border: '1px solid #e94560',
            borderRadius: 4, padding: '6px 0', color: '#e94560', fontSize: 12, cursor: 'pointer',
          }}
        >
          Supprimer ({elements.length})
        </button>
      </div>
    );
  }

  // Single element panel
  const element = elements[0];

  return (
    <div style={panelStyle}>
      <div style={labelStyle}>Propriétés</div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 4 }}>Type</div>
        <div style={{ fontWeight: 600, color: '#4361ee', fontSize: 13 }}>{element.type}</div>
      </div>

      {element.type !== 'text' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 4 }}>Fichier</div>
          <div style={{ fontSize: 11, wordBreak: 'break-all' }}>{element.src.split('/').pop()}</div>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 4 }}>Position</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Field label="X" value={Math.round(element.x)} onChange={v => onUpdate({ ...element, x: v })} />
          <Field label="Y" value={Math.round(element.y)} onChange={v => onUpdate({ ...element, y: v })} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 4 }}>Taille</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Field label="W" value={Math.round(element.width)} onChange={v => onUpdate({ ...element, width: v })} />
          <Field label="H" value={Math.round(element.height)} onChange={v => onUpdate({ ...element, height: v })} />
        </div>
      </div>

      {element.type === 'video' && <VideoProps element={element} onUpdate={onUpdate} />}
      {element.type === 'text' && <TextProps element={element} onUpdate={onUpdate} activeEditor={activeEditor} />}

      {(element.type === 'image' || element.type === 'video') && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginTop: 8 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>Rogner</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => {
                if (croppingId === element.id) onStopCropping?.();
                else onStartCropping?.(element.id);
              }}
              style={{
                flex: 1, background: croppingId === element.id ? '#4361ee' : '#fff',
                color: croppingId === element.id ? '#fff' : '#1a1a1a',
                border: '1px solid rgba(0,0,0,0.15)', borderRadius: 3,
                padding: '4px 8px', fontSize: 10, cursor: 'pointer',
              }}
            >
              ✂ {croppingId === element.id ? 'Terminer' : 'Rogner'}
            </button>
            {(element.cropTop || element.cropRight || element.cropBottom || element.cropLeft) ? (
              <button
                onClick={() => onUpdate({ ...element, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 })}
                style={{
                  background: '#fff', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 3,
                  padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: '#1a1a1a',
                }}
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      )}

      {onReorder && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginTop: 8 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>Ordre</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <ActionBtn label="Premier plan" onClick={() => onReorder(element.id, 'top')} />
            <ActionBtn label="Avancer" onClick={() => onReorder(element.id, 'up')} />
            <ActionBtn label="Reculer" onClick={() => onReorder(element.id, 'down')} />
            <ActionBtn label="Arrière-plan" onClick={() => onReorder(element.id, 'bottom')} />
          </div>
        </div>
      )}

      <button
        onClick={onDelete}
        style={{
          marginTop: 16, width: '100%', background: 'rgba(233,69,96,0.15)', border: '1px solid #e94560',
          borderRadius: 4, padding: '6px 0', color: '#e94560', fontSize: 12, cursor: 'pointer',
        }}
      >
        Supprimer
      </button>
    </div>
  );
}

function AlignSection({ elements, onUpdateMultiple, onPreview }: {
  elements: SlideElement[];
  onUpdateMultiple: (elements: SlideElement[]) => void;
  onPreview?: (positions: PreviewPos | null) => void;
}) {
  const toPreview = (els: SlideElement[]): PreviewPos =>
    els.map(el => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }));

  const alignLeft = () => {
    const minX = Math.min(...elements.map(el => el.x));
    return elements.map(el => ({ ...el, x: minX }));
  };
  const alignCenterH = () => {
    const avgCX = elements.reduce((s, el) => s + el.x + el.width / 2, 0) / elements.length;
    return elements.map(el => ({ ...el, x: Math.round(avgCX - el.width / 2) }));
  };
  const alignRight = () => {
    const maxR = Math.max(...elements.map(el => el.x + el.width));
    return elements.map(el => ({ ...el, x: maxR - el.width }));
  };
  const alignTop = () => {
    const minY = Math.min(...elements.map(el => el.y));
    return elements.map(el => ({ ...el, y: minY }));
  };
  const alignCenterV = () => {
    const avgCY = elements.reduce((s, el) => s + el.y + el.height / 2, 0) / elements.length;
    return elements.map(el => ({ ...el, y: Math.round(avgCY - el.height / 2) }));
  };
  const alignBottom = () => {
    const maxB = Math.max(...elements.map(el => el.y + el.height));
    return elements.map(el => ({ ...el, y: maxB - el.height }));
  };
  const sameWidth = () => {
    const maxW = Math.max(...elements.map(el => el.width));
    return elements.map(el => ({ ...el, width: maxW }));
  };
  const sameHeight = () => {
    const maxH = Math.max(...elements.map(el => el.height));
    return elements.map(el => ({ ...el, height: maxH }));
  };
  const sameBoth = () => {
    const maxW = Math.max(...elements.map(el => el.width));
    const maxH = Math.max(...elements.map(el => el.height));
    return elements.map(el => ({ ...el, width: maxW, height: maxH }));
  };

  const preview = (compute: () => SlideElement[]) => () => onPreview?.(toPreview(compute()));
  const clearPreview = () => onPreview?.(null);
  const apply = (compute: () => SlideElement[]) => () => { onUpdateMultiple(compute()); onPreview?.(null); };

  return (
    <>
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>Aligner horizontalement</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PreviewBtn label="Gauche" onClick={apply(alignLeft)} onEnter={preview(alignLeft)} onLeave={clearPreview} />
          <PreviewBtn label="Centre" onClick={apply(alignCenterH)} onEnter={preview(alignCenterH)} onLeave={clearPreview} />
          <PreviewBtn label="Droite" onClick={apply(alignRight)} onEnter={preview(alignRight)} onLeave={clearPreview} />
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>Aligner verticalement</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PreviewBtn label="Haut" onClick={apply(alignTop)} onEnter={preview(alignTop)} onLeave={clearPreview} />
          <PreviewBtn label="Centre" onClick={apply(alignCenterV)} onEnter={preview(alignCenterV)} onLeave={clearPreview} />
          <PreviewBtn label="Bas" onClick={apply(alignBottom)} onEnter={preview(alignBottom)} onLeave={clearPreview} />
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginBottom: 12 }}>
        <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>Même taille</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <PreviewBtn label="Largeur" onClick={apply(sameWidth)} onEnter={preview(sameWidth)} onLeave={clearPreview} />
          <PreviewBtn label="Hauteur" onClick={apply(sameHeight)} onEnter={preview(sameHeight)} onLeave={clearPreview} />
          <PreviewBtn label="Les deux" onClick={apply(sameBoth)} onEnter={preview(sameBoth)} onLeave={clearPreview} />
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
        background: '#fff', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 3,
        padding: '3px 8px', fontSize: 10, cursor: 'pointer', color: '#1a1a1a',
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
        background: '#fff', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 3,
        padding: '3px 8px', fontSize: 10, cursor: 'pointer', color: '#1a1a1a',
      }}
    >
      {label}
    </button>
  );
}

function VideoProps({ element, onUpdate }: { element: VideoElement; onUpdate: (el: SlideElement) => void }) {
  return (
    <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginTop: 4 }}>
      <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>Vidéo</div>
      <Checkbox label="Boucle" checked={element.loop} onChange={v => onUpdate({ ...element, loop: v })} />
      <Checkbox label="Auto-play" checked={element.autoplay} onChange={v => onUpdate({ ...element, autoplay: v })} />
      <Checkbox label="Muet" checked={element.muted} onChange={v => onUpdate({ ...element, muted: v })} />
    </div>
  );
}

function TextProps({ element, onUpdate, activeEditor }: { element: TextElement; onUpdate: (el: SlideElement) => void; activeEditor: TiptapEditor | null }) {
  return (
    <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginTop: 4 }}>
      <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 6 }}>Texte</div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ opacity: 0.5, fontSize: 10, marginBottom: 2 }}>Taille police</div>
        <input
          type="number"
          value={element.fontSize}
          onChange={e => onUpdate({ ...element, fontSize: Number(e.target.value) })}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ opacity: 0.5, fontSize: 10, marginBottom: 2 }}>Couleur</div>
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
            background: activeEditor?.isActive('bold') ? '#e0e0e0' : '#fff',
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
            background: activeEditor?.isActive('italic') ? '#e0e0e0' : '#fff',
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
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: '#4361ee' }} />
      {label}
    </label>
  );
}

const panelStyle: React.CSSProperties = {
  width: 190, background: '#ebe6e0', padding: 12, borderLeft: '1px solid rgba(0,0,0,0.1)',
  fontSize: 11, overflowY: 'auto', flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, textTransform: 'uppercase', opacity: 0.4, marginBottom: 12, letterSpacing: 1,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 3, padding: '3px 6px', color: '#1a1a1a', fontSize: 11,
};

const formatBtnStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 3,
  padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: '#1a1a1a',
  minWidth: 30, textAlign: 'center',
};
