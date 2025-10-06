import { TrajectoryGroup } from '../render-manager/trajectory-group';
// import pointToLineDistance from '@turf/point-to-line-distance';
import type {
  AnnotationSubtrajectory,
  Trajectory,
  Trajectorypoint
} from '../interfaces/trajectory';
import * as turf from '@turf/turf';
import type { Feature, LineString } from 'geojson';

import type { CircleRenderStyle } from './trajectorypoint';
// import type { GeoElement } from '../interfaces/geo';
import { ColorConverter } from '../utils/utils_color';
export type bufferType = 'color' | 'vertices' | 'width' | 'undefined';
export type pointInfoType =
  | 'time'
  | 'distance'
  | 'timeR'
  | 'distanceR'
  | 'LngLat';
export type styleType =
  | 'color'
  | 'vertices'
  | 'width'
  | 'miterLength'
  | 'subInvisible';

export type pointStyle = {
  r?: number;
  rFollowZoom?: boolean;
  color?: number[];
};
export const floatNumof = {
  color: 4,
  vertices: 2,
  width: 1,
  miterLength: 1
} as { [key: string]: number };

export type trajectoryInfo = {
  id: string;
  data: Trajectory;
  style?: trajectoryStyle;
};

export type trajectoryStyle = {
  width?: number;
  lineColor?: number[];
};

export interface pointRenderInfo {
  location: [number, number];
  color: [number, number, number, number];
  width: number;
}

export class TrajectoryElement {
  program: WebGLProgram;

  public id: string;
  public detailedTrajectory: Trajectory;
  public startBufferIndex = -1;
  public bufferLength = -1;
  public groupClass: TrajectoryGroup;
  public startPoint: Trajectorypoint;
  public endPoint: Trajectorypoint;
  public feature: Feature<LineString>;
  public offColor: [number, number, number, number];
  public selectedPoints: Trajectorypoint[] = [];
  private color: Array<number> = [];
  public annotationPoints: {
    source: Trajectorypoint;
    style: CircleRenderStyle;
  }[] = [];
  public annotationSubTrajectories: {
    source: AnnotationSubtrajectory;
    style: trajectoryStyle;
  }[] = [];

  constructor(
    trajectory: Trajectory,
    program: WebGLProgram,
    groupClass: TrajectoryGroup
  ) {
    this.program = program;
    this.groupClass = groupClass;
    this.offColor = ColorConverter.generateUniqueColorForId(
      trajectory.id.toString()
    );

    // props and defalut props
    this.id = trajectory.id;
    this.detailedTrajectory = trajectory;
    this.startPoint = this.detailedTrajectory.shapingPoints[0];
    this.endPoint =
      this.detailedTrajectory.shapingPoints[
        this.detailedTrajectory.shapingPoints.length - 1
      ];

    this.feature = turf.lineString(
      this.detailedTrajectory.shapingPoints.map((p) => [
        p.basePoint.position.lng,
        p.basePoint.position.lat
      ])
    );
    this.selectedPointInit();
  }


  public storeColor = (color: Array<number>) => {
    this.color = color;
  };

  private selectedPointInit = () => {
    this.selectedPoints.push(this.startPoint);
    this.selectedPoints.push(this.endPoint);
  };

  public setBufferIndex(startTriangleIndex: number, length: number) {
    this.startBufferIndex = startTriangleIndex;
    this.bufferLength = length;
  }

  public getColor() {
    return this.color;
  }

  public setStyle(type: styleType, value: number | number[]) {
    let startIndex = 0;

    let bufferType: bufferType = 'undefined';
    let bufferLength = this.bufferLength;
    switch (type) {
      case 'color':
        bufferType = 'color';
        startIndex = this.startBufferIndex * 4;
        bufferLength = 1;
        break;
      case 'width':
        bufferType = 'width';
        startIndex = this.startBufferIndex;
        break;
      default:
        break;
    }
    if (bufferType == 'undefined') throw new Error('wrong input');

    if (bufferType == 'color' && typeof value == 'number') {
      throw new Error('wrong value!');
    }
    if (bufferType == 'width' && typeof value != 'number') {
      throw new Error('wrong value!');
    }

    const values: number[] = [];
    for (let i = 0; i < bufferLength; i++)
      if (typeof value == 'number') {
        values.push(value);
      } else {
        value.forEach((v) => {
          values.push(v);
        });
      }

    this.groupClass.refreshBuffer(bufferType, startIndex, values);
    return 0;
  }


  // public intersecWith(element: GeoElement) {
  //   if (element.type == 'circle') {
  //     const point = turf.point([
  //       element.shape.center.lng,
  //       element.shape.center.lat
  //     ]);
  //     const dis = pointToLineDistance(point, this.feature, { units: 'meters' });
  //     return dis < element.shape.r;
  //   } else {
  //     return turf.booleanIntersects(this.feature, element.shape) as boolean;
  //   }
  // }

  // public startInside(element: GeoElement) {
  //   const startpoint = turf.point([
  //     this.startPoint.basePoint.position.lng,
  //     this.startPoint.basePoint.position.lat
  //   ]);
  //   if (element.type == 'circle') {
  //     const point = turf.point([
  //       element.shape.center.lng,
  //       element.shape.center.lat
  //     ]);

  //     const dis = turf.distance(point, startpoint, { units: 'kilometers' });
  //     return dis * 1000 < element.shape.r;
  //   } else {
  //     return turf.booleanPointInPolygon(startpoint, element.shape) as boolean;
  //   }
  // }

  // public endInside(element: GeoElement) {
  //   const endpoint = turf.point([
  //     this.endPoint.basePoint.position.lng,
  //     this.endPoint.basePoint.position.lat
  //   ]);
  //   if (element.type == 'circle') {
  //     const point = turf.point([
  //       element.shape.center.lng,
  //       element.shape.center.lat
  //     ]);

  //     const dis = turf.distance(point, endpoint, { units: 'kilometers' });
  //     return dis * 1000 < element.shape.r;
  //   } else {
  //     return turf.booleanPointInPolygon(endpoint, element.shape) as boolean;
  //   }
  // }

  // public addPoint(point: Trajectorypoint) {
  //   return point;
  // }

  // public addMarker(point: Trajectorypoint) {
  //   return point;
  // }

  // public addShape() {
  //   return 0;
  // }

  // public addSubtrajectoryPoint(
  //   startpoint: Trajectorypoint,
  //   endpoint: Trajectorypoint,
  //   style: trajectoryStyle
  // ) {
  //   console.log(startpoint, endpoint, style);
  //   return {} as Trajectory;
  // }
}
