import { calculateDistance } from '../../utils/utils_calculation';
import type {
  Trajectory,
  Trajectorypoint
} from '../../interfaces/trajectory';
import type { NormalizationReportBuilder } from '../report';
import {
  getByPath,
  isFeature,
  isFeatureCollection,
  isLineStringFeature,
  isPointFeature,
  isRecord,
  normalizeComputedAttribute,
  normalizePosition,
  normalizeSourceAttribute,
  toNumberOrUndefined,
  toObjectArray,
  toStringOrUndefined
} from '../shared';
import { isPointLike } from '../detectors/point';
import {
  extractPointSequenceCandidate,
  isPointSequence
} from '../detectors/sequence';
import {
  isTrajectoryLike,
  lineFeatureToPointRecords,
  unwrapTrajectoryContainers,
  looksLikePointTable
} from '../detectors/trajectory';

const TRAJECTORY_ID_KEYS = [
  'trajectoryId',
  'trajId',
  'tripId',
  'trackId',
  'track_id',
  'trip_id',
  'tid'
] as const;

const POINT_RESERVED_KEYS = new Set([
  'id',
  'basePoint',
  'position',
  'coordinates',
  'geometry',
  'time',
  'timestamp',
  'datetime',
  'lng',
  'lat',
  'lon',
  'longitude',
  'latitude',
  'x',
  'y',
  'source',
  'computed',
  'attributes',
  'type',
  'properties'
]);

const TRAJECTORY_RESERVED_KEYS = new Set([
  'id',
  'tid',
  'trajectoryId',
  'trajId',
  'tripId',
  'trackId',
  'track_id',
  'trip_id',
  'shapingPoints',
  'points',
  'samples',
  'trackPoints',
  'trajectoryPoints',
  'pointList',
  'locations',
  'path',
  'track',
  'geometry',
  'type',
  'properties',
  'attributes',
  'starttime',
  'endtime',
  'distance',
  'annotationPoints',
  'annotationSubTrajectories',
  'segmentInstanceIdList'
]);

const toStringList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const pickTrajectoryId = (value: unknown, index: number) => {
  if (isRecord(value)) {
    const explicit =
      toStringOrUndefined(value.id) ??
      TRAJECTORY_ID_KEYS.map((key) => toStringOrUndefined(value[key]))
        .find((candidate) => candidate !== undefined);
    if (explicit) {
      return explicit;
    }
  }

  return `trajectory_${index}`;
};

const collectTrajectoryAttributes = (
  value: unknown,
  excludedKeys: Set<string> = TRAJECTORY_RESERVED_KEYS
) => {
  if (!isRecord(value)) {
    return {};
  }

  const attributes: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (excludedKeys.has(key)) {
      continue;
    }
    attributes[key] = raw;
  }
  return attributes;
};

const collectPointOthers = (value: unknown, excludedKeys: Set<string>) => {
  if (!isRecord(value)) {
    return {};
  }

  const others: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (excludedKeys.has(key)) {
      continue;
    }
    others[key] = raw;
  }
  return others;
};

