import { useRef, useCallback, useState } from 'react';
import { strokeToPath, type DrawingElement as DrawingElementType, type Stroke } from '../../types';

interface Props {
  element: DrawingElementType;
  isEditing: boolean;
  onUpdate: (el: DrawingElementType) => void;
}

export function DrawingEl({ element, isEditing, onUpdate }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const drawing = useRef(false);

  // Returns pixel coords relative to element (matching viewBox)
  const getPoint = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * element.width,
      y: (e.clientY - rect.top) / rect.height * element.height,
    };
  }, [element.width, element.height]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isEditing) return;
    e.stopPropagation();
    e.preventDefault();
    drawing.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    const pt = getPoint(e);
    setCurrentStroke({
      points: [pt],
      color: element.strokeColor,
      width: element.strokeWidth,
    });
  }, [isEditing, getPoint, element.strokeColor, element.strokeWidth]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing.current || !currentStroke) return;
    e.stopPropagation();
    const pt = getPoint(e);
    setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pt] } : prev);
  }, [getPoint, currentStroke]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!drawing.current || !currentStroke) return;
    e.stopPropagation();
    drawing.current = false;
    if (currentStroke.points.length > 1) {
      onUpdate({ ...element, strokes: [...element.strokes, currentStroke] });
    }
    setCurrentStroke(null);
  }, [currentStroke, element, onUpdate]);

  return (
    <div style={{
      width: '100%', height: '100%',
      border: isEditing ? '2px dashed var(--accent, #4361ee)' : (element.strokes.length === 0 ? '1px dashed rgba(128,128,128,0.3)' : 'none'),
      borderRadius: 2,
      boxSizing: 'border-box',
      background: isEditing ? 'rgba(67,97,238,0.03)' : 'transparent',
    }}>
    <svg
      ref={svgRef}
      viewBox={`0 0 ${element.width} ${element.height}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: isEditing ? 'crosshair' : 'default',
        pointerEvents: isEditing ? 'auto' : 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {element.strokes.map((stroke, i) => (
        <path
          key={i}
          d={strokeToPath(stroke)}
          fill="none"
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {currentStroke && currentStroke.points.length > 0 && (
        <path
          d={strokeToPath(currentStroke)}
          fill="none"
          stroke={currentStroke.color}
          strokeWidth={currentStroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
    </div>
  );
}
