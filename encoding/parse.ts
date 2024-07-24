import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import type { TrajectoryGroupProps } from '../render-manager/trajectory-group';
import type { EncodingSettings, StyleMappingFunction } from './encoding';
import type { colorArray } from '../utils/utils_color';
import { getPointByDistanceR, getPointByTimeRatio } from '../utils/utils_point';
// import { parseColorString } from '../data-management/parse';
interface Vector {
  x: number;
  y: number;
}



export const positionParse = (
  expression: string,
  type: string,
  core: Trajectoolkit
) => {
  if (expression == '$T.distance[0]')
    if (type == 'text') {
      return (T: Trajectory) => [addDirection(T, 0, core)];
    } else return (T: Trajectory) => [T.shapingPoints[0]];
  else if (expression == '$T.distance[1]')
    if (type == 'text') {
      return (T: Trajectory) => [
        addDirection(T, T.shapingPoints.length - 1, core)
      ];
    } else
      return (T: Trajectory) => [T.shapingPoints[T.shapingPoints.length - 1]];
  else if (expression == '$T.distance(5)') {
    return (T: Trajectory) => {
      return [0, 0.2, 0.4, 0.6, 0.8, 1].map((r) =>
        getPointByDistanceR(core, T, r, T.id + r)
      );
    };
  } else if (expression == '$T.time(5)') {
    return (T: Trajectory) => {
      return [0, 0.2, 0.4, 0.6, 0.8, 1].map((r) =>
        getPointByTimeRatio(core, T, r, T.id + r)
      );
    };
  } else if (expression == '$T.distance[0.5]') {
    return (T: Trajectory) => {
      return [0.5].map((r) => getPointByDistanceR(core, T, r, T.id + r));
    };
  } else return (T: Trajectory) => []; // addDirection(T, 0, core),
  // addDirection(T, 20, core),
  // addDirection(T, 40, core),
  // addDirection(T, 60, core),
  // addDirection(T, 80, core),
  // addDirection(T, T.shapingPoints.length - 1, core)];
};
export const addDirection = (
  T: Trajectory,
  index: number,
  core: Trajectoolkit
): Trajectorypoint => {
  let direction: Vector;
  const currentPoint = T.shapingPoints[index];
  if (index == 0) {
    const nextPoint = T.shapingPoints[index + 1];
    direction = computeUnitVector(
      currentPoint.basePoint.position,
      nextPoint.basePoint.position,
      core
    );
    if (currentPoint.attributes.computed)
      currentPoint.attributes.computed.direction = direction;

    return currentPoint;
  } else if (index == T.shapingPoints.length - 1) {
    const prePoint = T.shapingPoints[index - 1];
    const direction = computeUnitVector(
      prePoint.basePoint.position,
      currentPoint.basePoint.position,
      core
    );
    if (currentPoint.attributes.computed)
      currentPoint.attributes.computed.direction = direction;
    return currentPoint;
  } else {
    const prePoint = T.shapingPoints[index - 1];
    const nextPoint = T.shapingPoints[index + 1];
    direction = calculatVectorWithThreePoint(
      prePoint.basePoint.position,
      currentPoint.basePoint.position,
      nextPoint.basePoint.position,
      core
    );
    if (currentPoint.attributes.computed)
      currentPoint.attributes.computed.direction = direction;
    return currentPoint;
  }
};
export const calculateCoordinates = (
  point: LngLat,
  core: Trajectoolkit
): Vector => {
  if (!core.AnnotationsSVG || !core.map) throw new Error('TKT not initialized');
  const rp = core.map.project(point);
  return {
    x: rp.x,
    y: rp.y
  };
};
export const computeUnitVector = (
  point1: LngLat,
  point2: LngLat,
  core: Trajectoolkit
): Vector => {
  const p1 = calculateCoordinates(point1, core);
  const p2 = calculateCoordinates(point2, core);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    //throw new Error('Cannot compute unit vector for zero length');
    return { x: 0, y: 0 };
  }

  return { x: dx / length, y: dy / length };
};
export const calculatVectorWithThreePoint = (
  A: LngLat,
  B: LngLat,
  C: LngLat,
  core: Trajectoolkit
): Vector => {
  const vector1 = computeUnitVector(B, A, core);
  const vector2 = computeUnitVector(B, C, core);
  return { x: vector2.x - vector1.x, y: vector2.y - vector1.y };
};

export const parseTrajectoryStyle = (
  core: Trajectoolkit,
  props: EncodingSettings,
  styles: StyleMappingFunction,
): TrajectoryGroupProps => {
  return {
    id: props.id,
    data: () => core.getDQSDatabyID(props.source) as Trajectory[],
    maxZoom: props.maxzoom,
    minZoom: props.minzoom,
    capStyle: props.capstyle,
    style: styles
  };
};
