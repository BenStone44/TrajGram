import type { Feature, FeatureCollection } from 'geojson';
import type { RoadNetworkItem } from '../interfaces/road-network';
import type { Trajectory } from '../interfaces/trajectory';

export type DataType = 'trajectory' | 'roadnetwork' | 'geojson';

export type StandardDataFormat =
  | Trajectory[]
  | RoadNetworkItem[]
  | FeatureCollection
  | Feature;

export interface DataSetting {
  id: string;
  type: DataType;
  url: string;
}

export interface DataProps {
  id: string;
  type: DataType;
  data: unknown;
}
