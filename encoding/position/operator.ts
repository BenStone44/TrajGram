import type { PositioningParseResult } from './types';

export const parsePositionExpression = (
  expression: string
): PositioningParseResult | null => {
  const normalizedExpression = expression.replace(/\s+/g, '');
  const patterns = {
    index: /^\$T\.(distance|time)\[((?:\d*\.?\d+,?)+)\]$/,
    count: /^\$T\.(distance|time)\(([0-9]+)\)$/,
    variable: /^\$T\.(distance|time)\(\$([a-zA-Z][a-zA-Z0-9]*)\)$/
  };

  let match = normalizedExpression.match(patterns.index);
  if (match) {
    const [, method, valueStr] = match;
    const numbers = valueStr.split(',').map(Number);
    const isValid = numbers.every((value) => !Number.isNaN(value) && value >= 0 && value <= 1);
    if (!isValid) {
      throw new Error(
        `Invalid values in expression: ${expression}. All values must be between 0 and 1.`
      );
    }

    if (numbers.length === 1 && (numbers[0] === 0 || numbers[0] === 1)) {
      return { method, type: 'index', values: numbers };
    }

    return { method, type: 'ratio', values: numbers };
  }

  match = normalizedExpression.match(patterns.count);
  if (match) {
    const [, method, count] = match;
    const numberCount = Number(count);
    if (numberCount <= 0) {
      throw new Error(`Invalid count in expression: ${expression}. Count must be greater than 0.`);
    }
    return {
      method,
      type: 'count',
      values:
        numberCount === 1
          ? [0.5]
          : Array.from({ length: numberCount }, (_, index) => index / (numberCount - 1))
    };
  }

  match = normalizedExpression.match(patterns.variable);
  if (match) {
    const [, method, variableName] = match;
    return { method, type: 'count', values: variableName };
  }

  return null;
};
