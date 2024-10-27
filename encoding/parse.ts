import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import type { TrajectoryGroupProps } from '../render-manager/trajectory-group';
import type { EncodingSettings, StyleMappingFunction } from './encoding';
import { getPointByDistanceR, getPointByTimeRatio } from '../utils/utils_point';
// import { parseColorString } from '../data-management/parse';
interface Vector {
  x: number;
  y: number;
}


interface ParseResult {
  method: string;      // 'distance' 或 'time'
  type: 'index' | 'ratio' | 'count';
  values: number[];
}

const parseExpression = (expression: string): ParseResult | null => {
  // 移除所有空格
  expression = expression.replace(/\s+/g, '');
  
  const patterns = {
    // 支持多个数字: [0,0.2,0.5] 或 [0] 这样的格式
    index: /^\$T\.(distance|time)\[((?:\d*\.?\d+,?)+)\]$/,
    count: /^\$T\.(distance|time)\(([0-9]+)\)$/,
    variable: /^\$T\.(distance|time)\(\$([a-zA-Z][a-zA-Z0-9]*)\)$/
  };

  // 处理索引和比例列表
  let match = expression.match(patterns.index);
  if (match) {
    const [_, method, valueStr] = match;
    // 解析所有数值
    const numbers = valueStr.split(',').map(Number);
    
    // 验证所有数值是否在有效范围内
    const isValid = numbers.every(n => !isNaN(n) && n >= 0 && n <= 1);
    if (!isValid) {
      throw new Error(`Invalid values in expression: ${expression}. All values must be between 0 and 1.`);
    }

    // 如果只有一个值，且是0或1，按索引处理
    if (numbers.length === 1) {
      if (numbers[0] === 0 || numbers[0] === 1) {
        return { method, type: 'index', values: numbers };
      }
    }
    
    return { method, type: 'ratio', values: numbers };
  }

  // 处理固定数量的点 (5)
  match = expression.match(patterns.count);
  if (match) {
    const [_, method, count] = match;
    const numCount = Number(count);
    const values = Array.from(
      { length: numCount }, 
      (_, i) => i / (numCount - 1)
    );
    return { method, type: 'count', values };
  }

  // 处理变量数量的点 ($n)
  match = expression.match(patterns.variable);
  if (match) {
    const [_, method, varName] = match;
    return { 
      method, 
      type: 'count', 
      values: varName 
    };
  }

  return null;
};

export const positionParse = (
  expression: string,
  type: string,
  core: Trajectoolkit,
  variables?: { [key: string]: number }
) => {
  const parsed = parseExpression(expression);
  if (!parsed) return (T: Trajectory) => [];

  const { method, type: parseType, values } = parsed;

  // 处理单个索引类型 ([0] 或 [1])
  if (parseType === 'index' && values.length === 1) {
    if (values[0] === 0) {
      if (type === 'text') {
        return (T: Trajectory) => [addDirection(T, 0, core)];
      }
      return (T: Trajectory) => [T.shapingPoints[0]];
    } else if (values[0] === 1) {
      if (type === 'text') {
        return (T: Trajectory) => [
          addDirection(T, T.shapingPoints.length - 1, core)
        ];
      }
      return (T: Trajectory) => [T.shapingPoints[T.shapingPoints.length - 1]];
    }
  }

  // 生成点的函数
  const generatePoints = (ratios: number[], T: Trajectory) => {
    if (method === 'distance') {
      return ratios.map(r => getPointByDistanceR(core, T, r, T.id + r));
    } else if (method === 'time') {
      return ratios.map(r => getPointByTimeRatio(core, T, r, T.id + r));
    }
    return [];
  };

  // 处理比例列表
  if (parseType === 'ratio') {
    return (T: Trajectory) => generatePoints(values, T);
  }

  // 处理数量类型（固定或变量）
  if (parseType === 'count') {
    if (typeof values === 'string' && variables) {
      // 使用变量
      return (T: Trajectory) => {
        const count = variables[values];
        if (!count) return [];
        const ratios = Array.from(
          { length: count }, 
          (_, i) => i / (count - 1)
        );
        return generatePoints(ratios, T);
      };
    } else if (Array.isArray(values)) {
      // 使用固定数量
      return (T: Trajectory) => generatePoints(values, T);
    }
  }

  return (T: Trajectory) => [];
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