const normalizeTime = (value: unknown) => {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const getTrajectoryGroupKey = (value: unknown) => {
  if (!isRecord(value)) {
    return undefined;
  }

  const fromSource =
    toStringOrUndefined(getByPath(value, 'attributes.source.tid')) ??
    toStringOrUndefined(getByPath(value, 'source.tid'));
  if (fromSource) {
    return fromSource;
  }

  for (const key of TRAJECTORY_ID_KEYS) {
    const candidate = toStringOrUndefined(value[key]);
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
};

const normalizeTrajectoryPoint = (
  value: unknown,
  index: number,
  trajectoryId: string,
  report: NormalizationReportBuilder,
  path: string
): Trajectorypoint | null => {
  if (!isRecord(value) && !isPointFeature(value)) {
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
    report.addWarning(
      'point-position-missing',
      'Skipped a candidate point because no valid coordinate pair was found.',
      path,
      'low'
    );
    return null;
  }

  const time =
    normalizeTime((basePoint as Record<string, unknown>).time) ??
    normalizeTime((value as Record<string, unknown>).time) ??
    normalizeTime((value as Record<string, unknown>).timestamp) ??
    normalizeTime((value as Record<string, unknown>).datetime);

  const pointId =
    toStringOrUndefined((value as Record<string, unknown>).id) ??
    `${trajectoryId}_p${index}`;

  const explicitAttributes = isRecord((value as Record<string, unknown>).attributes)
    ? ((value as Record<string, unknown>).attributes as Record<string, unknown>)
    : {};

  const source =
    normalizeSourceAttribute(
      explicitAttributes.source ??
        (value as Record<string, unknown>).source ??
        getByPath(value, 'properties.source')
    ) ?? { tid: trajectoryId };

  const computed = normalizeComputedAttribute(
    explicitAttributes.computed ??
      (value as Record<string, unknown>).computed ??
      getByPath(value, 'properties.computed')
  );

  const others = {
    ...collectPointOthers(value, POINT_RESERVED_KEYS),
    ...(isRecord((basePoint as Record<string, unknown>).others)
      ? ((basePoint as Record<string, unknown>).others as Record<string, unknown>)
      : {}),
    ...(isRecord(explicitAttributes.others)
      ? (explicitAttributes.others as Record<string, unknown>)
      : {}),
    ...(isRecord((value as Record<string, unknown>).properties)
      ? collectPointOthers((value as Record<string, unknown>).properties, POINT_RESERVED_KEYS)
      : {})
  };

  const attributes: Trajectorypoint['attributes'] = { source };
  if (computed) {
    attributes.computed = computed;
  }
  if (Object.keys(others).length > 0) {
    attributes.others = others;
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
  index: number,
  report: NormalizationReportBuilder
): Trajectory | null => {
  if (!isRecord(value) && !isFeature(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const trajectoryId = pickTrajectoryId(record, index);
  const pointSequenceCandidate =
    extractPointSequenceCandidate(record) ??
    (isLineStringFeature(value)
      ? { key: 'geometry', points: lineFeatureToPointRecords(value, trajectoryId) ?? [] }
      : null);

  if (!pointSequenceCandidate) {
    return null;
  }

  const rawPoints =
    pointSequenceCandidate.key === 'geometry' && isLineStringFeature(value)
      ? lineFeatureToPointRecords(value, trajectoryId)
      : pointSequenceCandidate.points;

  if (!rawPoints || !rawPoints.length) {
    return null;
  }

  const shapingPoints = rawPoints
    .map((point, pointIndex) =>
      normalizeTrajectoryPoint(
        point,
        pointIndex,
        trajectoryId,
        report,
        `${trajectoryId}.${pointSequenceCandidate.key}[${pointIndex}]`
      )
    )
    .filter((point): point is Trajectorypoint => point !== null);

  if (!shapingPoints.length) {
    return null;
  }

  const times = shapingPoints
    .map((point) => point.basePoint.time)
    .filter((time): time is string => typeof time === 'string' && time.length > 0);

  const starttime =
    toStringOrUndefined(record.starttime) ?? times[0] ?? '';
  const endtime =
    toStringOrUndefined(record.endtime) ?? times[times.length - 1] ?? '';

  const distance =
    toNumberOrUndefined(record.distance) ??
    (shapingPoints.length >= 2 ? calculateDistance(shapingPoints) : 0);

  const attributes = {
    ...(isRecord(record.attributes) ? (record.attributes as Record<string, unknown>) : {}),
    ...collectTrajectoryAttributes(record)
  };

  return {
    id: trajectoryId,
    starttime,
    endtime,
    distance,
    shapingPoints,
    annotationPoints: isRecord(record.annotationPoints)
      ? (record.annotationPoints as Trajectory['annotationPoints'])
      : undefined,
    annotationSubTrajectories: isRecord(record.annotationSubTrajectories)
      ? (record.annotationSubTrajectories as Trajectory['annotationSubTrajectories'])
      : undefined,
    segmentInstanceIdList: Array.isArray(record.segmentInstanceIdList)
      ? (record.segmentInstanceIdList as Trajectory['segmentInstanceIdList'])
      : undefined,
    attributes
  };
};

const normalizePointTableToTrajectories = (
  rows: unknown[],
  report: NormalizationReportBuilder,
  detectedShape: string
) => {
  const groups = new Map<string, unknown[]>();
  const fallbackKey = '__trajgram_fallback__';

  rows.forEach((row, index) => {
    const key = getTrajectoryGroupKey(row) ?? fallbackKey;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
    if (key === fallbackKey) {
      report.addTrace(
        'grouping',
        `Row ${index} did not expose a trajectory id; grouped into a fallback trajectory.`
      );
    }
  });

  const trajectories = Array.from(groups.entries()).map(([key, group], groupIndex) => {
    const points = group
      .map((row, pointIndex) =>
        normalizeTrajectoryPoint(
          row,
          pointIndex,
          key === fallbackKey ? `trajectory_${groupIndex}` : key,
          report,
          `group:${key}[${pointIndex}]`
        )
      )
      .filter((point): point is Trajectorypoint => point !== null);

    const sortedPoints = [...points].sort((a, b) => {
      const at = a.basePoint.time;
      const bt = b.basePoint.time;
      if (at && bt) return at.localeCompare(bt);
      return 0;
    });

    const trajectoryId = key === fallbackKey ? `trajectory_${groupIndex}` : key;
    const times = sortedPoints
      .map((point) => point.basePoint.time)
      .filter((time): time is string => typeof time === 'string' && time.length > 0);

    return {
      id: trajectoryId,
      starttime: times[0] ?? '',
      endtime: times[times.length - 1] ?? '',
      distance:
        sortedPoints.length >= 2 ? calculateDistance(sortedPoints) : 0,
      shapingPoints: sortedPoints,
      attributes: { trajectoryId }
    } satisfies Trajectory;
  });

  report.setDetectedShape(detectedShape);
  report.addTrace(
    'grouping',
    `Detected ${groups.size} trajectory group(s) from a flat point table.`
  );
  return trajectories;
};

const normalizeTrajectoryArray = (
  records: unknown[],
  report: NormalizationReportBuilder
) => {
  const trajectoryLikeCount = records.filter(isTrajectoryLike).length;
  const pointLikeCount = records.filter(isPointLike).length;
  const pointSequenceCount = records.filter((record) => isPointSequence(record)).length;

  if (trajectoryLikeCount >= Math.max(1, records.length * 0.5)) {
    const trajectories = records
      .map((record, index) => normalizeTrajectoryRecord(record, index, report))
      .filter((trajectory): trajectory is Trajectory => trajectory !== null);
    report.setDetectedShape('trajectory-array');
    return trajectories;
  }

  if (pointSequenceCount >= Math.max(1, records.length * 0.5)) {
    const trajectories = records
      .map((record, index) => {
        if (!Array.isArray(record) || !isPointSequence(record)) {
          return null;
        }

        const syntheticRecord = {
          id: `trajectory_${index}`,
          shapingPoints: record
        };
        return normalizeTrajectoryRecord(syntheticRecord, index, report);
      })
      .filter((trajectory): trajectory is Trajectory => trajectory !== null);
    report.setDetectedShape('point-sequence-array');
    report.addTrace(
      'sequence-detection',
      `Detected ${trajectories.length} trajectory sequence(s) from point[][].`
    );
    return trajectories;
  }

  if (pointLikeCount >= Math.max(1, records.length * 0.6)) {
    return normalizePointTableToTrajectories(records, report, 'point-table');
  }

  report.addWarning(
    'trajectory-array-unrecognized',
    'The input array did not look like trajectories or points.'
  );
  report.setDetectedShape('unrecognized-array');
  return [];
};

const normalizeFeatureCollection = (
  collection: ReturnType<typeof isFeatureCollection> extends true ? never : never,
  report: NormalizationReportBuilder
) => {
  return collection;
};

const normalizeGeoJSON = (
  data: unknown,
  report: NormalizationReportBuilder
) => {
  if (isLineStringFeature(data)) {
    const trajectory = normalizeTrajectoryRecord(data, 0, report);
    report.setDetectedShape('geojson-line');
    return trajectory ? [trajectory] : [];
  }

  if (isFeatureCollection(data)) {
    const lineFeatures = data.features.filter(isLineStringFeature);
    if (lineFeatures.length > 0) {
      const trajectories = lineFeatures
        .map((feature, index) => normalizeTrajectoryRecord(feature, index, report))
        .filter((trajectory): trajectory is Trajectory => trajectory !== null);
      report.setDetectedShape('geojson-line-collection');
      return trajectories;
    }

    const pointFeatures = data.features.filter(isPointFeature);
    if (pointFeatures.length > 0) {
      const pointRows = pointFeatures.map((feature) => ({
        id: feature.id,
        geometry: feature.geometry,
        properties: feature.properties
      }));
      report.setDetectedShape('geojson-point-collection');
      return normalizePointTableToTrajectories(pointRows, report, 'geojson-point-collection');
    }
  }

  return [];
};

export const normalizeTrajectoryData = (
  data: unknown,
  report: NormalizationReportBuilder
): Trajectory[] => {
  if (data === null || data === undefined) {
    report.setDetectedShape('empty');
    report.addWarning('empty-input', 'Trajectory input is empty.', undefined, 'low');
    return [];
  }

  const unwrapped = unwrapTrajectoryContainers(data);
  if (unwrapped && Array.isArray(unwrapped.payload)) {
    report.addTrace('unwrap', `Detected ${unwrapped.shape}.`);
    return normalizeTrajectoryArray(unwrapped.payload, report);
  }

  if (isFeatureCollection(data) || isLineStringFeature(data)) {
    return normalizeGeoJSON(data, report);
  }

  if (isRecord(data) && extractPointSequenceCandidate(data)) {
    const trajectory = normalizeTrajectoryRecord(data, 0, report);
    report.setDetectedShape('single-trajectory-record');
    return trajectory ? [trajectory] : [];
  }

  if (Array.isArray(data)) {
    return normalizeTrajectoryArray(data, report);
  }

  if (isRecord(data)) {
    for (const candidate of Object.values(data)) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        if (looksLikePointTable(candidate)) {
          report.addTrace('unwrap', 'Found a nested point table and normalized it.');
          return normalizePointTableToTrajectories(candidate, report, 'nested-point-table');
        }
        if (candidate.some(isTrajectoryLike)) {
          report.addTrace('unwrap', 'Found a nested trajectory list and normalized it.');
          return normalizeTrajectoryArray(candidate, report);
        }
      }
    }
  }

  report.setDetectedShape('unrecognized');
  report.addWarning(
    'trajectory-unrecognized',
    'Unable to infer trajectory sequences from the input data.'
  );
  return [];
};
