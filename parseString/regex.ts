import Color from 'color';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import { speed, time } from '../utils/utils_calculation';

import * as d3 from 'd3';
import { numberTransformScale } from '../utils/utils_scale';

// #ada123
// #ADA123
const color16 = /#([a-fA-F0-9]{6})$/;
const colorname = /^[A-Za-z]+$/;
const gradientRegex = /^gradient\((.*)\)$/;
const linearRegex = /^linear\((.*)\)$/;

// 匹配 $P.something 格式
const PRegex = /^\$P\.[\w.]+/;
// 匹配 $T.something 格式
const TRegex = /^\$T\.[\w.]+/;

// speed($T) distance($P)
const magicRegex = /([a-zA-Z_]\w*)\(\$T\)/;

const listRegex = /\[([^\]]*)\]/;

export const extractList = (str: string) => {
  if (str.match(listRegex)) {
    const vs = str.substring(1, str.length - 1).split(',');

    const tryColor = vs.map((v) => parseColor(v.trim()));
    if (tryColor.every((v) => typeof v == 'string'))
      return { type: 'color', values: tryColor as string[] };

    const tryNumber = vs.map((v) => parseFloat(v));
    if (tryNumber.every((v) => typeof v == 'number'))
      return { type: 'number', values: tryNumber };
  }

  throw new Error('not a valid list!');
};


export const parseTAttribute = (str: string) => {
  if (str.match(magicRegex)) {
    if (str === 'speed($T)') return (T: Trajectory) => speed(T);
    else if (str === 'distance($T)') return (T: Trajectory) => T.distance;
    else if (str === 'time($T)') return (T: Trajectory) => time(T);
    else throw new Error('magic function not yet suported!');
  } else if (str.match(TRegex)) {
    const key = str.substring(3);

    return (T: Trajectory) => {
      if (T) {
        return T.attributes ? T.attributes[key] : undefined;
      } else throw new Error('NOT T');
    };
  } else throw new Error('attribute not valid!');
};



export const parsePAttribute = (str: string) => {
  if (str.match(PRegex)) {
    const key = str.substring(3);
    return (P: Trajectorypoint) =>
      P.attributes.others ? P.attributes.others[key] : undefined;
  } else throw new Error('attribute not valid!');
};

export const parseAttributeEither = (str: string) => {
  if (str.match(magicRegex) || str.match(TRegex)) {
    return { type: 't', value: parseTAttribute(str) };
  } else if (str.match(PRegex)) {
    return { type: 'p', value: parsePAttribute(str) };
  } else return { type: 's', value: str };
};

export const parseColor = (str: string) => {
  if (str.match(colorname)) {
    const color = Color(str);
    return color.hex();
  } else if (str.match(color16)) {
    return str;
  } else return null;
};

export const parseGradientParameters = (str: string) => {

  const match = str.match(gradientRegex);

  if (match) {
    // 获取参数部分
    const params = match[1];
    // 分割参数，考虑到括号内的逗号
    const args = [];
    let balance = 0; // 用来跟踪括号平衡
    let start = 0;

    for (let i = 0; i < params.length; i++) {
      const char = params[i];
      if (char === '[') balance++;
      if (char === ']') balance--;
      // 如果找到逗号且当前不在括号内，则分割
      if (char === ',' && balance === 0) {
        args.push(params.slice(start, i).trim());
        start = i + 1;
      }
    }
    // 添加最后一个参数
    args.push(params.slice(start).trim());

    if (args.length == 2) {
      // "gradient($P.speed, [#b35a00, #d6d632])"
      // $P.speed, [#b35a00, #d6d632]

      const attributeFunc = parsePAttribute(args[0]);
      const valuelist = extractList(args[1]);
      const scale = d3.scaleLinear().domain([0, 30]).range([0, 1]);
      if (valuelist.type == 'color') {
        return (P: Trajectorypoint) => {
          const colorInterpolator = d3.interpolateRgbBasis(
            valuelist.values as string[]
          );
          return d3.rgb(colorInterpolator(scale(attributeFunc(P) as number)));
        };
      } else {
        return (P: Trajectorypoint) =>
          numberTransformScale(
            attributeFunc(P) as number,
            [0, 30],
            valuelist.values as number[]
          );
      }
    } else if (args.length == 3) {
      // "gradient($P.speed, [0, 30], [#b35a00, #d6d632])"
      const attributeFunc = parsePAttribute(args[0]);
      const indexlist = extractList(args[1]);
      const valuelist = extractList(args[2]);
      const scale = d3
        .scaleLinear()
        .domain(indexlist.values as number[])
        .range([0, 1]);
      if (indexlist.type == 'number') {
        if (valuelist.type == 'color') {
          return (P: Trajectorypoint) => {
            const colorInterpolator = d3.interpolateRgbBasis(
              valuelist.values as string[]
            );

            return d3.rgb(colorInterpolator(scale(attributeFunc(P) as number)));
          };
        } else {
          return (P: Trajectorypoint) =>
            numberTransformScale(
              attributeFunc(P) as number,
              indexlist.values as number[],
              valuelist.values as number[]
            );
        }
      }
    }

    return null;
  } else {
    return null;
  }
};

