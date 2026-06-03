import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
  Position
} from 'geojson';
import type {
  ComputedAttribute,
  SourceAttribute,
  Trajectorypoint
} from '../interfaces/trajectory';

export type RecordLike = Record<string, unknown>;

export const POINT_SEQUENCE_KEYS = [
  'shapingPoints',
  'points',
  'samples',
  'trackPoints',
  'trajectoryPoints',
  'pointList',
  'locations',
  'path',
  'track'
] as const;

export const WRAPPED_COLLECTION_KEYS = [
  'data',
  'items',
  'results',
  'rows',
  'records',
  'trajectories',
  'trips'
] as const;

export const isRecord = (value: unknown): value is RecordLike =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isFeatureCollection = (value: unknown): value is FeatureCollection =>
  isRecord(value) && value.type === 'FeatureCollection' && Array.isArray(value.features);

export const isFeature = (value: unknown): value is Feature =>
  isRecord(value) && value.type === 'Feature';

export const isLineStringFeature = (
  value: unknown
): value is Feature<LineString | MultiLineString> =>
  isFeature(value) &&
  (value.geometry?.type === 'LineString' || value.geometry?.type === 'MultiLineString');

export const isPointFeature = (value: unknown): value is Feature<Point> =>
  isFeature(value) && value.geometry?.type === 'Point';

export const toStringOrUndefined = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

export const toNumberOrUndefined = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const toObjectArray = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of WRAPPED_COLLECTION_KEYS) {
    const candidate = value[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (Array.isArray(value.features)) {
    return value.features;
  }

  return null;
};

export const normalizePosition = (value: unknown) => {
  if (Array.isArray(value) && value.length >= 2) {
    const [lng, lat] = value;
    const lngNum = toNumberOrUndefined(lng);
    const latNum = toNumberOrUndefined(lat);
    if (lngNum !== undefined && latNum !== undefined) {
      return { lng: lngNum, lat: latNum };
    }
  }

  if (isRecord(value)) {
    const lng = toNumberOrUndefined(
      value.lng ?? value.lon ?? value.longitude ?? value.x
    );
    const lat = toNumberOrUndefined(
      value.lat ?? value.latitude ?? value.y
    );
    if (lng !== undefined && lat !== undefined) {
      return { lng, lat };
    }
  }

  return null;
};

export const getByPath = (source: unknown, path: string) => {
  if (!source) return undefined;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, source);
};

export const normalizeSourceAttribute = (
  value: unknown
): SourceAttribute | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const source: SourceAttribute = {};
  const tid = toStringOrUndefined(value.tid);
  const sid =
    toStringOrUndefined(value.sid) ??
    (Array.isArray(value.sid)
      ? value.sid.find((item): item is string => typeof item === 'string')
      : undefined);
  if (tid !== undefined) source.tid = tid;
  if (sid !== undefined) source.sid = sid;
  return Object.keys(source).length ? source : undefined;
};

export const normalizeComputedAttribute = (
  value: unknown
): ComputedAttribute | undefined => {
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

export const flattenLineCoordinates = (geometry: LineString | MultiLineString) => {
  if (geometry.type === 'LineString') {
    return geometry.coordinates;
  }

  return geometry.coordinates.flat();
};

export const createPointRecordsFromCoordinates = (
  coordinates: Position[],
  prefix: string
) =>
  coordinates.map((coordinate, pointIndex) => ({
    id: `${prefix}_p${pointIndex}`,
    coordinates: coordinate
  }));

export const countTrajectoryPoints = (trajectories: { shapingPoints: Trajectorypoint[] }[]) =>
  trajectories.reduce((sum, trajectory) => sum + trajectory.shapingPoints.length, 0);
