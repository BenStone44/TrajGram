import * as d3 from 'd3';
import type { AreaFeature, AreaNumericFunction, AreaStyleMappingFunction, EncodingSettings } from '../types';
import { extractList, parseColor } from '../../parser/regex';
import { numberTransformScale } from '../../utils/utils_scale';

const AREA_ATTRIBUTE_REGEX = /^\$A\.[\w.]+$/;
const GRADIENT_REGEX = /^gradient\((.*)\)$/;
const LINEAR_REGEX = /^linear\((.*)\)$/;
const DEFAULT_AREA_INPUT_RANGE: [number, number] = [0, 150];
const DEFAULT_AREA_NUMBER_RANGE: [number, number] = [0, 30];

type OutputKind = 'color' | 'number';

const splitArguments = (params: string) => {
  const args: string[] = [];
  let balance = 0;
  let start = 0;

  for (let i = 0; i < params.length; i++) {
    const char = params[i];
    if (char === '[') balance++;
    if (char === ']') balance--;
    if (char === ',' && balance === 0) {
      args.push(params.slice(start, i).trim());
      start = i + 1;
    }
  }

  args.push(params.slice(start).trim());
  return args;
};

const getByPath = (source: unknown, path: string) => {
  if (!source) return undefined;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, source);
};

const toFiniteNumber = (value: unknown, context: string) => {
  const numericValue =
    typeof value === 'number' ? value : Number(value as string | number);
  if (!Number.isFinite(numericValue)) {
    throw new Error(`${context} must resolve to a finite number.`);
  }
  return numericValue;
};

