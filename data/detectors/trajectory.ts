import {
  flattenLineCoordinates,
  isFeatureCollection,
  isLineStringFeature,
  isRecord,
  toObjectArray,
  WRAPPED_COLLECTION_KEYS
} from '../shared';
import { extractPointSequenceCandidate, isPointSequence } from './sequence';

export const isTrajectoryLike = (value: unknown) => {
  if (isLineStringFeature(value)) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  if (extractPointSequenceCandidate(value)) {
    return true;
  }

  if (
    typeof value.id === 'string' &&
    (typeof value.starttime === 'string' ||
      typeof value.endtime === 'string' ||
      typeof value.distance === 'number')
  ) {
    return true;
  }

  return false;
};

export const unwrapTrajectoryContainers = (
  value: unknown
): { shape: string; payload: unknown } | null => {
  if (Array.isArray(value)) {
    return { shape: 'array', payload: value };
  }

  if (isFeatureCollection(value)) {
    return { shape: 'feature-collection', payload: value };
  }

  if (isLineStringFeature(value)) {
    return { shape: 'feature', payload: value };
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of WRAPPED_COLLECTION_KEYS) {
    const candidate = value[key];
    if (Array.isArray(candidate)) {
      return { shape: `wrapped:${key}`, payload: candidate };
    }
  }

  if (extractPointSequenceCandidate(value)) {
    return { shape: 'single-trajectory-record', payload: value };
  }

  for (const candidate of Object.values(value)) {
    if (Array.isArray(candidate) && isPointSequence(candidate)) {
      return { shape: 'embedded-point-sequence', payload: candidate };
    }
  }

  return null;
};

export const lineFeatureToPointRecords = (
  value: unknown,
  trajectoryId: string
) => {
  if (!isLineStringFeature(value)) {
    return null;
  }

  return flattenLineCoordinates(value.geometry).map((coordinate, pointIndex) => ({
    id: `${trajectoryId}_p${pointIndex}`,
    coordinates: coordinate
  }));
};

export const looksLikePointTable = (value: unknown) => {
  const records = toObjectArray(value);
  if (!records || records.length === 0) {
    return false;
  }

  const pointLikeCount = records.filter((record) => !isTrajectoryLike(record)).length;
  return pointLikeCount / records.length >= 0.6;
};
