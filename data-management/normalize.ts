import type { Feature, FeatureCollection, LineString, MultiLineString, Position } from 'geojson';
import { calculateDistance } from '../utils/utils_calculation';
import type { RoadNetworkItem } from '../interfaces/road-network';
import type {
  ComputedAttribute,
  SourceAttribute,
  Trajectory,
  Trajectorypoint
} from '../interfaces/trajectory';
import type { DataType, StandardDataFormat } from './types';

type RecordLike = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordLike =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toStringOrUndefined = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

const toNumberOrUndefined = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toObjectArray = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value) && Array.isArray(value.data)) {
    return value.data;
  }
  if (isRecord(value) && Array.isArray(value.features)) {
    return value.features;
  }
  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items;
  }
  return null;
};

const isFeatureCollection = (value: unknown): value is FeatureCollection =>
  isRecord(value) && value.type === 'FeatureCollection' && Array.isArray(value.features);

const isFeature = (value: unknown): value is Feature =>
  isRecord(value) && value.type === 'Feature';

const normalizePosition = (value: unknown) => {
  if (Array.isArray(value) && value.length >= 2) {
    const [lng, lat] = value;
    const lngNum = toNumberOrUndefined(lng);
    const latNum = toNumberOrUndefined(lat);
    if (lngNum !== undefined && latNum !== undefined) {
      return { lng: lngNum, lat: latNum };
    }
  }

  if (isRecord(value)) {
    const lng = toNumberOrUndefined(value.lng ?? value.lon ?? value.longitude ?? value.x);
    const lat = toNumberOrUndefined(value.lat ?? value.latitude ?? value.y);
    if (lng !== undefined && lat !== undefined) {
      return { lng, lat };
    }
  }

  return null;
};

const normalizeSourceAttribute = (value: unknown): SourceAttribute | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const source: SourceAttribute = {};
  const tid = toStringOrUndefined(value.tid);
  const sid = toStringOrUndefined(value.sid);
  if (tid !== undefined) source.tid = tid;
  if (sid !== undefined) source.sid = sid;
  return Object.keys(source).length ? source : undefined;
};

const normalizeComputedAttribute = (value: unknown): ComputedAttribute | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const computed: ComputedAttribute = {};
  const trajDP = toNumberOrUndefined(value.trajDP);
  const trajTP = toNumberOrUndefined(value.trajTP);
  const segDP = toNumberOrUndefined(value.segDP);
  const direction = isRecord(value.direction)
    ? {
        x: toNumberOrUndefined(value.direction.x) ?? 0,
        y: toNumberOrUndefined(value.direction.y) ?? 0
      }
    : undefined;

  if (trajDP !== undefined) computed.trajDP = trajDP;
  if (trajTP !== undefined) computed.trajTP = trajTP;
  if (segDP !== undefined) computed.segDP = segDP;
  if (direction) computed.direction = direction;
  return Object.keys(computed).length ? computed : undefined;
};

const normalizePointAttributes = (value: unknown) => {
  const attributes: Trajectorypoint['attributes'] = {};
  if (!isRecord(value)) {
    return attributes;
  }

  const source = normalizeSourceAttribute(value.source);
  const computed = normalizeComputedAttribute(value.computed);
  const others = isRecord(value.others) ? value.others : undefined;

  if (source) attributes.source = source;
  if (computed) attributes.computed = computed;
  if (others) attributes.others = others as Record<string, unknown>;
  return attributes;
};

const normalizeTrajectoryPoint = (
  value: unknown,
  index: number,
  trajectoryId: string
): Trajectorypoint | null => {
  if (!isRecord(value)) {
    return null;
  }

  const basePoint = isRecord(value.basePoint) ? value.basePoint : value;
  const position =
    normalizePosition(
      (basePoint as RecordLike).position ??
        (value as RecordLike).position ??
        (value as RecordLike).coordinates ??
        (value as RecordLike).geometry?.coordinates
    ) ?? null;

  if (!position) {
    return null;
  }

  const time =
    toStringOrUndefined((basePoint as RecordLike).time) ??
    toStringOrUndefined((value as RecordLike).time) ??
    toStringOrUndefined((value as RecordLike).timestamp);

  const pointId =
    toStringOrUndefined(value.id) ?? `${trajectoryId}_p${index}`;

  const attributes = normalizePointAttributes(
    isRecord(value.attributes) ? value.attributes : value
  );

  if (!attributes.source) {
    attributes.source = { tid: trajectoryId };
  }

  return {
    id: pointId,
    basePoint: {
      position,
      ...(time ? { time } : {})
    },
    attributes
  };
};

