import { LngLat } from 'mapbox-gl';
import type { Feature, Polygon } from 'geojson';

export interface GeoCircleElement {
  id: string;
  type: 'circle';
  shape: { center: LngLat; r: number };
}

interface NormalElement {
  id: string;
  type: 'normal';
  shape: Feature<Polygon>;
}

export type GeoElement = GeoCircleElement | NormalElement;
