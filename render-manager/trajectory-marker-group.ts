import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectorypoint } from '../interfaces/trajectory';
import { MarkerSVG } from '../selection/marker';
import type { MarkerStyleMappingFunction } from '../encoding/annotation';
import { ColorConverter, type ColorInput } from '../utils/utils_color';

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
      size: 10
    };

    data.forEach((point, index) => {
      const newid = point.id + '#' + index;
      
      // 使用映射函数计算样式值

    const opacity = this.props.style.opacity?.type === 'static'
      ? this.props.style.opacity.value as number
      : this.props.style.opacity?.type === 'linear'
      ? (this.props.style.opacity.value as (P: Trajectorypoint) => number)(point)
      : defaultEncoding.opacity;

    const color = this.props.style.color?.type === 'static'
      ? new ColorConverter(this.props.style.color.value as ColorInput).Hex()
      : this.props.style.color?.type === 'linear'
      ? (this.props.style.color.value as (P: Trajectorypoint) => d3.RGBColor)(point).formatHex()
      : defaultEncoding.color;

    const size = this.props.style.size?.type === 'static'
      ? this.props.style.size.value as number
      : this.props.style.size?.type === 'linear'
      ? (this.props.style.size.value as (P: Trajectorypoint) => number)(point)
      : defaultEncoding.size;

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
    // 只是重新渲染现有的标记实例，不清空数据
    this.markerInstances.forEach((instance) => {
      instance.remove();
    });
    this.markerInstances = [];
    
    // 使用现有的 elementDict 重新创建标记实例
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