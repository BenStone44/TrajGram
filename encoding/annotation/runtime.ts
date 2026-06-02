import { Trajectoolkit } from '../../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../../interfaces/trajectory';
import {
  TrajectoryMarkerGroup
} from '../../render-manager/trajectory-marker-group';
import {
  TrajectoryPointGroup
} from '../../render-manager/trajectory-point-group';
import {
  TrajectoryTextGroup
} from '../../render-manager/trajectory-text-group';
import { positionParse } from '../position';
import type {
  AnnotationSettings,
  AnnotationStyleMappingFunction,
  AnnotationType
} from '../types';
import { parseMarkerStyle, parsePointStyle, parseTextStyle } from './style';

type AnnotationHandler = {
  createMapping: (annotation: Annotation, setting: AnnotationSettings) => AnnotationStyleMappingFunction;
  draw: (annotation: Annotation, setting: AnnotationSettings) => void;
};

const annotationHandlers: Partial<Record<AnnotationType, AnnotationHandler>> = {
  points: {
    createMapping: (annotation, setting) =>
      parsePointStyle(
        annotation.id,
        setting,
        () => annotation.source.flatMap(annotation.getPositions)
      ).style,
    draw: (annotation, setting) => {
      annotation.trajectorypointGroup = annotation.core.addPointGroup(
        parsePointStyle(annotation.id, setting, () =>
          annotation.source.flatMap((trajectory) => annotation.getPositions(trajectory))
        )
      );
    }
  },
  markers: {
    createMapping: (annotation, setting) =>
      parseMarkerStyle(
        annotation.id,
        setting,
        () => annotation.source.flatMap(annotation.getPositions)
      ).style,
    draw: (annotation, setting) => {
      annotation.trajectorymarkerGroup = annotation.core.addMarkerGroup(
        parseMarkerStyle(annotation.id, setting, () =>
          annotation.source.flatMap((trajectory) => annotation.getPositions(trajectory))
        )
      );
    }
  },
  text: {
    createMapping: (annotation, setting) =>
      parseTextStyle(
        annotation.id,
        setting,
        annotation.source,
        annotation.getPositions
      ).style,
    draw: (annotation, setting) => {
      annotation.trajectorytextGroup = annotation.core.addTextGroup(
        parseTextStyle(
          annotation.id,
          setting,
          annotation.source,
          annotation.getPositions
        )
      );
    }
  }
};

export class Annotation {
  public id: string;
  public type: AnnotationType;
  public source: Trajectory[];
  public getPositions: (trajectory: Trajectory) => Trajectorypoint[];
  public trajectorypointGroup: TrajectoryPointGroup | null = null;
  public trajectorymarkerGroup: TrajectoryMarkerGroup | null = null;
  public trajectorytextGroup: TrajectoryTextGroup | null = null;
  public mappingFunction: AnnotationStyleMappingFunction | null = null;
  public core: Trajectoolkit;

  constructor(
    id: string,
    setting: AnnotationSettings,
    data: Trajectory[],
    core: Trajectoolkit
  ) {
    this.type = setting.type;
    this.id = id;
    this.source = data;
    this.core = core;
    this.getPositions = positionParse(setting.source, setting.type, core);
    this.mappingFunction = this.createMappingFunction(setting);
    this.draw(setting);
  }

  private createMappingFunction(setting: AnnotationSettings) {
    const handler = annotationHandlers[this.type];
    return handler ? handler.createMapping(this, setting) : null;
  }

  draw(setting: AnnotationSettings) {
    const handler = annotationHandlers[this.type];
    if (handler) {
      handler.draw(this, setting);
    }
  }

  clear() {
    if (this.trajectorypointGroup) {
      this.core.pointRendering.groups.delete(this.id);
      this.trajectorypointGroup = null;
    }

    if (this.trajectorymarkerGroup) {
      this.trajectorymarkerGroup.clear();
      this.core.markerRendering.groups.delete(this.id);
      this.trajectorymarkerGroup = null;
    }

    if (this.trajectorytextGroup) {
      this.trajectorytextGroup.clear();
      this.core.textRendering.groups.delete(this.id);
      this.trajectorytextGroup = null;
    }
  }
}
