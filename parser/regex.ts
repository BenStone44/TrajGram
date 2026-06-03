/**
 * Style expression parser for TrajGram.
 *
 * This module turns JSON style strings into runtime mapping functions.
 *
 * Supported forms:
 *
 * Static values
 * - "#d9dff1"
 * - "red"
 * - 3
 * - 0.8
 *
 * Point-based gradient expressions
 * - "gradient($P.speed, [#b35a00, #d6d632])"
 * - "gradient($P.speed, [30, 50], [#b35a00, #d6d632])"
 * - "gradient($P.speed, [0, 10, 20], [2, 6, 12])"
 *
 * Trajectory-based linear expressions
 * - "linear(speed($T), [#2c7bb6, #ffffbf, #d7191c])"
 * - "linear(speed($T), [0, 5, 12], [0, 35, 40])"
 * - "linear(distance($T), [0, 5, 10], [2, 6, 10])"
 *
 * Attribute sources:
 * - $P.xxx reads from point.attributes.others.xxx
 * - $T.xxx reads from trajectory.attributes.xxx
 * - speed($T), distance($T), time($T) are built-in trajectory functions
 */
import Color from 'color';
import * as d3 from 'd3';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import { speed, time } from '../utils/utils_calculation';
import { numberTransformScale } from '../utils/utils_scale';

export type PointColorAccessor = (point: Trajectorypoint) => d3.RGBColor;
export type TrajectoryColorAccessor = (
  trajectory: Trajectory
) => d3.RGBColor;
export type PointNumericAccessor = (point: Trajectorypoint) => number;
export type TrajectoryNumericAccessor = (trajectory: Trajectory) => number;
export type TextAccessor = (
  point: Trajectorypoint,
  trajectory: Trajectory
) => string;

export type ParsedColorMapping =
  | { type: 'static'; value: string }
  | { type: 'gradient'; value: PointColorAccessor }
  | { type: 'linear'; value: TrajectoryColorAccessor };

export type ParsedNumericMapping =
  | { type: 'static'; value: number }
  | { type: 'gradient'; value: PointNumericAccessor }
  | { type: 'linear'; value: TrajectoryNumericAccessor };

type ParsedList =
  | { type: 'color'; values: string[] }
  | { type: 'number'; values: number[] };

type OutputKind = 'color' | 'number';
type GradientMappingFunction = PointColorAccessor | PointNumericAccessor;
type LinearMappingFunction =
  | TrajectoryColorAccessor
  | TrajectoryNumericAccessor;

const HEX_COLOR_REGEX = /#([a-fA-F0-9]{6})$/;
const NAMED_COLOR_REGEX = /^[A-Za-z]+$/;
const NUMERIC_LITERAL_REGEX = /^-?\d+(\.\d+)?$/;
const GRADIENT_REGEX = /^gradient\((.*)\)$/;
const LINEAR_REGEX = /^linear\((.*)\)$/;
const POINT_ATTRIBUTE_REGEX = /^\$P\.[\w.]+$/;
const TRAJECTORY_ATTRIBUTE_REGEX = /^\$T\.[\w.]+$/;
const MAGIC_TRAJECTORY_FUNCTION_REGEX = /^[a-zA-Z_]\w*\(\$T\)$/;
const LIST_REGEX = /^\[[^\]]*\]$/;

const DEFAULT_POINT_INPUT_RANGE: [number, number] = [0, 30];
const DEFAULT_TRAJECTORY_COLOR_RANGE: [number, number] = [0, 150];
const DEFAULT_TRAJECTORY_NUMBER_RANGE: [number, number] = [0, 30];

const TRAJECTORY_MAGIC_ACCESSORS: Record<
  string,
  (trajectory: Trajectory) => number
> = {
  'speed($T)': (trajectory) => speed(trajectory),
  'distance($T)': (trajectory) => trajectory.distance,
  'time($T)': (trajectory) => time(trajectory)
};

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

const formatTextValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '';
    }
    return String(Math.round(value * 1000) / 1000);
  }
  return String(value);
};

const resolvePointAttribute = (point: Trajectorypoint, path: string): unknown => {
  const trimmedPath = path.trim();

  if (trimmedPath === 'id') return point.id;
  if (trimmedPath === 'time') return point.basePoint.time;
  if (trimmedPath === 'lng') return point.basePoint.position.lng;
  if (trimmedPath === 'lat') return point.basePoint.position.lat;

  if (trimmedPath.startsWith('basePoint.')) {
    return getByPath(point.basePoint, trimmedPath.substring('basePoint.'.length));
  }
  if (trimmedPath.startsWith('position.')) {
    return getByPath(
      point.basePoint.position,
      trimmedPath.substring('position.'.length)
    );
  }
  if (trimmedPath.startsWith('source.')) {
    return getByPath(
      point.attributes.source,
      trimmedPath.substring('source.'.length)
    );
  }
  if (trimmedPath.startsWith('computed.')) {
    return getByPath(
      point.attributes.computed,
      trimmedPath.substring('computed.'.length)
    );
  }
  if (trimmedPath.startsWith('others.')) {
    return getByPath(
      point.attributes.others,
      trimmedPath.substring('others.'.length)
    );
  }

  return (
    getByPath(point.attributes.others, trimmedPath) ??
    getByPath(point.attributes.computed, trimmedPath) ??
    getByPath(point.attributes.source, trimmedPath) ??
    getByPath(point.basePoint, trimmedPath)
  );
};

const resolveTrajectoryAttribute = (
  trajectory: Trajectory,
  path: string
): unknown => {
  const trimmedPath = path.trim();

  if (trimmedPath === 'id') return trajectory.id;
  if (trimmedPath === 'starttime') return trajectory.starttime;
  if (trimmedPath === 'endtime') return trajectory.endtime;
  if (trimmedPath === 'distance') return trajectory.distance;

  if (trimmedPath.startsWith('attributes.')) {
    return getByPath(
      trajectory.attributes,
      trimmedPath.substring('attributes.'.length)
    );
  }

  return (
    getByPath(trajectory.attributes, trimmedPath) ??
    getByPath(trajectory, trimmedPath)
  );
};

