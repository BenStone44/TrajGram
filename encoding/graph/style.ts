import { parseColor } from '../../parser/regex';
import type {
  GraphLayoutSettings,
  GraphStyleSettings
} from '../types';

export type GraphResolvedStyle = {
  nodeColor: string;
  nodeRadius: number;
  nodeOpacity: number;
  linkColor: string;
  linkWidth: number;
  linkOpacity: number;
  labelColor: string;
  labelSize: number;
  labelField: string;
  showLabels: boolean;
};

export type GraphResolvedLayout = {
  edgeBundling: boolean;
  bundlingStrength: number;
  bundlingGridSize: number;
  smoothness: number;
  renderMode: 'svg' | 'webgl';
};

const toColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  return parseColor(value) ?? fallback;
};

const toNumber = (value: unknown, fallback: number) => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const resolveGraphStyle = (
  style: GraphStyleSettings
): GraphResolvedStyle => ({
  nodeColor: toColor(style.nodeColor, '#1d4ed8'),
  nodeRadius: toNumber(style.nodeRadius, 8),
  nodeOpacity: toNumber(style.nodeOpacity, 0.95),
  linkColor: toColor(style.linkColor, '#64748b'),
  linkWidth: toNumber(style.linkWidth, 2),
  linkOpacity: toNumber(style.linkOpacity, 0.45),
  labelColor: toColor(style.labelColor, '#0f172a'),
  labelSize: toNumber(style.labelSize, 12),
  labelField: typeof style.labelField === 'string' && style.labelField.length > 0
    ? style.labelField
    : 'id',
  showLabels: style.showLabels ?? true
});

export const resolveGraphLayout = (
  layout?: GraphLayoutSettings
): GraphResolvedLayout => ({
  edgeBundling: layout?.edgeBundling ?? false,
  bundlingStrength: Math.max(0, Math.min(1, toNumber(layout?.bundlingStrength, 0.35))),
  bundlingGridSize: Math.max(200, toNumber(layout?.bundlingGridSize, 1800)),
  smoothness: Math.max(0, Math.min(1, toNumber(layout?.smoothness, 0.45))),
  renderMode: layout?.renderMode === 'webgl' ? 'webgl' : 'svg'
});
