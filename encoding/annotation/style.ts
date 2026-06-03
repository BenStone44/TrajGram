import type { Trajectory, Trajectorypoint } from '../../interfaces/trajectory';
import {
  TrajectoryMarkerGroupProps
} from '../../render/trajectory-marker-group';
import {
  TrajectoryPointGroupProps
} from '../../render/trajectory-point-group';
import {
  TrajectoryTextGroupProps
} from '../../render/trajectory-text-group';
import {
  parseColorString,
  parseNumberString,
  parseTextString
} from '../../parser/regex';
import type {
  AnnotationSettings,
  MarkerStyle,
  MarkerStyleMappingFunction,
  PointStyle,
  PointStyleMappingFunction,
  TextStyle,
  TextStyleMappingFunction
} from '../types';

export const parsePointStyle = (
  id: string,
  setting: AnnotationSettings,
  data: () => Trajectorypoint[]
): TrajectoryPointGroupProps => {
  const pointStyles = setting.styles as PointStyle;
  const style: PointStyleMappingFunction = {
    color: parseColorString(pointStyles.color || '#333333'),
    r: parseNumberString(pointStyles.r || 5),
    opacity: parseNumberString(pointStyles.opacity || 1)
  };

  return {
    id,
    data,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    widthFollowZoom: setting.widthFollowZoom,
    style
  };
};

export const parseMarkerStyle = (
  id: string,
  setting: AnnotationSettings,
  data: () => Trajectorypoint[]
): TrajectoryMarkerGroupProps => {
  const markerStyles = setting.styles as MarkerStyle;
  const style: MarkerStyleMappingFunction = {
    color: parseColorString(markerStyles.color || '#333333'),
    size: parseNumberString(markerStyles.size || 10),
    opacity: parseNumberString(markerStyles.opacity || 1)
  };

  return {
    id,
    data,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    widthFollowZoom: setting.widthFollowZoom,
    style
  };
};

export const parseTextStyle = (
  id: string,
  setting: AnnotationSettings,
  source: Trajectory[],
  getPoints: (trajectory: Trajectory) => Trajectorypoint[]
): TrajectoryTextGroupProps => {
  const textStyles = setting.styles as TextStyle;
  const parsedText = parseTextString(textStyles.text || '');
  const style: TextStyleMappingFunction = {
    color: parseColorString(textStyles.color || '#333333'),
    opacity: parseNumberString(textStyles.opacity || 1),
    font_size: parseNumberString(textStyles.font_size ?? 12),
    text: parsedText,
    follow: textStyles.follow || false,
    transform: textStyles.transform || ''
  };

  return {
    id,
    source,
    getPoints,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    style
  };
};
