import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectorypoint } from '../interfaces/trajectory';
import { MarkerSVG } from '../selection/marker';
export type TrajectoryMarkerGroupProps = {
  id: string;
  data: () => Trajectorypoint[];
  maxZoom?: number;
  minZoom?: number;
  widthFollowZoom?: boolean;
  encodings: {
    color?: string;
    opacity?: number;
    size?: number;
  };
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
  // DA: DragAction | null = null;
  props: TrajectoryMarkerGroupProps;
  //drawSize: number;
  elementDict: { [key: string]: TrajectoryMarkerElemnet } = {};
  markerInstances: MarkerSVG[] = [];
  constructor(core: Trajectoolkit, props: TrajectoryMarkerGroupProps) {
    this.core = core;

    // this.drawSize = 0;
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
    // const colorConverter = new ColorConverter(
    //   this.props.encodings.color || '#000000'
    // );
    const defaultEncoding = {
      opacity: 1,
      color: '#000000',
      size: 1
    };
    const opacity = this.props.encodings.opacity || defaultEncoding.opacity;
    const color = this.props.encodings.color || defaultEncoding.color;
    const size = this.props.encodings.size || defaultEncoding.size;
    //const array = colorConverter.Array();
    //array[3] = opacity;
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
      // Perform operations with each element in elementDict
      //console.log(`Element ID: ${element.id}, Center: ${element.center}`);
      const markerSVG = new MarkerSVG(this.core, {
        point: element.center,
        color: element.color,
        opacity: element.opacity,
        size: element.size
      });
      //markerSVG.draw();
      this.markerInstances.push(markerSVG);
    });
  }
  clear() {
    this.markerInstances.forEach((instance) => {
      instance.remove();
    });
  }
}
