import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString
} from 'geojson';
import { calculateDistance } from '../utils/utils_calculation';
import type { RoadNetworkItem } from '../interfaces/road-network';
import type {
  Trajectory,
  Trajectorypoint
} from '../interfaces/trajectory';
import { enrichTrajectoryComputedValues } from './computed';
import { NormalizationReportBuilder } from './report';
import { normalizeTrajectoryData } from './normalizers/trajectory';
import type {
  DataType,
  NormalizationResult,
  StandardDataFormat
} from './types';
import {
  flattenLineCoordinates,
  isFeature,
  isFeatureCollection,
  isLineStringFeature,
  isRecord,
  normalizePosition,
  normalizeSourceAttribute,
  normalizeComputedAttribute,
  toNumberOrUndefined,
  toObjectArray,
  toStringOrUndefined
} from './shared';

const isFeaturePointRecord = (value: unknown) =>
  isFeature(value) && value.geometry?.type === 'Point';

const countPoints = (trajectories: Trajectory[]) =>
  trajectories.reduce((sum, trajectory) => sum + trajectory.shapingPoints.length, 0);

const countRoadPoints = (roads: RoadNetworkItem[]) =>
  roads.reduce((sum, road) => sum + road.shapingPoints.length, 0);

const extractFeatureProperties = (value: unknown) =>
  isFeature(value) && isRecord(value.properties)
    ? (value.properties as Record<string, unknown>)
    : {};

const normalizeRoadNetworkPoint = (
  value: unknown,
  index: number,
  roadId: string
): Trajectorypoint | null => {
  if (!isRecord(value) && !isFeaturePointRecord(value)) {
    return null;
  }

  const basePoint = isRecord(value) && isRecord(value.basePoint) ? value.basePoint : value;
  const basePointRecord = basePoint as Record<string, unknown>;
  const valueRecord = value as Record<string, unknown>;
  const position =
    normalizePosition(basePointRecord.position) ??
    normalizePosition(basePointRecord.coordinates) ??
    normalizePosition(basePoint) ??
    normalizePosition(valueRecord.position) ??
    normalizePosition(valueRecord.coordinates) ??
    normalizePosition(valueRecord.geometry?.coordinates) ??
    null;

  if (!position) {
    return null;
  }

  const time =
    toStringOrUndefined((basePoint as Record<string, unknown>).time) ??
    toStringOrUndefined((value as Record<string, unknown>).time) ??
    toStringOrUndefined((value as Record<string, unknown>).timestamp);

  const attributes = {
    source:
      normalizeSourceAttribute(
        isRecord((value as Record<string, unknown>).attributes)
          ? ((value as Record<string, unknown>).attributes as Record<string, unknown>).source
          : (value as Record<string, unknown>).source
      ) ?? { tid: roadId },
    computed: normalizeComputedAttribute(
      isRecord((value as Record<string, unknown>).attributes)
        ? ((value as Record<string, unknown>).attributes as Record<string, unknown>).computed
        : (value as Record<string, unknown>).computed
    ),
    others: isRecord((value as Record<string, unknown>).attributes)
      ? ((value as Record<string, unknown>).attributes as Record<string, unknown>).others
      : undefined
  };

  return {
    id:
      toStringOrUndefined((value as Record<string, unknown>).id) ??
      `${roadId}_p${index}`,
    basePoint: {
      position,
      ...(time ? { time } : {})
    },
    attributes
  };
};

const normalizeRoadNetworkRecord = (
  value: unknown,
  index: number
): RoadNetworkItem | null => {
  if (!isRecord(value) && !isLineStringFeature(value)) {
    return null;
  }

  const roadId =
    toStringOrUndefined((value as Record<string, unknown>).id) ??
    `road_${index}`;

  const rawPoints =
    toObjectArray((value as Record<string, unknown>).shapingPoints) ??
    toObjectArray((value as Record<string, unknown>).points) ??
    (() => {
      if (isLineStringFeature(value)) {
        return flattenLineCoordinates(value.geometry).map((coordinates, pointIndex) => ({
          id: `${roadId}_p${pointIndex}`,
          coordinates
        }));
      }
      return null;
    })();

  const shapingPoints =
    rawPoints?.map((point, pointIndex) =>
      normalizeRoadNetworkPoint(point, pointIndex, roadId)
    ).filter((point): point is Trajectorypoint => point !== null) ?? [];

  const distance =
    toNumberOrUndefined((value as Record<string, unknown>).distance) ??
    (shapingPoints.length >= 2 ? calculateDistance(shapingPoints) : 0);

  return {
    id: roadId,
    distance,
    shapingPoints,
    attributes: isRecord((value as Record<string, unknown>).attributes)
      ? (value as Record<string, unknown>).attributes as RoadNetworkItem['attributes']
      : extractFeatureProperties(value)
  };
};

const normalizeRoadNetworkData = (
  data: unknown,
  report: NormalizationReportBuilder
) => {
  const records = toObjectArray(data);
  if (!records) {
    report.addWarning(
      'roadnetwork-unrecognized',
      'Unable to detect a road network list from the input data.',
      undefined,
      'low'
    );
    report.setDetectedShape('unrecognized');
    return [];
  }

  const roads = records
    .map((record, index) => normalizeRoadNetworkRecord(record, index))
    .filter((road): road is RoadNetworkItem => road !== null);

  report.setDetectedShape('roadnetwork-array');
  report.setCounts(roads.length, countRoadPoints(roads));
  return roads;
};

const normalizeGeoJSONData = (
  data: unknown,
  report: NormalizationReportBuilder
): FeatureCollection | Feature | null => {
  if (isFeatureCollection(data) || isFeature(data)) {
    report.setDetectedShape(
      isFeatureCollection(data)
        ? 'geojson-feature-collection'
        : `geojson-${data.geometry?.type?.toLowerCase() ?? 'feature'}`
    );
    return data;
  }

  report.addWarning(
    'geojson-unrecognized',
    'Unable to recognize the input as GeoJSON.',
    undefined,
    'low'
  );
  report.setDetectedShape('unrecognized');
  return null;
};

export const normalizeDataWithReport = (
  type: DataType,
  data: unknown
): NormalizationResult => {
  const report = new NormalizationReportBuilder(type);

  if (data === null || data === undefined) {
    report.setDetectedShape('empty');
    report.addWarning('empty-input', 'Input data is empty.', undefined, 'low');
    return { data: null, report: report.build() };
  }

  if (type === 'trajectory') {
    const trajectories = enrichTrajectoryComputedValues(
      normalizeTrajectoryData(data, report),
      report
    );
    report.setCounts(trajectories.length, countPoints(trajectories));
    return { data: trajectories, report: report.build() };
  }

  if (type === 'roadnetwork') {
    const roads = normalizeRoadNetworkData(data, report);
    return { data: roads, report: report.build() };
  }

  if (type === 'geojson') {
    const geojson = normalizeGeoJSONData(data, report);
    return { data: geojson, report: report.build() };
  }

  report.setDetectedShape('unrecognized');
  report.addWarning('unknown-type', `Unsupported data type: ${type}`, undefined, 'low');
  return { data: null, report: report.build() };
};

export const normalizeDataByType = (
  type: DataType,
  data: unknown
): StandardDataFormat | null => normalizeDataWithReport(type, data).data;
