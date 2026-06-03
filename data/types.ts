import type { Feature, FeatureCollection } from 'geojson';
import type { RoadNetworkItem } from '../interfaces/road-network';
import type { Trajectory } from '../interfaces/trajectory';

export type DataType = 'trajectory' | 'roadnetwork' | 'geojson';

export type NormalizationConfidence = 'high' | 'medium' | 'low';

export type StandardDataFormat =
  | Trajectory[]
  | RoadNetworkItem[]
  | FeatureCollection
  | Feature;

export interface NormalizationWarning {
  code: string;
  message: string;
  path?: string;
}

export interface NormalizationTrace {
  step: string;
  detail: string;
}

export interface NormalizationReport {
  type: DataType;
  detectedShape: string;
  confidence: NormalizationConfidence;
  warnings: NormalizationWarning[];
  trace: NormalizationTrace[];
  trajectoryCount?: number;
  pointCount?: number;
}

export interface NormalizationResult<T = StandardDataFormat | null> {
  data: T;
  report: NormalizationReport;
}

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
