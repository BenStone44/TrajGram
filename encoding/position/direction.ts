import { LngLat } from 'mapbox-gl';
import type { Trajectoolkit } from '../../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../../interfaces/trajectory';
import type { Vector } from './types';

export const addDirection = (
  trajectory: Trajectory,
  index: number,
  core: Trajectoolkit
): Trajectorypoint => {
  const currentPoint = trajectory.shapingPoints[index];
  let direction: Vector;

  if (index === 0) {
    const nextPoint = trajectory.shapingPoints[index + 1];
    direction = computeUnitVector(
      currentPoint.basePoint.position,
      nextPoint.basePoint.position,
      core
    );
  } else if (index === trajectory.shapingPoints.length - 1) {
    const previousPoint = trajectory.shapingPoints[index - 1];
    direction = computeUnitVector(
      previousPoint.basePoint.position,
      currentPoint.basePoint.position,
      core
    );
  } else {
    const previousPoint = trajectory.shapingPoints[index - 1];
    const nextPoint = trajectory.shapingPoints[index + 1];
    direction = calculateDirectionByThreePoints(
      previousPoint.basePoint.position,
      currentPoint.basePoint.position,
      nextPoint.basePoint.position,
      core
    );
  }

  if (currentPoint.attributes.computed) {
    currentPoint.attributes.computed.direction = direction;
  }
  return currentPoint;
};

const lngLatToCoordinates = (
  point: LngLat,
  core: Trajectoolkit
): Vector => {
  if (!core.AnnotationsSVG || !core.map) {
    throw new Error('TKT not initialized');
  }

  const projectedPoint = core.map.project(point);
  return { x: projectedPoint.x, y: projectedPoint.y };
};

export const computeUnitVector = (
  point1: LngLat,
  point2: LngLat,
  core: Trajectoolkit
): Vector => {
  const p1 = lngLatToCoordinates(point1, core);
  const p2 = lngLatToCoordinates(point2, core);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: dx / length, y: dy / length };
};

const calculateDirectionByThreePoints = (
  pointA: LngLat,
  pointB: LngLat,
  pointC: LngLat,
  core: Trajectoolkit
): Vector => {
  const vector1 = computeUnitVector(pointB, pointA, core);
  const vector2 = computeUnitVector(pointB, pointC, core);
  return { x: vector2.x - vector1.x, y: vector2.y - vector1.y };
};
