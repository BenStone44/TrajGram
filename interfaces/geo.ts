import { LngLat } from 'mapbox-gl';
import type { Feature, Point, Polygon } from 'geojson';

export interface GeoCircleElement {
  type: 'circle';
  shape: { center: LngLat; r: number };
}

export interface GeoPolygon {
  type: 'polygon';
  shape: Feature<Polygon>;
}

export interface GeoPoint {
  type: 'point';
  shape: Feature<Point>
}

export type GeoElement = GeoCircleElement | GeoPolygon | GeoPoint;
