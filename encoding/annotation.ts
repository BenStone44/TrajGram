import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import {
  TrajectoryPointGroup,
  type TrajectoryPointGroupProps
} from '../render-manager/trajectory-point-group';
import { positionParse } from './parse';
// import mapboxgl, { Marker } from 'mapbox-gl';
// import * as d3 from 'd3';
import {
  TrajectoryMarkerGroup,
  type TrajectoryMarkerGroupProps
} from '../render-manager/trajectory-marker-group';
import {
  TrajectoryTextGroup,
  type TrajectoryTextGroupProps
} from '../render-manager/trajectory-text-group';
export type AnnotationType = 'markers' | 'points' | 'arrows' | 'text';

export interface MarkerStyle {
  size: number;
  color: string;
  opacity: number;
}

export interface PointStyle {
  color: string;
  r: number;
  opacity: number;
}

export interface ArrowStyle {
  direction: boolean;
  color: string;
  size: number;
}
export interface TextStyle {
  color: string;
  opacity: number;
  text: string;
  font_size: number;
  transform: string;
  follow?: boolean;
}
export const parsePointStyle = (
  id: string,
  setting: AnnotationSettings,
  data: () => Trajectorypoint[]
): TrajectoryPointGroupProps => {
  const styles = setting.styles as PointStyle;
  return {
    id: id,
    data: data,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    encodings: {
      color: styles.color,
      r: styles.r,
      opacity: styles.opacity
    }
  };
};
export const parseMarkerStyle = (
  id: string,
  setting: AnnotationSettings,
  data: () => Trajectorypoint[]
): TrajectoryMarkerGroupProps => {
  const styles = setting.styles as MarkerStyle;
  return {
    id: id,
    data: data,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    encodings: {
      color: styles.color,
      opacity: styles.opacity,
      size: styles.size
    }
  };
};
export const parseTextStyle = (
  id: string,
  setting: AnnotationSettings,
  source: () => Trajectory[],
  getPoints: (T: Trajectory) => Trajectorypoint[]
): TrajectoryTextGroupProps => {
  const styles = setting.styles as TextStyle;
  return {
    id: id,
    source,
    getPoints,
    maxZoom: setting.maxzoom,
    minZoom: setting.minzoom,
    encodings: {
      color: styles.color,
      opacity: styles.opacity,
      text: styles.text,
      follow: styles.follow,
      font_size: styles.font_size,
      transform: styles.transform
    }
  };
};
export type AnnotationStyle = MarkerStyle | PointStyle | ArrowStyle | TextStyle;

export interface AnnotationSettings {
  source: string;
  maxzoom?: number;
  minzoom?: number;
  type: AnnotationType;
  styles: AnnotationStyle;
}

export class Annotation {
  public id;
  public type: AnnotationType;
  public source: () => Trajectory[];
  public getPositions: (T: Trajectory) => Trajectorypoint[];
  public trajectorypointGroup: TrajectoryPointGroup | null = null;
  public trajectorymarkerGroup: TrajectoryMarkerGroup | null = null;
  public trajectorytextGroup: TrajectoryTextGroup | null = null;
  //private markers: Marker[] = [];
  constructor(
    id: string,
    setting: AnnotationSettings,
    getData: () => Trajectory[],
    core: Trajectoolkit
  ) {
    this.type = setting.type;
    this.id = id;
    this.source = () => getData();
    this.getPositions = positionParse(setting.source, setting.type, core);
    if (this.type == 'points') {
      //this.clearMarkers(this.id, core);
      this.trajectorypointGroup = core.addPointGroup(
        parsePointStyle(this.id, setting, () =>
          this.source().flatMap((T) => this.getPositions(T))
        )
      );
    }
    if (this.type == 'markers') {
      this.trajectorymarkerGroup = core.addMarkerGroup(
        parseMarkerStyle(this.id, setting, () =>
          this.source().flatMap((T) => this.getPositions(T))
        )
      );
    }
    if (this.type == 'text') {
      this.trajectorytextGroup = core.addTextGroup(
        parseTextStyle(this.id, setting, this.source, this.getPositions)
      );
    }
  }
  draw() {
    return;
  }
}
