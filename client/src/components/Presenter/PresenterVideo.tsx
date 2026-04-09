import { useRef, useEffect, useState } from 'react';
import type { VideoElement } from '../../types';

interface Props {
  element: VideoElement;
  slideId: string;
}

export function PresenterVideo({ element, slideId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    if (element.autoplay) {
      video.play().catch(() => {});
    }
  }, [slideId, element.autoplay]);

  const handleMouseEnter = () => {
    clearTimeout(hideTimer.current);
    setShowControls(true);
  };

  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setShowControls(false), 1000);
  };

  return (
    <div
      style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
        boxShadow: showControls ? '0 0 0 2px rgba(220,38,38,0.5)' : '0 0 0 0px rgba(220,38,38,0)',
        transition: showControls ? 'box-shadow 0s' : 'box-shadow 0.2s',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={element.src}
        loop={element.loop}
        muted={element.muted}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        controls={showControls}
      />
    </div>
  );
}
