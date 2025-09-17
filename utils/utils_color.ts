import * as d3 from 'd3';
import { numberTransformScale } from './utils_scale';
import { parseColor } from '../parseString/regex';

export type colorArray = [number, number, number, number];
export type RGB = { r: number; g: number; b: number };
type RGBA = { r: number; g: number; b: number; a: number };
type HexOpacity = { hex: d3.RGBColor; opacity: number };
export type ColorInput = string | RGB | RGBA | colorArray | Uint8Array | HexOpacity;

export class ColorConverter {
  private r = 0;
  private g = 0;
  private b = 0;
  private a = 1;

  constructor(input: ColorInput) {
    if (this.isHexOpacity(input)) {
      this.parseD3RGB(input.hex);
      this.a = input.opacity;
    } else if (typeof input === 'string') {
      this.parseHexString(parseColor(input) as string);
    } else if (Array.isArray(input) || input instanceof Uint8Array) {
      this.parseArray(input);
    } else {
      this.parseObject(input);
    }
  }

  private parseD3RGB(color: d3.RGBColor) {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
  }

  private isHexOpacity(object: any): object is HexOpacity {
    return (
      typeof object === 'object' &&
      object !== null &&
      'hex' in object &&
      typeof object.hex === 'string' &&
      'opacity' in object &&
      typeof object.opacity === 'number'
    );
  }

  private parseHexString(hex: string): void {
    // Remove the hash at the beginning of the hex string if present
    const cleanHex = hex.replace(/^#/, '');
    // Parse the hex string according to its length
    switch (cleanHex.length) {
      case 3:
        this.r = parseInt(cleanHex.charAt(0).repeat(2), 16);
        this.g = parseInt(cleanHex.charAt(1).repeat(2), 16);
        this.b = parseInt(cleanHex.charAt(2).repeat(2), 16);
        this.a = 1;
        break;
      case 6:
        this.r = parseInt(cleanHex.substring(0, 2), 16);
        this.g = parseInt(cleanHex.substring(2, 4), 16);
        this.b = parseInt(cleanHex.substring(4, 6), 16);
        this.a = 1;
        break;
      case 8:
        this.r = parseInt(cleanHex.substring(0, 2), 16);
        this.g = parseInt(cleanHex.substring(2, 4), 16);
        this.b = parseInt(cleanHex.substring(4, 6), 16);
        this.a = parseInt(cleanHex.substring(6, 8), 16) / 255;
        break;
      default:
        throw new Error('Invalid hex color format');
    }
  }

  static generateUniqueColorForId(
    id: string
  ): [number, number, number, number] {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    // 将哈希值转换为颜色的 RGB
    let r: number, g: number, b: number;
    r = (hash & 0xff0000) >> 16;
    g = (hash & 0x00ff00) >> 8;
    b = hash & 0x0000ff;

    // 转换为 0 到 1 之间的浮点数
    r /= 255;
    g /= 255;
    b /= 255;

    // Alpha 值设置为 1
    const a = 1;

    return [r, g, b, a];
  }
  //"red"转换为rgb数组
  static nameToRGBArray(
    colorname: string,
    opacity: number
  ): [number, number, number, number] {
    const color = d3.color(colorname) as d3.RGBColor;
    if (color) {
      return [color.r / 255, color.g / 255, color.b / 255, opacity];
    } else {
      return [0, 0, 0, 0];
    }
  }
  //width转换，数据加速度而且坐标进行转换
  static generatePointColorInRangeWithSpeed(
    attribute: number,
    colorRange: string[] | string,
    opacity: number[] | number
  ): [number, number, number, number] {
    const transformOpacity: number =
      typeof opacity === 'number'
        ? opacity
        : numberTransformScale(attribute, [0, 30], opacity);

    if (typeof colorRange === 'string') {
      if (colorRange.includes('#')) {
        const instance = new ColorConverter(colorRange || '#000000').Array();
        instance[3] = transformOpacity;
        return instance;
      } else {
        const nameToarray: [number, number, number, number] =
          this.nameToRGBArray(colorRange, transformOpacity);
        return nameToarray;
      }
    } else {
      const colorInterpolator = d3.interpolateRgbBasis(colorRange);
      const color: d3.RGBColor = d3.rgb(colorInterpolator(attribute / 20));
      const pointColor: [number, number, number, number] = [
        color.r / 255,
        color.g / 255,
        color.b / 255,
        transformOpacity
      ];
      return pointColor;
    }
  }

 
  private parseArray(arr: number[] | Uint8Array): void {
    if (arr.length !== 3 && arr.length !== 4) {
      throw new Error('Array must have three or four elements');
    }

    const isIntegerArray = arr.every((num) => Number.isInteger(num));

    if (isIntegerArray) {
      // 数组格式为 [255, 255, 255, 255]
      this.r = arr[0];
      this.g = arr[1];
      this.b = arr[2];
      this.a = arr.length === 4 ? arr[3] / 255 : 1; // 标准化 alpha 值
    } else {
      // 数组格式为 [0.2, 0.2, 0.2, 0.3]
      this.r = Math.round(arr[0] * 255);
      this.g = Math.round(arr[1] * 255);
      this.b = Math.round(arr[2] * 255);
      this.a = arr.length === 4 ? arr[3] : 1; // 如果未提供 alpha 值，默认为 1
    }
  }

  private parseObject(obj: RGB | RGBA): void {
    this.r = obj.r;
    this.g = obj.g;
    this.b = obj.b;
    this.a = 'a' in obj ? obj.a : 1;
  }

  public Hex(): string {
    const rHex = this.r.toString(16).padStart(2, '0');
    const gHex = this.g.toString(16).padStart(2, '0');
    const bHex = this.b.toString(16).padStart(2, '0');
    return `#${rHex}${gHex}${bHex}`; //"#ffffff"
  }

  public RGBA(): RGBA {
    return { r: this.r, g: this.g, b: this.b, a: this.a };
  }

  public NormArray(): colorArray {
    return [this.r, this.g, this.b, this.a];
  }

  public Array(): colorArray {
    return [this.r / 255, this.g / 255, this.b / 255, 1];
  }
}
