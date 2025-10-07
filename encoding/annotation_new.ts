import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import {
  TrajectoryPointGroup,
  type TrajectoryPointGroupProps
} from '../render-manager/trajectory-point-group_new';
import { positionParse } from './parse';
import {
  TrajectoryMarkerGroup,
  type TrajectoryMarkerGroupProps
} from '../render-manager/trajectory-marker-group_new';
import {
  TrajectoryTextGroup,
  type TrajectoryTextGroupProps
} from '../render-manager/trajectory-text-group_new';
import { parseColorString, parseNumberString } from '../parseString/regex';
import type { ColorFunction, NumricFunction } from './encoding';

export type AnnotationType = 'markers' | 'points' | 'arrows' | 'text';

export interface MarkerStyle {
  size?: string | number;
  color?: string;
  opacity?: string | number;
}

export interface PointStyle {
  color?: string;
  r?: string | number;
  opacity?: string | number;
}

export interface ArrowStyle {
  direction?: boolean;
  color?: string;
  size?: string | number;
}

export interface TextStyle {
  color?: string;
  opacity?: string | number;
  text?: string;
  font_size?: string | number;
  transform?: string;
  follow?: boolean;
}

export type AnnotationStyle = MarkerStyle | PointStyle | ArrowStyle | TextStyle;

// 点样式映射函数接口
export interface PointStyleMappingFunction {
  color?: { type: string; value: ColorFunction };
  r?: { type: string; value: NumricFunction };
  opacity?: { type: string; value: NumricFunction };
}

// 标记样式映射函数接口
export interface MarkerStyleMappingFunction {
  color?: { type: string; value: ColorFunction };
  size?: { type: string; value: NumricFunction };
  opacity?: { type: string; value: NumricFunction };
}

// 文本样式映射函数接口
export interface TextStyleMappingFunction {
  color?: { type: string; value: ColorFunction };
  opacity?: { type: string; value: NumricFunction };
  font_size?: { type: string; value: NumricFunction };
  text?: { type: string; value: ((P: Trajectorypoint) => string) | ((T: Trajectory) => string) | string };
  follow?: { type: string; value: boolean };
  transform?: { type: string; value: string };
}

// 箭头样式映射函数接口
export interface ArrowStyleMappingFunction {
  color?: { type: string; value: ColorFunction };
  size?: { type: string; value: NumricFunction };
  direction?: { type: string; value: boolean };
}

// 联合类型，用于替换原来的 AnnotationStyleMappingFunction
export type AnnotationStyleMappingFunction = 
  | PointStyleMappingFunction 
  | MarkerStyleMappingFunction 
  | TextStyleMappingFunction 
  | ArrowStyleMappingFunction;

export const parsePointStyle = (
  id: string,
  setting: AnnotationSettings,
  data: () => Trajectorypoint[]
): TrajectoryPointGroupProps => {
  const pointStyles = setting.styles as PointStyle;
  const mappingFunction: PointStyleMappingFunction = {
    color: parseColorString(pointStyles.color || '#333333'),
    r: parseNumberString(pointStyles.r || 5),
    opacity: parseNumberString(pointStyles.opacity || 1)
  };

  return {
    id: id,
    data: data,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    style: mappingFunction
  };
};

export const parseMarkerStyle = (
  id: string,
  setting: AnnotationSettings,
  data: () => Trajectorypoint[]
): TrajectoryMarkerGroupProps => {
  const markerStyles = setting.styles as MarkerStyle;
  const mappingFunction: MarkerStyleMappingFunction = {
    color: parseColorString(markerStyles.color || '#333333'),
    size: parseNumberString(markerStyles.size || 10),
    opacity: parseNumberString(markerStyles.opacity || 1)
  };

  return {
    id: id,
    data: data,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    style: mappingFunction
  };
};

