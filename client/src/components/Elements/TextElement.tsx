import { useState, useRef, useEffect } from 'react';
import type { TextElement, SlideElement } from '../../types';

interface Props {
  element: TextElement;
  onUpdate?: (element: SlideElement) => void;
  editMode?: boolean;
}

export function TextEl({ element, onUpdate, editMode }: Props) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const style: React.CSSProperties = {
    width: '100%', height: '100%',
    fontSize: element.fontSize, color: element.color,
    fontWeight: element.bold ? 700 : 400,
    display: 'flex', alignItems: 'center',
    wordBreak: 'break-word', lineHeight: 1.3,
  };

  const cornerStyle: React.CSSProperties = {
    position: 'absolute',
    width: 14, height: 14,
    borderColor: 'rgba(220,38,38,0.7)',
    borderStyle: 'solid',
    borderWidth: 0,
    transition: 'opacity 0.2s',
    opacity: hovered ? 1 : 0,
    pointerEvents: 'none',
  };

  if (editing && editMode && onUpdate) {
    return (
      <textarea
        ref={inputRef}
        value={element.content}
        onChange={e => onUpdate({ ...element, content: e.target.value })}
        onBlur={() => setEditing(false)}
        onKeyDown={e => { if (e.key === 'Escape') setEditing(false); }}
        style={{
          ...style,
          background: 'transparent', border: '1px dashed rgba(67,97,238,0.5)',
          outline: 'none', resize: 'none', padding: 4, fontFamily: 'inherit',
        }}
      />
    );
  }

  return (
    <div
      style={{ ...style, position: 'relative' }}
      onDoubleClick={() => editMode && setEditing(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {element.content}
      <div style={{ ...cornerStyle, top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }} />
      <div style={{ ...cornerStyle, top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }} />
      <div style={{ ...cornerStyle, bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }} />
      <div style={{ ...cornerStyle, bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }} />
    </div>
  );
}
