export const CANVAS = { WIDTH: 960, HEIGHT: 540 } as const;
export const ZOOM = { MIN: 0.25, MAX: 3, STEP: 0.1 } as const;
export const SNAP = { THRESHOLD: 5 } as const;
export const EDITOR = { UNDO_DEBOUNCE: 300, UNDO_MAX: 50 } as const;
export const VIDEO = { FRAME_STEP: 1 / 30, SPEED_OPTIONS: [0.25, 0.5, 1, 1.5, 2] } as const;
export const MEDIA = {
  UPLOAD_MAX_SIZE: 500 * 1024 * 1024,
  IMAGE_MAX_SIDE: 400,
  DEFAULT_VIDEO_W: 480, DEFAULT_VIDEO_H: 270,
  PROBE_TIMEOUT: 10000,
} as const;
