import {
  isPointFeature,
  isRecord,
  normalizePosition
} from '../shared';

const hasTimeLikeField = (value: Record<string, unknown>) =>
  typeof value.time === 'string' ||
  typeof value.timestamp === 'string' ||
  typeof value.datetime === 'string';

export const scorePointLike = (value: unknown): number => {
  if (isPointFeature(value)) {
    return 4;
  }

  if (!isRecord(value)) {
    return 0;
  }

  let score = 0;
  if (normalizePosition(value.position ?? value.coordinates ?? value)) {
    score += 3;
  }

  if (isRecord(value.basePoint)) {
    if (
      normalizePosition(
        value.basePoint.position ?? value.basePoint.coordinates ?? value.basePoint
      )
    ) {
      score += 3;
    }
    if (hasTimeLikeField(value.basePoint)) {
      score += 1;
    }
  }

  if (hasTimeLikeField(value)) {
    score += 1;
  }

  if (isRecord(value.geometry) && value.geometry.type === 'Point') {
    score += 2;
  }

  return score;
};

export const isPointLike = (value: unknown) => scorePointLike(value) >= 3;