export const parseTextStyle = (
  id: string,
  setting: AnnotationSettings,
  source: Trajectory[],
  getPoints: (T: Trajectory) => Trajectorypoint[]
): TrajectoryTextGroupProps => {
  const textStyles = setting.styles as TextStyle;
  const mappingFunction: TextStyleMappingFunction = {
    color: parseColorString(textStyles.color || '#333333'),
    opacity: parseNumberString(textStyles.opacity || 1),
    font_size: parseNumberString(textStyles.font_size || 12),
    text: { type: 'constant', value: textStyles.text || '' },
    follow: { type: 'constant', value: textStyles.follow || false },
    transform: { type: 'constant', value: textStyles.transform || 'none' }
  };

  return {
    id: id,
    source,
    getPoints,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    style: mappingFunction
  };
};

export const parseArrowStyle = (
  id: string,
  setting: AnnotationSettings,
  data: () => Trajectorypoint[]
): any => { // 您需要定义 TrajectoryArrowGroupProps 类型
  const arrowStyles = setting.styles as ArrowStyle;
  const mappingFunction: ArrowStyleMappingFunction = {
    color: parseColorString(arrowStyles.color || '#333333'),
    size: parseNumberString(arrowStyles.size || 10),
    direction: { type: 'constant', value: arrowStyles.direction || true }
  };

  return {
    id: id,
    data: data,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    style: mappingFunction
  };
};

export interface AnnotationSettings {
  source: string;
  maxzoom?: number;
  minzoom?: number;
  type: AnnotationType;
  styles: AnnotationStyle;
}

export class Annotation {
  public id;
  public type: AnnotationType;
  public source: Trajectory[];
  public getPositions: (T: Trajectory) => Trajectorypoint[];
  public trajectorypointGroup: TrajectoryPointGroup | null = null;
  public trajectorymarkerGroup: TrajectoryMarkerGroup | null = null;
  public trajectorytextGroup: TrajectoryTextGroup | null = null;
  public mappingFunction: AnnotationStyleMappingFunction = {};
  private core: Trajectoolkit;

  constructor(
    id: string,
    setting: AnnotationSettings,
    data: Trajectory[],
    core: Trajectoolkit
  ) {
    this.type = setting.type;
    this.id = id;
    this.source = data;
    this.core = core;
    this.getPositions = positionParse(setting.source, setting.type, core);
    this.initialMappingFunction(setting);
    this.draw();
  }

  initialMappingFunction(setting: AnnotationSettings) {
    // 根据不同类型调用相应的解析函数
    if (this.type === 'points') {
      const pointGroupProps = parsePointStyle(
        this.id, 
        setting, 
        () => this.source.flatMap(this.getPositions)
      );
      this.mappingFunction = pointGroupProps.style;
    } else if (this.type === 'markers') {
      const markerGroupProps = parseMarkerStyle(
        this.id, 
        setting, 
        () => this.source.flatMap(this.getPositions)
      );
      this.mappingFunction = markerGroupProps.style;
    } else if (this.type === 'text') {
      const textGroupProps = parseTextStyle(
        this.id, 
        setting, 
        this.source, 
        this.getPositions
      );
      this.mappingFunction = textGroupProps.style;
    } else if (this.type === 'arrows') {
      const arrowGroupProps = parseArrowStyle(
        this.id, 
        setting, 
        () => this.source.flatMap(this.getPositions)
      );
      this.mappingFunction = arrowGroupProps.style;
    }
  }

 draw(setting: AnnotationSettings) {
    if (this.type == 'points') {
      //this.clearMarkers(this.id, core);
      this.trajectorypointGroup = this.core.addPointGroup(
        parsePointStyle(this.id, setting, () =>
          this.source.flatMap((T) => this.getPositions(T))
        )
      );
    }
    if (this.type == 'markers') {
      this.trajectorymarkerGroup = this.core.addMarkerGroup(
        parseMarkerStyle(this.id, setting, () =>
          this.source.flatMap((T) => this.getPositions(T))
        )
      );
    }
    if (this.type == 'text') {
      this.trajectorytextGroup = this.core.addTextGroup(
        parseTextStyle(this.id, setting, this.source, this.getPositions)
      );
    }
  }
}