import type * as d3 from 'd3';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import type { colorArray } from '../utils/utils_color';

export type EncodingType = 'trajectory';
export type EncodingStyleKey = 'color' | 'width' | 'opacity';
export type AnnotationType = 'markers' | 'points' | 'arrows' | 'text';
export type MappingValueType = 'static' | 'gradient' | 'linear';

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
  text?: StyleValue<((point: Trajectorypoint) => string) | ((trajectory: Trajectory) => string) | string>;
  follow?: boolean;
  transform?: string;
}

export type AnnotationStyleMappingFunction =
  | PointStyleMappingFunction
  | MarkerStyleMappingFunction
  | TextStyleMappingFunction;
