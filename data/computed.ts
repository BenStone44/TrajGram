import * as turf from '@turf/turf';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import type { NormalizationReportBuilder } from './report';

type PositionLike = {
  lng: number;
  lat: number;
};

const EARTH_RADIUS = 6378137;
const MAX_LATITUDE = 85.0511287798;

const toMercator = (position: PositionLike) => {
  const d = Math.PI / 180;
  const lat = Math.max(Math.min(MAX_LATITUDE, position.lat), -MAX_LATITUDE);
  const sin = Math.sin(lat * d);

  return {
    x: EARTH_RADIUS * position.lng * d,
    y: (EARTH_RADIUS * Math.log((1 + sin) / (1 - sin))) / 2
  };
};

const normalizeVector = (dx: number, dy: number) => {
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: dx / length,
    y: dy / length
  };
};

const computeDirection = (
  previous: PositionLike | null,
  current: PositionLike,
  next: PositionLike | null
) => {
  if (!previous && !next) {
    return { x: 0, y: 0 };
  }

  if (!previous && next) {
    const start = toMercator(current);
    const end = toMercator(next);
    return normalizeVector(end.x - start.x, end.y - start.y);
  }

  if (previous && !next) {
    const start = toMercator(previous);
    const end = toMercator(current);
    return normalizeVector(end.x - start.x, end.y - start.y);
  }

  const start = toMercator(previous as PositionLike);
  const end = toMercator(next as PositionLike);
  return normalizeVector(end.x - start.x, end.y - start.y);
};

const parseTimestamp = (value?: string) => {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const computeDistanceRatios = (points: Trajectorypoint[]) => {
  if (points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    return [0];
  }

  const cumulative: number[] = [0];
  let totalDistance = 0;

  for (let index = 1; index < points.length; index++) {
    const previousPoint = turf.point([
      points[index - 1].basePoint.position.lng,
      points[index - 1].basePoint.position.lat
    ]);
    const currentPoint = turf.point([
      points[index].basePoint.position.lng,
      points[index].basePoint.position.lat
    ]);
    totalDistance += turf.distance(previousPoint, currentPoint, {
      units: 'kilometers'
    });
    cumulative.push(totalDistance);
  }

  if (totalDistance === 0) {
    return points.map((_, index) => index / (points.length - 1));
  }

  return cumulative.map((distance) => distance / totalDistance);
};

const computeTimeRatios = (
  trajectory: Trajectory,
  distanceRatios: number[],
  report?: NormalizationReportBuilder
) => {
  const pointTimes = trajectory.shapingPoints.map((point) =>
    parseTimestamp(point.basePoint.time)
  );

  if (pointTimes.every((value) => value !== null)) {
    const start = pointTimes[0] as number;
    const end = pointTimes[pointTimes.length - 1] as number;
    const duration = end - start;

    if (duration > 0) {
      return pointTimes.map((value) => ((value as number) - start) / duration);
    }
  }

  const start = parseTimestamp(trajectory.starttime);
  const end = parseTimestamp(trajectory.endtime);
  if (start !== null && end !== null && end > start) {
    report?.addTrace(
      'computed-trajTP',
      `Trajectory ${trajectory.id} fell back to distance-ratio-based trajTP because per-point time was incomplete.`
    );
    return [...distanceRatios];
  }

  report?.addTrace(
    'computed-trajTP',
    `Trajectory ${trajectory.id} fell back to index-ratio-based trajTP because no valid temporal information was available.`
  );
  return trajectory.shapingPoints.length <= 1
    ? [0]
    : trajectory.shapingPoints.map(
        (_, index) => index / (trajectory.shapingPoints.length - 1)
      );
};

export const enrichTrajectoryComputedValues = (
  trajectories: Trajectory[],
  report?: NormalizationReportBuilder
) => {
  trajectories.forEach((trajectory) => {
    if (!Array.isArray(trajectory.shapingPoints) || trajectory.shapingPoints.length === 0) {
      return;
    }

    const distanceRatios = computeDistanceRatios(trajectory.shapingPoints);
    const timeRatios = computeTimeRatios(trajectory, distanceRatios, report);

    trajectory.shapingPoints.forEach((point, index) => {
      point.attributes = point.attributes ?? {};
      point.attributes.computed = point.attributes.computed ?? {};

      point.attributes.computed.trajDP = distanceRatios[index] ?? 0;
      point.attributes.computed.trajTP = timeRatios[index] ?? 0;
      point.attributes.computed.direction = computeDirection(
        index > 0 ? trajectory.shapingPoints[index - 1].basePoint.position : null,
        point.basePoint.position,
        index < trajectory.shapingPoints.length - 1
          ? trajectory.shapingPoints[index + 1].basePoint.position
          : null
      );
    });
  });

  return trajectories;
};
