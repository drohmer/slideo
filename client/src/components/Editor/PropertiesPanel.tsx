import type { SlideElement, VideoElement, TextElement } from '../../types';

interface Props {
  elements: SlideElement[];
  onUpdate: (element: SlideElement) => void;
  onUpdateMultiple: (elements: SlideElement[]) => void;
  onDelete: () => void;
}

export function PropertiesPanel({ elements, onUpdate, onUpdateMultiple, onDelete }: Props) {
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
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>Aligner</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <ActionBtn label="← Gauche" onClick={() => {
              const minX = Math.min(...elements.map(el => el.x));
              onUpdateMultiple(elements.map(el => ({ ...el, x: minX })));
            }} />
            <ActionBtn label="→ Droite" onClick={() => {
              const maxRight = Math.max(...elements.map(el => el.x + el.width));
              onUpdateMultiple(elements.map(el => ({ ...el, x: maxRight - el.width })));
            }} />
            <ActionBtn label="↑ Haut" onClick={() => {
              const minY = Math.min(...elements.map(el => el.y));
              onUpdateMultiple(elements.map(el => ({ ...el, y: minY })));
            }} />
            <ActionBtn label="↓ Bas" onClick={() => {
              const maxBottom = Math.max(...elements.map(el => el.y + el.height));
              onUpdateMultiple(elements.map(el => ({ ...el, y: maxBottom - el.height })));
            }} />
            <ActionBtn label="⏐ Centre H" onClick={() => {
              const avgCenterX = elements.reduce((sum, el) => sum + el.x + el.width / 2, 0) / elements.length;
              onUpdateMultiple(elements.map(el => ({ ...el, x: Math.round(avgCenterX - el.width / 2) })));
            }} />
            <ActionBtn label="— Centre V" onClick={() => {
              const avgCenterY = elements.reduce((sum, el) => sum + el.y + el.height / 2, 0) / elements.length;
              onUpdateMultiple(elements.map(el => ({ ...el, y: Math.round(avgCenterY - el.height / 2) })));
            }} />
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10, marginBottom: 12 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>Même taille</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <ActionBtn label="Même largeur" onClick={() => {
              const maxW = Math.max(...elements.map(el => el.width));
              onUpdateMultiple(elements.map(el => ({ ...el, width: maxW })));
            }} />
            <ActionBtn label="Même hauteur" onClick={() => {
              const maxH = Math.max(...elements.map(el => el.height));
              onUpdateMultiple(elements.map(el => ({ ...el, height: maxH })));
            }} />
            <ActionBtn label="Même taille" onClick={() => {
              const maxW = Math.max(...elements.map(el => el.width));
              const maxH = Math.max(...elements.map(el => el.height));
              onUpdateMultiple(elements.map(el => ({ ...el, width: maxW, height: maxH })));
            }} />
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 10 }}>
          <div style={{ opacity: 0.5, fontSize: 11, marginBottom: 8 }}>Distribuer</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <ActionBtn label="↔ Horizontal" onClick={() => {
              const sorted = [...elements].sort((a, b) => a.x - b.x);
              const minX = sorted[0].x;
              const maxRight = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
              const totalWidth = sorted.reduce((sum, el) => sum + el.width, 0);
              const gap = (maxRight - minX - totalWidth) / (sorted.length - 1);
              let currentX = minX;
              onUpdateMultiple(sorted.map(el => {
                const updated = { ...el, x: Math.round(currentX) };
                currentX += el.width + gap;
                return updated;
              }));
            }} />
            <ActionBtn label="↕ Vertical" onClick={() => {
              const sorted = [...elements].sort((a, b) => a.y - b.y);
              const minY = sorted[0].y;
              const maxBottom = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
              const totalHeight = sorted.reduce((sum, el) => sum + el.height, 0);
              const gap = (maxBottom - minY - totalHeight) / (sorted.length - 1);
              let currentY = minY;
              onUpdateMultiple(sorted.map(el => {
                const updated = { ...el, y: Math.round(currentY) };
                currentY += el.height + gap;
                return updated;
              }));
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
      {element.type === 'text' && <TextProps element={element} onUpdate={onUpdate} />}

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

function TextProps({ element, onUpdate }: { element: TextElement; onUpdate: (el: SlideElement) => void }) {
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
      <Checkbox label="Gras" checked={element.bold} onChange={v => onUpdate({ ...element, bold: v })} />
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
