import type { ImageElement } from '../../types';

interface Props {
  element: ImageElement;
}

export function ImageEl({ element }: Props) {
  return (
    <img
      src={element.src}
      alt=""
      draggable={false}
      style={{
        width: '100%', height: '100%',
        objectFit: 'cover',
        display: 'block',
      }}
    />
  );
}
