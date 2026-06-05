import type { Feature, FeatureCollection } from 'geojson';
import type { GeoNetwork } from '../interfaces/network';
import type { Trajectory } from '../interfaces/trajectory';
import { AreaEncoding } from './area';
import { GraphEncoding, resolveGraphLayout, resolveGraphStyle } from './graph';
import { type TrajectoryGroup } from '../render/trajectory-group';
import { Trajectoolkit } from '../Trajectoolkit';
import { Annotation } from './annotation';
import {
  createEncodingStyleMapping,
  createTrajectoryGroupProps,
  isEncodingStyleKey
} from './style';
import { createAreaEncodingStyleMapping } from './area';
import type {
  AreaStyleMappingFunction,
  ColorFunction,
  EncodingSettings,
  GraphStyleSettings,
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
  public data: () => Promise<unknown>;
  public trajectoryGroup: TrajectoryGroup | null = null;
  public areaEncoding: AreaEncoding | null = null;
  public graphEncoding: GraphEncoding | null = null;
  public annotations = new Map<string, Annotation>();
  public mappingFunction: StyleMappingFunction | null = null;
  public areaMappingFunction: AreaStyleMappingFunction | null = null;
  public static type = 'encoding';
  public isHoverorClick = false;
  private cachedData: unknown = null;
  private core: Trajectoolkit;

  constructor(props: EncodingSettings, core: Trajectoolkit) {
    this.setting = props;
    this.core = core;
    this.id = props.id;
    this.data = () => this.core.getDQSDatabyID(this.setting.source);
    if (props.type === 'area') {
      this.areaMappingFunction = createAreaEncodingStyleMapping(props);
    } else if (props.type === 'trajectory' || props.type === 'trajectories') {
      this.mappingFunction = createEncodingStyleMapping(props);
    }
    this.core.getDQSbyID(this.setting.source)?.children.push(this);
    this.update();
  }

  public setStyleMappingFunction(
    type: EncodingStyleKey,
    func: StyleValue<ColorFunction | NumericFunction>
  ) {
    if (!this.mappingFunction) {
      return;
    }
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
    this.areaEncoding?.clear();
    this.graphEncoding?.clear();
    for (const annotation of this.annotations.values()) {
      annotation.clear();
    }
    this.annotations.clear();
    this.trajectoryGroup = null;
    this.areaEncoding = null;
    this.graphEncoding = null;
  }

  public clear() {
    this.clearRenderedArtifacts();
  }

  draw() {
    this.clearRenderedArtifacts();

    if (this.setting.type === 'area') {
      if (!this.areaMappingFunction) {
        throw new Error('area mapping function not initialized');
      }
      this.areaEncoding = new AreaEncoding(
        this.setting,
        this.areaMappingFunction,
        this.core
      );
      this.areaEncoding.update(this.cachedData as FeatureCollection | Feature | null);
      return;
    }

    if (this.setting.type === 'graph') {
      this.graphEncoding = new GraphEncoding(
        this.setting,
        resolveGraphStyle(this.setting.styles as GraphStyleSettings),
        resolveGraphLayout(this.setting.layout),
        this.core
      );
      this.graphEncoding.update(this.cachedData as GeoNetwork | null);
      return;
    }

    if (!this.mappingFunction) {
      throw new Error('trajectory mapping function not initialized');
    }
    this.trajectoryGroup = this.core.addTrajectoryGroup(
      createTrajectoryGroupProps(
        this.setting,
        this.cachedData as Trajectory[],
        this.mappingFunction
      )
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
