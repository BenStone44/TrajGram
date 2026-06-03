import { isRecord, POINT_SEQUENCE_KEYS } from '../shared';
import { isPointLike, scorePointLike } from './point';

export const isPointSequence = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const pointLikeCount = value.filter(isPointLike).length;
  return pointLikeCount / value.length >= 0.6;
};

export const extractPointSequenceCandidate = (
  value: unknown
): { key: string; points: unknown[] } | null => {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of POINT_SEQUENCE_KEYS) {
    const candidate = value[key];
    if (Array.isArray(candidate) && isPointSequence(candidate)) {
      return { key, points: candidate };
    }
  }

  let best:
    | {
        key: string;
        points: unknown[];
        score: number;
      }
    | null = null;

  for (const [key, candidate] of Object.entries(value)) {
    if (!Array.isArray(candidate) || candidate.length === 0) {
      continue;
    }

    const score =
      candidate.reduce((sum, item) => sum + scorePointLike(item), 0) /
      candidate.length;

    if (score >= 3 && (!best || score > best.score)) {
      best = { key, points: candidate, score };
    }
  }

  if (!best) {
    return null;
  }

  return { key: best.key, points: best.points };
};
