import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import { TextSVG } from '../selection/text';
// import { parseAttributeEither } from '../parseString/regex';
import type { TextStyleMappingFunction } from '../encoding/annotation';

export type TrajectoryTextGroupProps = {
  id: string;
  source: Trajectory[];
  getPoints: (T: Trajectory) => Trajectorypoint[];
  maxZoom?: number;
  minZoom?: number;
  widthFollowZoom?: boolean;
  style: TextStyleMappingFunction;
};

export type TrajectoryTextElemnet = {
  id: string;
  trajectorypoint: Trajectorypoint;
  center: LngLat;
  color: string;
  opacity: number;
  text: string;
  font_size: number;
  transform: string;
  rotate: number;
};

interface Vector {
  x: number;
  y: number;
}

export class TrajectoryTextGroup {
  type = 'text';
  core: Trajectoolkit;
  props: TrajectoryTextGroupProps;
  _map: mapboxgl.Map;
  elementDict: { [key: string]: TrajectoryTextElemnet } = {};
  textInstances: TextSVG[] = [];

  constructor(core: Trajectoolkit, props: TrajectoryTextGroupProps) {
    this.core = core;
    if (!core.AnnotationsSVG || !core.map)
      throw new Error('TKT not initialized');
    this._map = core.map;
    this.props = props;

    this._createMarkerElements(props.source, props.getPoints);
    Object.values(this.elementDict).forEach((element) => {
      const textSVG = new TextSVG(this.core, {
        point: element.center,
        color: element.color,
        opacity: element.opacity,
        text: element.text,
        font_size: element.font_size,
        transform: element.transform,
        rotate: element.rotate
      });
      this.textInstances.push(textSVG);
    });
  }

  private _createMarkerElements(
    source: Trajectory[],
    getPoints: (T: Trajectory) => Trajectorypoint[]
  ) {
    const defaultEncoding = {
      opacity: 0.5,
      color: '#FF0000',
      font_size: 10,
      transform: 'translate(0,0)',
      angle: 0,
      text: '',
      follow: false
    };

    const data = source.flatMap((T) =>
      getPoints(T).map((p) => {
        return { t: T, p: p };
      })
    );

    data.forEach((pt, index) => {
      const point = pt.p;
      const trajectory = pt.t;
      const newid = point.id + '#' + index;
      const defaultText = point.basePoint.time?.substring(11, 19) || 'text';
      const direction = point.attributes.computed?.direction;
      let angle = defaultEncoding.angle;
      
      if (direction) {
        angle = this.computeAngleWithVector(direction);
      }

      const center = new LngLat(
        point.basePoint.position.lng,
        point.basePoint.position.lat
      );

      // 使用映射函数计算样式值
      const opacity = this.props.style.opacity?.type === 'static'
        ? this.props.style.opacity.value as number
        : this.props.style.opacity?.type === 'linear'
        ? (this.props.style.opacity.value as (P: Trajectorypoint) => number)(point)
        : defaultEncoding.opacity;

      const color = this.props.style.color?.type === 'static'
        ? this.props.style.color.value
        : this.props.style.color?.type === 'linear'
        ? (this.props.style.color.value as (P: Trajectorypoint) => any)(point)
        : defaultEncoding.color;

      const font_size = this.props.style.font_size?.type === 'static'
        ? this.props.style.font_size.value as number
        : this.props.style.font_size?.type === 'linear'
        ? (this.props.style.font_size.value as (P: Trajectorypoint) => number)(point)
        : defaultEncoding.font_size;

      const transform = defaultEncoding.transform;

      const follow = this.props.style.follow || defaultEncoding.follow;

      // 处理文本内容
      let textV = '';
      if (this.props.style.text?.value) {
        const textValue = this.props.style.text.value;
        if (typeof textValue === 'string') {
          textV = textValue;
        } else if (typeof textValue === 'function') {
          // 根据函数签名判断是点函数还是轨迹函数
          try {
            textV = (textValue as (P: Trajectorypoint) => string)(point);
          } catch {
            textV = (textValue as (T: Trajectory) => string)(trajectory);
          }
        }
      }

      const trajectoryTextElement: TrajectoryTextElemnet = {
        id: point.id,
        trajectorypoint: point,
        center: center,
        color: color,
        opacity: opacity,
        font_size: font_size,
        text: textV || defaultText,
        transform: transform,
        rotate: follow ? angle : 0
      };

      this.elementDict[newid] = trajectoryTextElement;
    });
  }

  computeAngleWithVector(vector: Vector): number {
    const horizontalVector = { x: 1, y: 0 };
    const dotProduct =
      vector.x * horizontalVector.x + vector.y * horizontalVector.y;
    const vectorLength = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    const cosineValue = dotProduct / vectorLength;
    const angleInRadians = Math.acos(cosineValue);

    const angleInDegrees = (angleInRadians * 180) / Math.PI;
    return vector.y < 0 ? -angleInDegrees : angleInDegrees;
  }

  update() {
    this.textInstances.forEach((instance) => {
      instance.remove();
    });
    this.textInstances = [];
    Object.values(this.elementDict).forEach((element) => {
      const textSVG = new TextSVG(this.core, {
        point: element.center,
        color: element.color,
        opacity: element.opacity,
        text: element.text,
        font_size: element.font_size,
        transform: element.transform,
        rotate: element.rotate
      });
      this.textInstances.push(textSVG);
    });
  }

  clear() {
    this.textInstances.forEach((instance) => {
      instance.remove();
    });
  }
}