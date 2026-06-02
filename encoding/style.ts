import type { Trajectory } from '../interfaces/trajectory';
import type { TrajectoryGroupProps } from '../render-manager/trajectory-group';
import { parseColorString, parseNumberString } from '../parseString/regex';
import type {
  EncodingSettings,
  EncodingStyleKey,
  StyleMappingFunction
} from './types';

export const createEncodingStyleMapping = (
  settings: EncodingSettings
): StyleMappingFunction => ({
  color: parseColorString(settings.styles.color || '#333333'),
  opacity: parseNumberString(settings.styles.opacity || 1),
  width: parseNumberString(settings.styles.width || 5)
});

export const createTrajectoryGroupProps = (
  settings: EncodingSettings,
  data: Trajectory[],
  styles: StyleMappingFunction
): TrajectoryGroupProps => ({
  id: settings.id,
  data,
  zIndex: settings.zIndex,
  maxZoom: settings.maxzoom,
  minZoom: settings.minzoom,
  capStyle: settings.capstyle,
  style: styles
});

export const isEncodingStyleKey = (
  key: string
): key is EncodingStyleKey =>
  key === 'color' || key === 'width' || key === 'opacity';
