import type { Trajectoolkit } from '../../Trajectoolkit';
import type { Trajectory } from '../../interfaces/trajectory';
import { getPointByDistanceR, getPointByTimeRatio } from '../../utils/utils_point';
import type { AnnotationType } from '../types';
import { addDirection } from './direction';
import { parsePositionExpression } from './operator';

const createCountRatios = (count: number) =>
  count === 1
    ? [0.5]
    : Array.from({ length: count }, (_, index) => index / (count - 1));

export const positionParse = (
  expression: string,
  type: AnnotationType,
  core: Trajectoolkit,
  variables?: Record<string, number>
) => {
  const parsed = parsePositionExpression(expression);
  if (!parsed) {
    throw new Error('Failed to parse trajectory expression. Invalid format.');
  }

  const { method, type: parseType, values } = parsed;
  if (parseType === 'index' && Array.isArray(values) && values.length === 1) {
    if (values[0] === 0) {
      return (trajectory: Trajectory) =>
        type === 'text'
          ? [addDirection(trajectory, 0, core)]
          : [trajectory.shapingPoints[0]];
    }
    if (values[0] === 1) {
      return (trajectory: Trajectory) =>
        type === 'text'
          ? [addDirection(trajectory, trajectory.shapingPoints.length - 1, core)]
          : [trajectory.shapingPoints[trajectory.shapingPoints.length - 1]];
    }
  }

  const generatePoints = (ratios: number[], trajectory: Trajectory) => {
    if (method === 'distance') {
      return ratios.map((ratio) =>
        getPointByDistanceR(core, trajectory, ratio, trajectory.id + ratio)
      );
    }
    if (method === 'time') {
      return ratios.map((ratio) =>
        getPointByTimeRatio(core, trajectory, ratio, trajectory.id + ratio)
      );
    }
    return [];
  };

  if (parseType === 'ratio' && Array.isArray(values)) {
    return (trajectory: Trajectory) => generatePoints(values, trajectory);
  }

  if (parseType === 'count') {
    if (typeof values === 'string' && variables) {
      return (trajectory: Trajectory) => {
        const count = variables[values];
        if (!count || count <= 0) {
          return [];
        }
        const ratios = createCountRatios(count);
        return generatePoints(ratios, trajectory);
      };
    }

    if (Array.isArray(values)) {
      return (trajectory: Trajectory) => generatePoints(values, trajectory);
    }
  }

  throw new Error('Failed to parse trajectory expression. Invalid format.');
};
