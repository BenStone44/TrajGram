import { LngLat } from 'mapbox-gl';
import { ColorConverter, type colorArray } from '../utils/utils_color';
import type { Trajectorypoint } from '../interfaces/trajectory';
import { TrajectoryPointGroup } from '../render-manager/trajectory-point-group';
import type { GeoElement } from '../interfaces/geo';
import * as turf from '@turf/turf';

export type TrajectoryPointRenderStyleFields =
  | 'center'
  | 'color'
  //   | 'fillOpacity'
  | 'stroke'
  | 'strokeWidth'
  //   | 'strokeOpacity'
  | 'r';

export type TrajectoryPointRenderBufferFields = 'color' | 'r' | 'vertices';

export type inputCircleStyle = {
  fill?: colorArray;
  fillOpacity?: number;
  stroke?: colorArray;
  strokeWidth?: number;
  strokeOpacity?: number;
  r: number;
};

export interface CircleRenderStyle {
  location: [number, number];
  fill: colorArray;
  //   fillOpacity: number;
  stroke: colorArray;
  strokeWidth: number;
  //   strokeOpacity: number;
  r: number;
}

export interface TrajectoryPointInputInfo {
  source: Trajectorypoint;
  style: inputCircleStyle;
}

const defalutColor: colorArray = [0, 1, 0, 0.1];

export const defaultTrajectoryPointRenderStyle = {
  fill: defalutColor,
  //  fillOpacity: 1,
  stroke: defalutColor,
  strokeWidth: 0,
  //  strokeOpacity: 0,
  r: 3
};

export class TrajectoryPointElement {
  program: WebGLProgram;

  public id: string;
  public style: { [key: string]: any } = {};
  public trajectorypoint: Trajectorypoint;
  public center: LngLat;
  public startBufferIndex = -1;
  public bufferLength = -1;
  public groupClass: TrajectoryPointGroup;
  public offColor: colorArray;
  private color: colorArray;

  public fill: (value?: colorArray) => colorArray = () =>
    defaultTrajectoryPointRenderStyle.fill;
  public stroke: (value?: colorArray) => colorArray = () =>
    defaultTrajectoryPointRenderStyle.stroke;
  public strokeWidth: (value?: number) => number = () =>
    defaultTrajectoryPointRenderStyle.strokeWidth;
  public r: (value?: number) => number = () =>
    defaultTrajectoryPointRenderStyle.r;

  constructor(
    props: TrajectoryPointInputInfo,
    program: WebGLProgram,
    groupClass: TrajectoryPointGroup
  ) {
    this.program = program;
    this.groupClass = groupClass;

    // props and defalut props
    const { source, style } = { ...props };
    const { fill, stroke, strokeWidth, r } = {
      ...style
    };
    this.id = source.id;
    this.trajectorypoint = source;
    this.offColor = ColorConverter.generateUniqueColorForId(
      source.id.toString()
    );

    this.style.fill = fill || defaultTrajectoryPointRenderStyle.fill;
    this.color = new ColorConverter(this.style.fill).Array();
    // this.style.fillOpacity = fillOpacity || defaultCircleStyle.fillOpacity;
    this.style.stroke = stroke || defaultTrajectoryPointRenderStyle.stroke;
    this.style.strokeWidth =
      strokeWidth || defaultTrajectoryPointRenderStyle.strokeWidth;
    this.style.r = r || defaultTrajectoryPointRenderStyle.r;
    this.center = source.basePoint.position;

    Object.keys(this.style).forEach((key) => {
      (this as any)[key] = this.generateElementStyleGetterSetter(key);
    });
  }

  private generateElementStyleGetterSetter(key: string) {
    return (value?: any) => {
      if (value !== undefined) {
        this.style[key] = value;
        return this;
      }
      return this.style[key];
    };
  }

  public setCenter(position: LngLat) {
    this.center = position;
  }

  public setBufferIndex(startIndex: number, length: number) {
    this.startBufferIndex = startIndex;
    this.bufferLength = length;
  }

  public inside(element: GeoElement) {
    const startpoint = turf.point([
      this.trajectorypoint.basePoint.position.lng,
      this.trajectorypoint.basePoint.position.lat
    ]);
    if (element.type == 'circle') {
      const point = turf.point([
        element.shape.center.lng,
        element.shape.center.lat
      ]);

      const dis = turf.distance(point, startpoint, 'kilometers');
      return dis * 1000 < element.shape.r;
    } else {
      // return turf.booleanPointInPolygon(startpoint, element.shape);
    }
  }
  public getColor() {
    return this.color;
  }

  public setStyle(
    type: TrajectoryPointRenderStyleFields,
    value: number | number[]
  ) {
    let startIndex = 0;

    let bufferType: TrajectoryPointRenderBufferFields;
    switch (type) {
      case 'r':
        bufferType = 'r';
        startIndex = this.startBufferIndex;
        break;
      case 'color':
        bufferType = 'color';
        startIndex = this.startBufferIndex * 4;
        break;
      case 'center':
        bufferType = 'vertices';
        startIndex = this.startBufferIndex * 2;
        break;
      default:
        bufferType = 'r';
        break;
    }

    let values: number[];
    if (typeof value == 'number') {
      values = [value];
    } else {
      values = value;
    }

    if (bufferType)
      this.groupClass.refreshBuffer(bufferType, startIndex, values);
    return 0;
  }
}
