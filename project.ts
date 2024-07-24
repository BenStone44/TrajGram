/*
根据leaflet.js中CRS投影写的ts版本
https://github.com/Leaflet/Leaflet/tree/main/src/geo/crs
*/

import { LngLat } from 'mapbox-gl';
import type { ScreenPixelPosition } from './interfaces/base';

interface ProjectFunction {
  (position: LngLat, zoom: number): ScreenPixelPosition;
}

const R = 6378137; //地球半径

function Mercator(position: LngLat) {
  const R_MINOR = 6356752.314245179;
  const d = Math.PI / 180,
    r = R,
    tmp = R_MINOR / r,
    e = Math.sqrt(1 - tmp * tmp);
  const y = position.lat * d;
  const con = e * Math.sin(y);
  const ts =
    Math.tan(Math.PI / 4 - y / 2) / Math.pow((1 - con) / (1 + con), e / 2);

  return { x: position.lng * d * r, y: -r * Math.log(Math.max(ts, 1e-10)) };
}

function SphericalMercator(position: LngLat) {
  const MAX_LATITUDE = 85.0511287798;
  const d = Math.PI / 180,
    max = MAX_LATITUDE,
    lat = Math.max(Math.min(max, position.lat), -max),
    sin = Math.sin(lat * d);

  return {
    x: R * position.lng * d,
    y: (R * Math.log((1 + sin) / (1 - sin))) / 2
  };
}

const scale = 0.5 / (Math.PI * R);

export function zoom2scale(zoom: number) {
  return 512 * Math.pow(2, zoom);
}

function transform(
  vec: [number, number, number, number],
  scale: number,
  point: { x: number; y: number }
) {
  scale = scale || 1;
  return {
    x: scale * (vec[0] * point.x + vec[1]),
    y: scale * (vec[2] * point.y + vec[3])
  };
}

export const EPSG3395_project: ProjectFunction = (
  latlng: LngLat,
  zoom: number
) => {
  return transform(
    [scale, 0.5, -scale, 0.5],
    zoom2scale(zoom),
    Mercator(latlng)
  );
};

export const EPSG3857_project: ProjectFunction = (
  latlng: LngLat,
  zoom: number
) => {
  return transform(
    [scale, 0.5, -scale, 0.5],
    zoom2scale(zoom),
    SphericalMercator(latlng)
  );
};

export const EPSG4326_project: ProjectFunction = (
  latlng: LngLat,
  zoom: number
) => {
  return transform([1 / 180, 1, -1 / 180, 0.5], zoom2scale(zoom), {
    x: latlng.lng,
    y: latlng.lat
  });
};

// standard
export const LngLat2ScreenPosition = (
  point: LngLat,
  mapCenter: LngLat,
  zoom: number
): ScreenPixelPosition => {
  const centerXY = EPSG3857_project(mapCenter, zoom);
  const pointXY = EPSG3857_project(point, zoom);
  return {
    x: pointXY.x - centerXY.x,
    y: pointXY.y - centerXY.y
  };
};
