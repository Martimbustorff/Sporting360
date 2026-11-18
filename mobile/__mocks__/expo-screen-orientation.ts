export const OrientationLock = {
  DEFAULT: 0,
  ALL: 1,
  PORTRAIT: 2,
  PORTRAIT_UP: 3,
  PORTRAIT_DOWN: 4,
  LANDSCAPE: 5,
  LANDSCAPE_LEFT: 6,
  LANDSCAPE_RIGHT: 7,
  OTHER: 8,
  UNKNOWN: 9,
};
export const lockAsync = jest.fn(() => Promise.resolve());
export const unlockAsync = jest.fn(() => Promise.resolve());
export const getOrientationAsync = jest.fn(() => Promise.resolve(1));
