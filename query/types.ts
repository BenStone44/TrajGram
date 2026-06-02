import type { RoadNetworkItem } from '../interfaces/road-network';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';

export type QueryType = 'filter' | 'segmentation' | 'aggregation';

export type QueryPredicate = (element: Trajectory) => boolean;

export type QueryCallback = () => unknown;
export type QueryExecutor = () => Promise<QueryResult>;

export type QueryResultItem = Trajectory | Trajectorypoint | RoadNetworkItem;
export type QueryResult = QueryResultItem[];

export type FilterCondition = string | string[];

export type SegmentationOperator =
  | { kind: 'road' }
  | { kind: 'even'; type: 'D' | 'T'; count: number };

export interface BaseQuerySetting {
  id: string;
  source: string;
  set?: unknown;
}

export interface FilterQuerySetting extends BaseQuerySetting {
  type: 'filter';
  condition: string | string[];
}

export interface SegmentationQuerySetting extends BaseQuerySetting {
  type: 'segmentation';
  operator: string;
}

export interface AggregationQuerySetting extends BaseQuerySetting {
  type: 'aggregation';
}

export type QuerySetting =
  | FilterQuerySetting
  | SegmentationQuerySetting
  | AggregationQuerySetting;