const toFiniteNumber = (value: unknown, context: string) => {
  const numericValue =
    typeof value === 'number' ? value : Number(value as string | number);
  if (!Number.isFinite(numericValue)) {
    throw new Error(`${context} must resolve to a finite number.`);
  }
  return numericValue;
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

export const extractList = (str: string): ParsedList => {
  const trimmed = str.trim();
  if (!trimmed.match(LIST_REGEX)) {
    throw new Error(`Invalid list literal: ${str}`);
  }

  const values = trimmed.substring(1, trimmed.length - 1).split(',');
  const parsedColors = values.map((value) => parseColor(value.trim()));
  if (parsedColors.every((value) => typeof value === 'string')) {
    return { type: 'color', values: parsedColors as string[] };
  }

  const parsedNumbers = values.map((value) => Number(value.trim()));
  if (parsedNumbers.every((value) => Number.isFinite(value))) {
    return { type: 'number', values: parsedNumbers };
  }

  throw new Error(`Invalid list literal: ${str}`);
};

export const parseTAttribute = (str: string) => {
  const trimmed = str.trim();
  if (trimmed in TRAJECTORY_MAGIC_ACCESSORS) {
    return TRAJECTORY_MAGIC_ACCESSORS[trimmed];
  }

  if (trimmed.match(TRAJECTORY_ATTRIBUTE_REGEX)) {
    const path = trimmed.substring(3);
    return (trajectory: Trajectory) =>
      resolveTrajectoryAttribute(trajectory, path);
  }

  if (trimmed.match(MAGIC_TRAJECTORY_FUNCTION_REGEX)) {
    throw new Error(`Unsupported trajectory function: ${trimmed}`);
  }

  throw new Error(`Invalid trajectory attribute expression: ${str}`);
};

export const parsePAttribute = (str: string) => {
  const trimmed = str.trim();
  if (!trimmed.match(POINT_ATTRIBUTE_REGEX)) {
    throw new Error(`Invalid point attribute expression: ${str}`);
  }

  const path = trimmed.substring(3);
  return (point: Trajectorypoint) => resolvePointAttribute(point, path);
};

export const parseAttributeEither = (str: string) => {
  const trimmed = str.trim();
  if (
    trimmed.match(MAGIC_TRAJECTORY_FUNCTION_REGEX) ||
    trimmed.match(TRAJECTORY_ATTRIBUTE_REGEX)
  ) {
    return { type: 't', value: parseTAttribute(trimmed) };
  }

  if (trimmed.match(POINT_ATTRIBUTE_REGEX)) {
    return { type: 'p', value: parsePAttribute(trimmed) };
  }

  return { type: 's', value: str };
};

export const parseTextString = (
  value: string
): { type: 'static'; value: string } | { type: 'dynamic'; value: TextAccessor } => {
  const templateRegex = /\{\{(.*?)\}\}/g;
  const matches = [...value.matchAll(templateRegex)];

  if (matches.length > 0) {
    const parsedSegments = matches.map((match) => ({
      token: match[0],
      parsed: parseAttributeEither(match[1].trim())
    }));

    return {
      type: 'dynamic',
      value: (point, trajectory) => {
        let output = value;
        parsedSegments.forEach((segment) => {
          const replacement =
            segment.parsed.type === 'p'
              ? formatTextValue(segment.parsed.value(point))
              : segment.parsed.type === 't'
              ? formatTextValue(segment.parsed.value(trajectory))
              : formatTextValue(segment.parsed.value);
          output = output.replace(segment.token, replacement);
        });
        return output;
      }
    };
  }

  const parsed = parseAttributeEither(value.trim());
  if (parsed.type === 'p') {
    return {
      type: 'dynamic',
      value: (point) => formatTextValue(parsed.value(point))
    };
  }
  if (parsed.type === 't') {
    return {
      type: 'dynamic',
      value: (_, trajectory) => formatTextValue(parsed.value(trajectory))
    };
  }

  return { type: 'static', value };
};

export const parseColor = (str: string) => {
  const trimmed = str.trim();
  if (trimmed.match(HEX_COLOR_REGEX)) {
    return trimmed;
  }

  if (!trimmed.match(NAMED_COLOR_REGEX)) {
    return null;
  }

  try {
    return Color(trimmed).hex();
  } catch {
    return null;
  }
};

const parseStaticNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.match(NUMERIC_LITERAL_REGEX)) {
    return null;
  }

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const buildColorInterpolator = (colors: string[]) =>
  d3.interpolateRgbBasis(colors);

