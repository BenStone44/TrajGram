import type { STpoint } from './base';

export type TrajectoryPointAttributes =  {
  source?: SourceAttribute;
  computed?: ComputedAttribute;
  others?: { [key: string]: any };
}

export type SourceAttribute =  {
  tid?: string; // trajectory id : mapping to trajectory
  sid?: string; // segment id : mapping to road-network
}

export type ComputedAttribute = {
  trajDP?: number;
  trajTP?: number;
  segDP?: number;
  direction?: { x: number; y: number };
}
export type TrajectoryAttributes = {
  road_id?: string;
  durtime?: number;
  distance?: number;
}
export type Trajectorypoint = {
  id: string;
  basePoint: STpoint;
  attributes: TrajectoryPointAttributes;
}

export type AnnotationPoint = {
  basePoint: Trajectorypoint;
  attributes?: any;
}

export type AnnotationSubtrajectory = {
  startPoint: Trajectorypoint;
  endPoint: Trajectorypoint;
  attributes: any;
}

export type Trajectory = {
  id: string;
  starttime: string;
  endtime: string;
  distance: number;
  shapingPoints: Trajectorypoint[];
  annotationPoints?: { [key: string]: AnnotationPoint[] };
  annotationSubTrajectories?: { [key: string]: AnnotationSubtrajectory[][] };
  segmentInstanceIdList?: segmentInstance[];
  attributes?: { [key: string]: any }; //TrajectoryAttributes;
}

export type segmentInstance = {
  sid: string;
  startpoint: Trajectorypoint;
  endpoint: Trajectorypoint;
  attributes?: any;
}