export const parseLinearParameters = (str: string) => {

  const match = str.match(linearRegex);

  const minValue = 0;
  const maxValue = 150;
  if (match) {
    // 获取参数部分
    const params = match[1];
    // 分割参数，考虑到括号内的逗号
    const args = [];
    let balance = 0; // 用来跟踪括号平衡
    let start = 0;

    for (let i = 0; i < params.length; i++) {
      const char = params[i];
      if (char === '[') balance++;
      if (char === ']') balance--;
      // 如果找到逗号且当前不在括号内，则分割
      if (char === ',' && balance === 0) {
        args.push(params.slice(start, i).trim());
        start = i + 1;
      }
    }
    // 添加最后一个参数
    args.push(params.slice(start).trim());
    const attributeFunc = parseTAttribute(args[0]);
    if (args.length == 2) {
      // "linear(speed($T), [#b35a00, #d6d632])"
      // speed($T), [#b35a00, #d6d632]

      const valuelist = extractList(args[1]);
      if (valuelist.type == 'color') {


        return (T: Trajectory) => {

          const colorInterpolator = d3.interpolateRgbBasis(
            valuelist.values as string[]
          );
          const attributeValue = attributeFunc(T) as number;
          const normalizedValue =
            (attributeValue - minValue) / (maxValue - minValue);
          return d3.rgb(colorInterpolator(normalizedValue));
        };
      } else {
        return (T: Trajectory) => {
          return numberTransformScale(
            attributeFunc(T) as number,
            [0, 30],
            valuelist.values as number[]
          );
        };
      }
    } else if (args.length == 3) {

      const indexlist = extractList(args[1]);
      const valuelist = extractList(args[2]);
      const scale = d3
        .scaleLinear()
        .domain(indexlist.values as number[])
        .range([0, 1]);
      if (indexlist.type == 'number') {
        if (valuelist.type == 'color') {
          return (T: Trajectory) => {
            const colorInterpolator = d3.interpolateRgbBasis(
              valuelist.values as string[]
            );

            return d3.rgb(colorInterpolator(scale(attributeFunc(T) as number)));
          };
        } else {
          return (T: Trajectory) =>
            numberTransformScale(
              attributeFunc(T) as number,
              indexlist.values as number[],
              valuelist.values as number[]
            );
        }
      }
    }

    return null;
  } else {
    return null; 
  }
};

export const parseColorString = (str: string): { type: string; value: any } => {
  const tryParseColor = parseColor(str);
  if (tryParseColor) return { type: 'static', value: tryParseColor };

  const tryParseGradientParameters = parseGradientParameters(str);
  if (tryParseGradientParameters)
    return { type: 'gradient', value: tryParseGradientParameters };

  const tryParseLinearParameters = parseLinearParameters(str);
  if (tryParseLinearParameters) {
    return { type: 'linear', value: tryParseLinearParameters };
  }
  return { type: 'static', value: '#333333' };
};

export const parseNumberString = (
  value: string | number
): { type: string; value: any } => {
  if (typeof value == 'number') {
    return { type: 'static', value: value };
  } else {
    const tryGradient = parseGradientParameters(value);
    if (tryGradient) return { type: 'gradient', value: tryGradient };

    const tryLinear = parseLinearParameters(value);

    if (tryLinear) return { type: 'linear', value: tryLinear };
  }
  return { type: 'static', value: value };
};
