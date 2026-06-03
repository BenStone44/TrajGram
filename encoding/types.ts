import type * as d3 from 'd3';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import type { colorArray } from '../utils/utils_color';

export type EncodingType = 'trajectory' | 'area';
export type EncodingStyleKey = 'color' | 'width' | 'opacity';
export type AnnotationType = 'markers' | 'points' | 'arrows' | 'text';
export type MappingValueType = 'static' | 'gradient' | 'linear' | 'dynamic';

export interface EncodingStyleSettings {
  color?: string;
  width?: string | number;
  opacity?: string | number;
}

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

export interface AnnotationSettings {
  source: string;
  maxzoom?: number;
  minzoom?: number;
  widthFollowZoom?: boolean;
  type: AnnotationType;
  styles: AnnotationStyle;
}

export interface EncodingSettings {
  id: string;
  type: EncodingType;
  source: string;
  styles: EncodingStyleSettings;
  zIndex?: number;
  maxzoom?: number;
  minzoom?: number;
  capstyle?: 'round' | 'square';
  annotations: Record<string, AnnotationSettings>;
}

export type ColorFunction =
  | ((point: Trajectorypoint) => d3.RGBColor)
  | ((trajectory: Trajectory) => d3.RGBColor)
  | colorArray
  | string;

export type NumericFunction =
  | ((point: Trajectorypoint) => number)
  | ((trajectory: Trajectory) => number)
  | number;

export interface StyleValue<T> {
  type: MappingValueType;
  value: T;
}

export interface StyleMappingFunction {
  color: StyleValue<ColorFunction>;
  width: StyleValue<NumericFunction>;
  opacity: StyleValue<NumericFunction>;
}

export type AreaFeature = Feature<Polygon | MultiPolygon>;

export type AreaColorFunction =
  | ((feature: AreaFeature) => d3.RGBColor)
  | string;

export type AreaNumericFunction =
  | ((feature: AreaFeature) => number)
  | number;

export interface AreaStyleMappingFunction {
  color: StyleValue<AreaColorFunction>;
  width: StyleValue<AreaNumericFunction>;
  opacity: StyleValue<AreaNumericFunction>;
}

export interface PointStyleMappingFunction {
  color?: StyleValue<ColorFunction>;
  r?: StyleValue<NumericFunction>;
  opacity?: StyleValue<NumericFunction>;
}

export interface MarkerStyleMappingFunction {
  color?: StyleValue<ColorFunction>;
  size?: StyleValue<NumericFunction>;
  opacity?: StyleValue<NumericFunction>;
}

export interface TextStyleMappingFunction {
  color?: StyleValue<ColorFunction>;
  opacity?: StyleValue<NumericFunction>;
  font_size?: StyleValue<NumericFunction>;
  text?: StyleValue<
    | ((point: Trajectorypoint, trajectory: Trajectory) => string)
    | string
  >;
  follow?: boolean;
  transform?: string;
}

export type AnnotationStyleMappingFunction =
  | PointStyleMappingFunction
  | MarkerStyleMappingFunction
  | TextStyleMappingFunction;
