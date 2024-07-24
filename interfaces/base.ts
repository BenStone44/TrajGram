import { LngLat } from 'mapbox-gl';

export function hasKey<T extends object>(
  obj: T,
  key: keyof any
): key is keyof T {
  return key in obj;
}

export function getValue<T extends object, K extends keyof T>(
  obj: T,
  key: K
): T[K] | undefined {
  if (hasKey(obj, key)) {
    return obj[key];
  }
  return undefined;
}

export type STpoint = {
  time?: string;
  position: LngLat;
}

export type ScreenPixelPosition = {
  x: number;
  y: number;
}