const parseGradientExpression = (
  str: string,
  expectedOutputKind?: OutputKind
): GradientMappingFunction | null => {
  const match = str.trim().match(GRADIENT_REGEX);
  if (!match) return null;

  const args = splitArguments(match[1]);
  if (args.length !== 2 && args.length !== 3) {
    throw new Error(`Invalid gradient expression: ${str}`);
  }

  const attributeFunc = parsePAttribute(args[0]);

  if (args.length === 2) {
    const valueList = extractList(args[1]);
    ensureOutputKind(valueList.type, expectedOutputKind, str);

    if (valueList.type === 'color') {
      const scale = d3
        .scaleLinear()
        .domain(DEFAULT_POINT_INPUT_RANGE)
        .range([0, 1])
        .clamp(true);
      const colorInterpolator = buildColorInterpolator(valueList.values);
      return (point: Trajectorypoint) =>
        d3.rgb(
          colorInterpolator(scale(toFiniteNumber(attributeFunc(point), args[0])))
        );
    }

    return (point: Trajectorypoint) =>
      numberTransformScale(
        toFiniteNumber(attributeFunc(point), args[0]),
        DEFAULT_POINT_INPUT_RANGE,
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
    return (point: Trajectorypoint) =>
      d3.rgb(
        colorInterpolator(scale(toFiniteNumber(attributeFunc(point), args[0])))
      );
  }

  return (point: Trajectorypoint) =>
    numberTransformScale(
      toFiniteNumber(attributeFunc(point), args[0]),
      domainList.values,
      valueList.values
    );
};

const parseLinearExpression = (
  str: string,
  expectedOutputKind?: OutputKind
): LinearMappingFunction | null => {
  const match = str.trim().match(LINEAR_REGEX);
  if (!match) return null;

  const args = splitArguments(match[1]);
  if (args.length !== 2 && args.length !== 3) {
    throw new Error(`Invalid linear expression: ${str}`);
  }

  const attributeFunc = parseTAttribute(args[0]);

  if (args.length === 2) {
    const valueList = extractList(args[1]);
    ensureOutputKind(valueList.type, expectedOutputKind, str);

    if (valueList.type === 'color') {
      const scale = d3
        .scaleLinear()
        .domain(DEFAULT_TRAJECTORY_COLOR_RANGE)
        .range([0, 1])
        .clamp(true);
      const colorInterpolator = buildColorInterpolator(valueList.values);
      return (trajectory: Trajectory) =>
        d3.rgb(
          colorInterpolator(
            scale(toFiniteNumber(attributeFunc(trajectory), args[0]))
          )
        );
    }

    return (trajectory: Trajectory) =>
      numberTransformScale(
        toFiniteNumber(attributeFunc(trajectory), args[0]),
        DEFAULT_TRAJECTORY_NUMBER_RANGE,
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
    return (trajectory: Trajectory) =>
      d3.rgb(
        colorInterpolator(
          scale(toFiniteNumber(attributeFunc(trajectory), args[0]))
        )
      );
  }

  return (trajectory: Trajectory) =>
    numberTransformScale(
      toFiniteNumber(attributeFunc(trajectory), args[0]),
      domainList.values,
      valueList.values
    );
};

export const parseGradientParameters = (str: string) =>
  parseGradientExpression(str);

export const parseLinearParameters = (str: string) =>
  parseLinearExpression(str);

/**
 * Parse a color style string.
 *
 * Examples:
 * - "#333333"
 * - "red"
 * - "gradient($P.speed, [#b35a00, #d6d632])"
 * - "linear(speed($T), [#2c7bb6, #ffffbf, #d7191c])"
 */
export const parseColorString = (str: string): ParsedColorMapping => {
  const staticColor = parseColor(str);
  if (staticColor) {
    return { type: 'static', value: staticColor };
  }

  const gradientValue = parseGradientExpression(str, 'color');
  if (gradientValue) {
    return { type: 'gradient', value: gradientValue as PointColorAccessor };
  }

  const linearValue = parseLinearExpression(str, 'color');
  if (linearValue) {
    return { type: 'linear', value: linearValue as TrajectoryColorAccessor };
  }

  throw new Error(`Invalid color style expression: ${str}`);
};

/**
 * Parse a numeric style value.
 *
 * Examples:
 * - 5
 * - 0.8
 * - "gradient($P.speed, [2, 6, 12])"
 * - "linear(distance($T), [0, 5, 10], [2, 6, 10])"
 */
export const parseNumberString = (
  value: string | number
): ParsedNumericMapping => {
  if (typeof value === 'number') {
    return { type: 'static', value };
  }

  const staticNumber = parseStaticNumber(value);
  if (staticNumber !== null) {
    return { type: 'static', value: staticNumber };
  }

  const gradientValue = parseGradientExpression(value, 'number');
  if (gradientValue) {
    return { type: 'gradient', value: gradientValue as PointNumericAccessor };
  }

  const linearValue = parseLinearExpression(value, 'number');
  if (linearValue) {
    return { type: 'linear', value: linearValue as TrajectoryNumericAccessor };
  }

  throw new Error(`Invalid numeric style expression: ${value}`);
};
