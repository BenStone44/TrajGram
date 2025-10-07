import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectorypoint } from '../interfaces/trajectory';
import { MarkerSVG } from '../selection/marker';
import type { MarkerStyleMappingFunction } from '../encoding/annotation_new';
export type TrajectoryMarkerGroupProps = {
  id: string;
  data: () => Trajectorypoint[];
  maxZoom?: number;
  minZoom?: number;
  widthFollowZoom?: boolean;
  style: MarkerStyleMappingFunction
};
export type TrajectoryMarkerElemnet = {
  id: string;
  trajectorypoint: Trajectorypoint;
  center: LngLat;
  color: string;
  opacity: number;
  size: number;
};
export class TrajectoryMarkerGroup {
  type = 'marker';
  core: Trajectoolkit;
  props: TrajectoryMarkerGroupProps;
  elementDict: { [key: string]: TrajectoryMarkerElemnet } = {};
  markerInstances: MarkerSVG[] = [];
  constructor(core: Trajectoolkit, props: TrajectoryMarkerGroupProps) {
    this.core = core;
    this.props = props;
    this._createMarkerElements(props.data());
    Object.values(this.elementDict).forEach((element) => {
      const markerSVG = new MarkerSVG(this.core, {
        point: element.center,
        color: element.color,
        opacity: element.opacity,
        size: element.size
      });
      this.markerInstances.push(markerSVG);
    });
  }
  private _createMarkerElements(data: Trajectorypoint[]) {
    const defaultEncoding = {
      opacity: 1,
      color: '#000000',
      size: 1
    };
    const opacity = this.props.encodings.opacity || defaultEncoding.opacity;
    const color = this.props.encodings.color || defaultEncoding.color;
    const size = this.props.encodings.size || defaultEncoding.size;
    data.forEach((point, index) => {
      const newid = point.id + '#' + index;
      const trajectoryMarkerElement: TrajectoryMarkerElemnet = {
        id: point.id,
        trajectorypoint: point,
        center: new LngLat(
          point.basePoint.position.lng,
          point.basePoint.position.lat
        ),
        color: color,
        opacity: opacity,
        size: size
      };

      this.elementDict[newid] = trajectoryMarkerElement;
    });
  }
  update() {
    this.markerInstances.forEach((instance) => {
      instance.remove();
    });
    this.markerInstances = [];
    Object.values(this.elementDict).forEach((element) => {
      const markerSVG = new MarkerSVG(this.core, {
        point: element.center,
        color: element.color,
        opacity: element.opacity,
        size: element.size
      });
      this.markerInstances.push(markerSVG);
    });
  }
  clear() {
    this.markerInstances.forEach((instance) => {
      instance.remove();
    });
  }
}
