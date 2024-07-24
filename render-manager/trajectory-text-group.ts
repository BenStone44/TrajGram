import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import { TextSVG } from '../selection/text';
import { parseAttributeEither } from '../parseString/regex';

export type TrajectoryTextGroupProps = {
  id: string;
  source: () => Trajectory[];
  getPoints: (T: Trajectory) => Trajectorypoint[];
  maxZoom?: number;
  minZoom?: number;
  widthFollowZoom?: boolean;
  encodings: {
    color?: string;
    opacity?: number;
    text?: string;
    font_size?: number;
    transform?: string;
    rotate?: number;
    follow?: boolean;
  };
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
  // DA: DragAction | null = null;
  props: TrajectoryTextGroupProps;
  _map: mapboxgl.Map;
  //drawSize: number;
  elementDict: { [key: string]: TrajectoryTextElemnet } = {};
  textInstances: TextSVG[] = [];
  constructor(core: Trajectoolkit, props: TrajectoryTextGroupProps) {
    this.core = core;
    if (!core.AnnotationsSVG || !core.map)
      throw new Error('TKT not initialized');
    this._map = core.map;
    // this.drawSize = 0;
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
    source: () => Trajectory[],
    getPoints: (T: Trajectory) => Trajectorypoint[]
  ) {
    // const colorConverter = new ColorConverter(
    //   this.props.encodings.color || '#000000'
    // );
    const defaultEncoding = {
      opacity: 0.5,
      color: '#FF0000',
      front_size: 10,
      transform: 'translate(0,0)',
      angle: 0
    };
    const opacity = this.props.encodings.opacity || defaultEncoding.opacity;
    const color = this.props.encodings.color || defaultEncoding.color;
    const font_size =
      this.props.encodings.font_size || defaultEncoding.front_size;
    const text = this.props.encodings.text;
    const follow = this.props.encodings.follow
      ? this.props.encodings.follow
      : false;
    const transform =
      this.props.encodings.transform || defaultEncoding.transform;
    const data = source().flatMap((T) =>
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
      let textV = '';
      if (text) {
        const textFunc = parseAttributeEither(text);

        switch (textFunc.type) {
          case 's':
            textV = textFunc.value as string;
            break;
          case 'p':
            textV = (textFunc.value as (P: Trajectorypoint) => any)(point);
            break;
          case 't':
            textV = (textFunc.value as (T: Trajectory) => any)(trajectory);
            break;
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
  //   calculateCoordinates(point: LngLat): Vector {
  //     const rp = this._map.project(point);
  //     return {
  //       x: rp.x,
  //       y: rp.y
  //     };
  //   }
  //   computeUnitVector(point1: LngLat, point2: LngLat): Vector {
  //     const p1 = this.calculateCoordinates(point1);
  //     const p2 = this.calculateCoordinates(point2);
  //     const dx = p2.x - p1.x;
  //     const dy = p2.y - p1.y;
  //     const length = Math.sqrt(dx * dx + dy * dy);

  //     if (length === 0) {
  //       throw new Error('Cannot compute unit vector for zero length');
  //     }

  //     return { x: dx / length, y: dy / length };
  //   }

  //   computeVectorDifference(vector1: Vector, vector2: Vector): Vector {
  //     return { x: vector2.x - vector1.x, y: vector2.y - vector1.y };
  //   }

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
      //textSVG.draw();
      this.textInstances.push(textSVG);
    });
  }
  clear() {
    this.textInstances.forEach((instance) => {
      instance.remove();
    });
  }
}
