import type { ShapeElement as ShapeElementType } from '../../types';

interface Props {
  element: ShapeElementType;
}

export function ShapeEl({ element }: Props) {
  const { shapeType, width, height, strokeColor, strokeWidth, fillColor, hasArrow, p1, p2, id } = element;
  const markerId = `arrow-${id}`;
  const sw = strokeWidth;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
    >
      {shapeType === 'segment' && (() => {
        const x1 = (p1?.rx ?? 0) * width;
        const y1 = (p1?.ry ?? 0) * height;
        const x2 = (p2?.rx ?? 1) * width;
        const y2 = (p2?.ry ?? 1) * height;
        return (
          <>
            {hasArrow && (
              <defs>
                <marker id={markerId} markerWidth={10} markerHeight={7} refX={9} refY={3.5} orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
                </marker>
              </defs>
            )}
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={strokeColor} strokeWidth={sw} strokeLinecap="round"
              markerEnd={hasArrow ? `url(#${markerId})` : undefined}
            />
          </>
        );
      })()}
      {shapeType === 'rect' && (
        <rect
          x={sw / 2} y={sw / 2}
          width={Math.max(0, width - sw)} height={Math.max(0, height - sw)}
          stroke={strokeColor} strokeWidth={sw} fill={fillColor}
        />
      )}
      {shapeType === 'ellipse' && (
        <ellipse
          cx={width / 2} cy={height / 2}
          rx={Math.max(0, width / 2 - sw / 2)} ry={Math.max(0, height / 2 - sw / 2)}
          stroke={strokeColor} strokeWidth={sw} fill={fillColor}
        />
      )}
    </svg>
  );
}
