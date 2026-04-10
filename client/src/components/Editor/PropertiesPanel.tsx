import type { Editor as TiptapEditor } from '@tiptap/react';
import type { SlideElement, VideoElement, TextElement } from '../../types';

interface Props {
  elements: SlideElement[];
  onUpdate: (element: SlideElement) => void;
  onUpdateMultiple: (elements: SlideElement[]) => void;
  onDelete: () => void;
  activeEditor: TiptapEditor | null;
}

export function PropertiesPanel({ elements, onUpdate, onUpdateMultiple, onDelete, activeEditor }: Props) {
  if (elements.length === 0) {
    return (
      <div style={panelStyle}>
        <div style={labelStyle}>Propriétés</div>
        <p style={{ fontSize: 12, opacity: 0.4, marginTop: 12 }}>
          Sélectionnez un élément pour voir ses propriétés
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

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginBottom: 12 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>Aligner horizontalement</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <ActionBtn label="Gauche" onClick={() => {
              const minX = Math.min(...elements.map(el => el.x));
              onUpdateMultiple(elements.map(el => ({ ...el, x: minX })));
            }} />
            <ActionBtn label="Centre" onClick={() => {
              const avgCenterX = elements.reduce((sum, el) => sum + el.x + el.width / 2, 0) / elements.length;
              onUpdateMultiple(elements.map(el => ({ ...el, x: Math.round(avgCenterX - el.width / 2) })));
            }} />
            <ActionBtn label="Droite" onClick={() => {
              const maxRight = Math.max(...elements.map(el => el.x + el.width));
              onUpdateMultiple(elements.map(el => ({ ...el, x: maxRight - el.width })));
            }} />
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginBottom: 12 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>Aligner verticalement</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <ActionBtn label="Haut" onClick={() => {
              const minY = Math.min(...elements.map(el => el.y));
              onUpdateMultiple(elements.map(el => ({ ...el, y: minY })));
            }} />
            <ActionBtn label="Centre" onClick={() => {
              const avgCenterY = elements.reduce((sum, el) => sum + el.y + el.height / 2, 0) / elements.length;
              onUpdateMultiple(elements.map(el => ({ ...el, y: Math.round(avgCenterY - el.height / 2) })));
            }} />
            <ActionBtn label="Bas" onClick={() => {
              const maxBottom = Math.max(...elements.map(el => el.y + el.height));
              onUpdateMultiple(elements.map(el => ({ ...el, y: maxBottom - el.height })));
            }} />
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginBottom: 12 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>Même taille</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <ActionBtn label="Largeur" onClick={() => {
              const maxW = Math.max(...elements.map(el => el.width));
              onUpdateMultiple(elements.map(el => ({ ...el, width: maxW })));
            }} />
            <ActionBtn label="Hauteur" onClick={() => {
              const maxH = Math.max(...elements.map(el => el.height));
              onUpdateMultiple(elements.map(el => ({ ...el, height: maxH })));
            }} />
            <ActionBtn label="Les deux" onClick={() => {
              const maxW = Math.max(...elements.map(el => el.width));
              const maxH = Math.max(...elements.map(el => el.height));
              onUpdateMultiple(elements.map(el => ({ ...el, width: maxW, height: maxH })));
            }} />
          </div>
        </div>

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
