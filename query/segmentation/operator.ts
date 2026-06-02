import type { SegmentationOperator } from '../types';

export const parseSegmentationOperator = (
  operator: string
): SegmentationOperator | null => {
  if (operator === 'road') {
    return { kind: 'road' };
  }

  const pattern = /^even([DT])\((\d+)\)$/;
  const match = operator.match(pattern);
  if (!match) {
    return null;
  }

  const [, type, value] = match;
  return {
    kind: 'even',
    type: type as 'D' | 'T',
    count: Number.parseInt(value, 10)
  };
};
