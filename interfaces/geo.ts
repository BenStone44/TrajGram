import { LngLat } from 'mapbox-gl';
import type { Feature, Point, Polygon } from 'geojson';

export interface GeoCircleElement {
  id: string;
  type: 'circle';
  shape: { center: LngLat; r: number };
}

export interface GeoPolygon {
  id: string;
  type: 'polygon';
  shape: Feature<Polygon>;
}

export interface GeoPoint {
  id: string;
  type: 'point';
  shape: Feature<Point>
}

export type GeoElement = GeoCircleElement | GeoPolygon;