const parseStaticNumber = (value: string) => {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const ensureOutputKind = (
  actual: OutputKind,
  expected: OutputKind | undefined,
  expression: string
) => {
  if (expected && actual !== expected) {
    throw new Error(
      `Expression "${expression}" resolves to ${actual}, but ${expected} was expected.`
    );
  }
};

const parseAreaAttribute = (str: string) => {
  const trimmed = str.trim();
  if (!trimmed.match(AREA_ATTRIBUTE_REGEX)) {
    throw new Error(`Invalid area attribute expression: ${str}`);
  }

  const path = trimmed.substring(3);
  return (feature: AreaFeature) => getByPath(feature.properties, path);
};

const buildColorInterpolator = (colors: string[]) =>
  d3.interpolateRgbBasis(colors);

const parseGradientExpression = (
  str: string,
  expectedOutputKind?: OutputKind
) => {
  const match = str.trim().match(GRADIENT_REGEX);
  if (!match) return null;

  const args = splitArguments(match[1]);
  if (args.length !== 2 && args.length !== 3) {
    throw new Error(`Invalid gradient expression: ${str}`);
  }

  const attributeFunc = parseAreaAttribute(args[0]);

  if (args.length === 2) {
    const valueList = extractList(args[1]);
    ensureOutputKind(valueList.type, expectedOutputKind, str);

    if (valueList.type === 'color') {
      const scale = d3
        .scaleLinear()
        .domain(DEFAULT_AREA_INPUT_RANGE)
        .range([0, 1])
        .clamp(true);
      const colorInterpolator = buildColorInterpolator(valueList.values);
      return (feature: AreaFeature) =>
        d3.rgb(
          colorInterpolator(
            scale(toFiniteNumber(attributeFunc(feature), args[0]))
          )
        );
    }

    return (feature: AreaFeature) =>
      numberTransformScale(
        toFiniteNumber(attributeFunc(feature), args[0]),
        DEFAULT_AREA_INPUT_RANGE,
        valueList.values
      );
  }

  const domainList = extractList(args[1]);
  const valueList = extractList(args[2]);
  if (domainList.type !== 'number') {
    throw new Error(`Gradient domain must be numeric: ${args[1]}`);
  }

  ensureOutputKind(valueList.type, expectedOutputKind, str);

  if (valueList.type === 'color') {
    const scale = d3
      .scaleLinear()
      .domain(domainList.values)
      .range([0, 1])
      .clamp(true);
    const colorInterpolator = buildColorInterpolator(valueList.values);
    return (feature: AreaFeature) =>
      d3.rgb(
        colorInterpolator(
          scale(toFiniteNumber(attributeFunc(feature), args[0]))
        )
      );
  }

  return (feature: AreaFeature) =>
    numberTransformScale(
      toFiniteNumber(attributeFunc(feature), args[0]),
      domainList.values,
      valueList.values
    );
};

const parseLinearExpression = (
  str: string,
  expectedOutputKind?: OutputKind
) => {
  const match = str.trim().match(LINEAR_REGEX);
  if (!match) return null;

  const args = splitArguments(match[1]);
  if (args.length !== 2 && args.length !== 3) {
    throw new Error(`Invalid linear expression: ${str}`);
  }

  const attributeFunc = parseAreaAttribute(args[0]);

  if (args.length === 2) {
    const valueList = extractList(args[1]);
    ensureOutputKind(valueList.type, expectedOutputKind, str);

    if (valueList.type === 'color') {
      const scale = d3
        .scaleLinear()
        .domain(DEFAULT_AREA_INPUT_RANGE)
        .range([0, 1])
        .clamp(true);
      const colorInterpolator = buildColorInterpolator(valueList.values);
      return (feature: AreaFeature) =>
        d3.rgb(
          colorInterpolator(
            scale(toFiniteNumber(attributeFunc(feature), args[0]))
          )
        );
    }

    return (feature: AreaFeature) =>
      numberTransformScale(
        toFiniteNumber(attributeFunc(feature), args[0]),
        DEFAULT_AREA_NUMBER_RANGE,
        valueList.values
      );
  }

  const domainList = extractList(args[1]);
  const valueList = extractList(args[2]);
  if (domainList.type !== 'number') {
    throw new Error(`Linear domain must be numeric: ${args[1]}`);
  }

  ensureOutputKind(valueList.type, expectedOutputKind, str);

  if (valueList.type === 'color') {
    const scale = d3
      .scaleLinear()
      .domain(domainList.values)
      .range([0, 1])
      .clamp(true);
    const colorInterpolator = buildColorInterpolator(valueList.values);
    return (feature: AreaFeature) =>
      d3.rgb(
        colorInterpolator(
          scale(toFiniteNumber(attributeFunc(feature), args[0]))
        )
      );
  }

  return (feature: AreaFeature) =>
    numberTransformScale(
      toFiniteNumber(attributeFunc(feature), args[0]),
      domainList.values,
      valueList.values
    );
};

export const parseAreaColorString = (str: string) => {
  const staticColor = parseColor(str);
  if (staticColor) {
    return { type: 'static' as const, value: staticColor };
  }

  const gradientValue = parseGradientExpression(str, 'color');
  if (gradientValue) {
    return { type: 'gradient' as const, value: gradientValue };
  }

  const linearValue = parseLinearExpression(str, 'color');
  if (linearValue) {
    return { type: 'linear' as const, value: linearValue };
  }

  throw new Error(`Invalid area color style expression: ${str}`);
};

export const parseAreaNumberString = (
  value: string | number
): { type: 'static' | 'gradient' | 'linear'; value: AreaNumericFunction } => {
  if (typeof value === 'number') {
    return { type: 'static', value };
  }

  const staticNumber = parseStaticNumber(value);
  if (staticNumber !== null) {
    return { type: 'static', value: staticNumber };
  }

  const gradientValue = parseGradientExpression(value, 'number');
  if (gradientValue) {
    return { type: 'gradient', value: gradientValue as AreaNumericFunction };
  }

  const linearValue = parseLinearExpression(value, 'number');
  if (linearValue) {
    return { type: 'linear', value: linearValue as AreaNumericFunction };
  }

  throw new Error(`Invalid area numeric style expression: ${value}`);
};

export const createAreaEncodingStyleMapping = (
  settings: EncodingSettings
): AreaStyleMappingFunction => ({
  color: parseAreaColorString(settings.styles.color || '#2a6f97'),
  opacity: parseAreaNumberString(settings.styles.opacity || 0.6),
  width: parseAreaNumberString(settings.styles.width || 1)
});
