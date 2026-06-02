import type { Trajectory } from '../interfaces/trajectory';
import { type TrajectoryGroup } from '../render-manager/trajectory-group';
import { Trajectoolkit } from '../Trajectoolkit';
import { Annotation } from './annotation';
import { createEncodingStyleMapping, createTrajectoryGroupProps, isEncodingStyleKey } from './style';
import type {
  ColorFunction,
  EncodingSettings,
  EncodingStyleKey,
  NumericFunction,
  StyleMappingFunction,
  StyleValue
} from './types';

export type {
  AnnotationSettings,
  AnnotationType,
  ColorFunction,
  EncodingSettings,
  NumericFunction,
  StyleMappingFunction
} from './types';

export class Encoding {
  public id: string;
  public setting: EncodingSettings;
  public data: () => Promise<Trajectory[]>;
  public trajectoryGroup: TrajectoryGroup | null = null;
  public annotations = new Map<string, Annotation>();
  public mappingFunction: StyleMappingFunction;
  public static type = 'encoding';
  public isHoverorClick = false;
  private cachedData: Trajectory[] = [];
  private core: Trajectoolkit;

  constructor(props: EncodingSettings, core: Trajectoolkit) {
    this.setting = props;
    this.core = core;
    this.id = props.id;
    this.data = () => this.core.getDQSDatabyID(this.setting.source) as Promise<Trajectory[]>;
    this.mappingFunction = createEncodingStyleMapping(props);
    this.core.getDQSbyID(this.setting.source)?.children.push(this);
    this.update();
  }

  public setStyleMappingFunction(
    type: EncodingStyleKey,
    func: StyleValue<ColorFunction | NumericFunction>
  ) {
    if (type === 'color') {
      this.mappingFunction.color = func as StyleValue<ColorFunction>;
    }
    if (type === 'width') {
      this.mappingFunction.width = func as StyleValue<NumericFunction>;
    }
    if (type === 'opacity') {
      this.mappingFunction.opacity = func as StyleValue<NumericFunction>;
    }
    this.draw();
  }

  private clearRenderedArtifacts() {
    this.core.trajectoryRendering.groups.delete(this.id);
    for (const annotation of this.annotations.values()) {
      annotation.clear();
    }
    this.annotations.clear();
    this.trajectoryGroup = null;
  }

  draw() {
    this.clearRenderedArtifacts();
    this.trajectoryGroup = this.core.addTrajectoryGroup(
      createTrajectoryGroupProps(this.setting, this.cachedData, this.mappingFunction)
    );

    for (const annotationId in this.setting.annotations) {
      const annotationSetting = this.setting.annotations[annotationId];
      const annotation = new Annotation(
        annotationId,
        annotationSetting,
        this.cachedData,
        this.core
      );
      this.annotations.set(annotationId, annotation);
    }
  }

  async update() {
    this.cachedData = await this.data();
    this.draw();
  }
}