const normalizeTrajectoryRecord = (
  value: unknown,
  index: number
): Trajectory | null => {
  if (!isRecord(value)) {
    return null;
  }

  const trajectoryId =
    toStringOrUndefined(value.id) ??
    toStringOrUndefined(value.tid) ??
    `trajectory_${index}`;

  const rawPoints =
    toObjectArray(value.shapingPoints) ??
    toObjectArray(value.points) ??
    toObjectArray(value.samples) ??
    (() => {
      if (isFeature(value) && value.geometry?.type === 'LineString') {
        return (value.geometry as LineString).coordinates.map((coordinates, pointIndex) => ({
          id: `${trajectoryId}_p${pointIndex}`,
          coordinates
        }));
      }
      if (isFeature(value) && value.geometry?.type === 'MultiLineString') {
        const firstLine = (value.geometry as MultiLineString).coordinates[0] ?? [];
        return firstLine.map((coordinates, pointIndex) => ({
          id: `${trajectoryId}_p${pointIndex}`,
          coordinates
        }));
      }
      return null;
    })();

  if (!rawPoints) {
    return null;
  }

  const shapingPoints = rawPoints
    .map((point, pointIndex) => normalizeTrajectoryPoint(point, pointIndex, trajectoryId))
    .filter((point): point is Trajectorypoint => point !== null);

  if (!shapingPoints.length) {
    return null;
  }

  const times = shapingPoints
    .map((point) => point.basePoint.time)
    .filter((time): time is string => typeof time === 'string' && time.length > 0);

  const starttime =
    toStringOrUndefined(value.starttime) ?? times[0] ?? '';
  const endtime =
    toStringOrUndefined(value.endtime) ?? times[times.length - 1] ?? '';

  const distance =
    toNumberOrUndefined(value.distance) ??
    (shapingPoints.length >= 2 ? calculateDistance(shapingPoints) : 0);

  const attributes = isRecord(value.attributes)
    ? (value.attributes as Record<string, unknown>)
    : {};

  return {
    id: trajectoryId,
    starttime,
    endtime,
    distance,
    shapingPoints,
    annotationPoints: isRecord(value.annotationPoints)
      ? (value.annotationPoints as Trajectory['annotationPoints'])
      : undefined,
    annotationSubTrajectories: isRecord(value.annotationSubTrajectories)
      ? (value.annotationSubTrajectories as Trajectory['annotationSubTrajectories'])
      : undefined,
    segmentInstanceIdList: Array.isArray(value.segmentInstanceIdList)
      ? (value.segmentInstanceIdList as Trajectory['segmentInstanceIdList'])
      : undefined,
    attributes
  };
};

const normalizeRoadNetworkRecord = (
  value: unknown,
  index: number
): RoadNetworkItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = toStringOrUndefined(value.id) ?? `road_${index}`;
  const rawPoints =
    toObjectArray(value.shapingPoints) ??
    (() => {
      if (isFeature(value) && value.geometry?.type === 'LineString') {
        return (value.geometry as LineString).coordinates.map((coordinates, pointIndex) => ({
          id: `${id}_p${pointIndex}`,
          coordinates
        }));
      }
      return null;
    })();

  const shapingPoints =
    rawPoints?.map((point, pointIndex) =>
      normalizeTrajectoryPoint(point, pointIndex, id)
    ).filter((point): point is Trajectorypoint => point !== null) ?? [];

  const distance =
    toNumberOrUndefined(value.distance) ??
    (shapingPoints.length >= 2 ? calculateDistance(shapingPoints) : 0);

  if (!shapingPoints.length) {
    return {
      id,
      distance,
      shapingPoints: []
    };
  }

  return {
    id,
    distance,
    shapingPoints,
    attributes: isRecord(value.attributes)
      ? (value.attributes as RoadNetworkItem['attributes'])
      : undefined
  };
};

export const normalizeDataByType = (
  type: DataType,
  data: unknown
): StandardDataFormat | null => {
  if (data === null || data === undefined) {
    return null;
  }

  if (type === 'geojson') {
    if (isFeatureCollection(data) || isFeature(data)) {
      return data;
    }
    return null;
  }

  const records = toObjectArray(data);
  if (!records) {
    return null;
  }

  if (type === 'trajectory') {
    return records
      .map((record, index) => normalizeTrajectoryRecord(record, index))
      .filter((trajectory): trajectory is Trajectory => trajectory !== null);
  }

  if (type === 'roadnetwork') {
    return records
      .map((record, index) => normalizeRoadNetworkRecord(record, index))
      .filter((road): road is RoadNetworkItem => road !== null);
  }

  return null;
};
