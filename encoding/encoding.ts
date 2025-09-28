import { Trajectoolkit } from '../Trajectoolkit';
import type { colorArray } from '../utils/utils_color';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import { TrajectoryGroup } from '../render-manager/trajectory-group';
import { Annotation, type AnnotationSettings } from './annotation';
import { parseTrajectoryStyle } from './parse';
import { parseColorString, parseNumberString } from '../parseString/regex';
import * as d3 from 'd3';

export interface EncodingSettings {
  id: string;
  type: string;
  source: string;
  styles: {
    color?: string;
    width?: string | number;
    opacity?: string | number;
  };
  zIndex?: number;
  maxzoom?: number;
  minzoom?: number;
  capstyle?: 'round' | 'square';
  annotations: { [key: string]: AnnotationSettings };
}

export type ColorFunction =
  | ((P: Trajectorypoint) => d3.RGBColor)
  | ((T: Trajectory) => d3.RGBColor)
  | colorArray;

export type NumricFunction =
  | ((P: Trajectorypoint) => number)
  | ((T: Trajectory) => number)
  | number;

export interface StyleMappingFunction {
  color: { type: string; value: ColorFunction };
  width: { type: string; value: NumricFunction };
  opacity: { type: string; value: NumricFunction };
}

export class Encoding {
  public id: string;
  public setting: EncodingSettings;
  public data!: () => Trajectory[];
  public trajectoryGroup!: TrajectoryGroup | Promise<TrajectoryGroup>;
  public annotations = new Map<string, Annotation>();
  public mappingFunction: StyleMappingFunction = {} as StyleMappingFunction;
  public static type = 'encoding';
  public isHoverorClick = false;
  private cached_data: Trajectory[] = [];
  private core: Trajectoolkit;
  constructor(props: EncodingSettings, core: Trajectoolkit) {
    this.setting = props;
    this.core = core;
    this.id = props.id;
    this.initial();
    this.update();
  }
  initial() {
    this.data = () =>
    this.core.getDQSDatabyID(this.setting.source) as any;
    this.core.getDQSbyID(this.setting.source)?.children.push(this);
    this.initialMappingFunction();
  }
  initialMappingFunction() {
    const styles = this.setting.styles;
    this.mappingFunction.color = parseColorString(styles.color || '#333333');
    this.mappingFunction.opacity = parseNumberString(styles.opacity || 1);
    this.mappingFunction.width = parseNumberString(styles.width || 5);
  }

  setStyleMappingFunction(type: string, func: { type: string; value: ColorFunction | NumricFunction}) {
    switch(type){
      case "color":
        this.mappingFunction.color = func as { type: string; value: ColorFunction}
        break
      case "width":
        this.mappingFunction.width = func as { type: string; value: NumricFunction}
        break
      case "opacity":
        this.mappingFunction.opacity = func as { type: string; value: NumricFunction}
        break      
    }
    this.draw()
  }


  draw() {
    this.trajectoryGroup = this.core.addTrajectoryGroup(
      parseTrajectoryStyle(this.setting, this.cached_data, this.mappingFunction)
    );
    for (const annotationId in this.setting.annotations) {
      const anntationsetting = this.setting.annotations[annotationId];

      const newAnnotation = new Annotation(
        annotationId,
        anntationsetting,
        this.cached_data,
        this.core
      );
      this.annotations.set(annotationId, newAnnotation);
    }
  }
  async update() {
    this.cached_data = await this.core.getDQSDatabyID(this.setting.source)
    this.draw()
  }
}
