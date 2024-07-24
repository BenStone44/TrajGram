import mapboxgl, { LngLat } from 'mapbox-gl';
import * as d3 from 'd3';
import { DragLensAction } from '../interaction/draglens';
import { getPixelLength } from '../utils/utils_scale';
import type { GeoElement } from '../interfaces/geo';
import * as turf from '@turf/turf';
import { TrajectoryPointElement } from '../element/trajectorypoint';
import { TrajectoryElement } from '../element/trajectory';
import pointToLineDistance from '@turf/point-to-line-distance';
import { Trajectoolkit } from '../Trajectoolkit';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
export type LensInfo = {
  point: LngLat;
  style: {
    r?: number;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: string;
  };
};

const defalutLensStyle = {
  color: {
    'lens.start': '#38761d',
    'lens.end': '#942a2a',
    'lens.pass': '#fd9900'
  } as { [key: string]: string },
  r: 250,
  fillOpacity: 0.2,
  strokeWidth: 3,
  strokeOpacity: 1
};

export type LensType = 'lens.start' | 'lens.end' | 'lens.pass';
export class LensSVG {
  core: Trajectoolkit;
  _map: mapboxgl.Map;
  followZoom = true;
  container: SVGSVGElement;
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  circle: d3.Selection<SVGCircleElement, unknown, null, undefined> | null =
    null;
  data: LensInfo;
  Drag: DragLensAction;
  coordinates = { x: 0, y: 0, r: 0 };
  type: LensType;
  center: LngLat;
  constructor(core: Trajectoolkit, type: LensType, data: LensInfo) {
    this.core = core;
    this.type = type;
    if (!core.SVG || !core.map) throw new Error('TKT not initialized');
    this.container = core.SVG;
    this._map = core.map;
    this.center = data.point;
    this.g = d3.select(this.container).append('g');

    this.data = data;
    this.Drag = new DragLensAction(this._map);
    this.coordinates = this._calculateCoordinates();

    this.draw();
  }

  private _calculateCoordinates() {
    const rp = this._map.project(this.center);

    const r = this.data.style.r || defalutLensStyle.r;
    return {
      x: rp.x,
      y: rp.y,
      r: getPixelLength(this._map, r)
    };
  }

  public toGeoElement() {
    return {
      type: 'circle',
      shape: { center: this.center, r: this.data.style.r || defalutLensStyle.r }
    } as GeoElement;
  }
  public setCoordinates(c: { x: number; y: number; r?: number }) {
    this.coordinates.x = c.x;
    this.coordinates.y = c.y;
    this.coordinates.r = c.r || this.coordinates.r;

    this.circle?.attr('cx', c.x).attr('cy', c.y).attr('r', this.coordinates.r);

    this.center = this._map.unproject({ x: c.x, y: c.y } as mapboxgl.Point);
  }

  public match(
    element:
      | TrajectoryElement
      | TrajectoryPointElement
      | Trajectory
      | Trajectorypoint,
    elementType: 'point' | 'trajectory'
  ) {
    const lensCenter = turf.point([this.center.lng, this.center.lat]);
    const r = this.data.style.r || 250;
    switch (this.type) {
      case 'lens.start': {
        switch (elementType) {
          case 'point': {
            const p = (element as TrajectoryPointElement).trajectorypoint
              ? (element as TrajectoryPointElement).trajectorypoint
              : (element as Trajectorypoint);
            const startpoint = turf.point([
              p.basePoint.position.lng,
              p.basePoint.position.lat
            ]);

            const dis = turf.distance(lensCenter, startpoint, 'kilometers');

            return dis * 1000 < r;
          }
          case 'trajectory': {
            const p = (element as TrajectoryElement).startPoint
              ? (element as TrajectoryElement).startPoint
              : (element as Trajectory).shapingPoints[0];
            const startpoint = turf.point([
              p.basePoint.position.lng,
              p.basePoint.position.lat
            ]);
            //console.log('startpoint', startpoint);
            const dis = turf.distance(lensCenter, startpoint, 'kilometers');
            return dis * 1000 < r;
          }
        }
      }
      case 'lens.end': {
        switch (elementType) {
          case 'point': {
            const p = (element as TrajectoryPointElement).trajectorypoint
              ? (element as TrajectoryPointElement).trajectorypoint
              : (element as Trajectorypoint);
            const startpoint = turf.point([
              p.basePoint.position.lng,
              p.basePoint.position.lat
            ]);

            const dis = turf.distance(lensCenter, startpoint, 'kilometers');
            return dis * 1000 < r;
          }
          case 'trajectory': {
            let p = (element as TrajectoryElement).endPoint;
            if (!p) {
              const shapePointArray: Trajectorypoint[] = (element as Trajectory)
                .shapingPoints;
              p = shapePointArray[shapePointArray.length - 1];
            }
            const startpoint = turf.point([
              p.basePoint.position.lng,
              p.basePoint.position.lat
            ]);

            const dis = turf.distance(lensCenter, startpoint, 'kilometers');
            return dis * 1000 < r;
          }
        }
      }
      case 'lens.pass': {
        switch (elementType) {
          case 'point': {
            const p = (element as TrajectoryPointElement).trajectorypoint
              ? (element as TrajectoryPointElement).trajectorypoint
              : (element as Trajectorypoint);
            const startpoint = turf.point([
              p.basePoint.position.lng,
              p.basePoint.position.lat
            ]);

            const dis = turf.distance(lensCenter, startpoint, 'kilometers');
            return dis * 1000 < r;
          }
          case 'trajectory': {
            let feature = (element as TrajectoryElement).feature;
            if (!feature) {
              feature = turf.lineString(
                (element as Trajectory).shapingPoints.map((p) => [
                  p.basePoint.position.lng,
                  p.basePoint.position.lat
                ])
              );
            }
            const dis = pointToLineDistance(lensCenter, feature, {
              units: 'meters'
            });
            return dis < r;
          }
        }
      }
    }
  }

  public draw() {
    this.coordinates = this._calculateCoordinates();
    const x = this.coordinates.x;
    const y = this.coordinates.y;

    this._map.off(
      'mousemove',
      (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => this.pick(e.point)
    );

    this.g.selectAll('*').remove();
    this.circle = this.g
      .append('circle')
      .style('fill', this.data.style.fill || defalutLensStyle.color[this.type])
      .style(
        'fill-opacity',
        this.data.style.fillOpacity || defalutLensStyle.fillOpacity
      )
      .style(
        'stroke',
        this.data.style.stroke || defalutLensStyle.color[this.type]
      )
      .style(
        'stroke-width',
        this.data.style.strokeWidth || defalutLensStyle.strokeWidth
      )
      .style(
        'stroke-opacity',
        this.data.style.strokeOpacity || defalutLensStyle.strokeOpacity
      )
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', this.coordinates.r);

    this._map.on(
      'mousemove',
      (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => this.pick(e.point)
    );
  }

  pick(point: mapboxgl.Point) {
    // 计算两个点之间的距离
    const distance = Math.sqrt(
      Math.pow(point.x - this.coordinates.x, 2) +
        Math.pow(point.y - this.coordinates.y, 2)
    );
    if (distance < this.coordinates.r) {
      this.Drag?.setElement(this);
      this.Drag?.enableDrag();
    } else {
      this.Drag?.disableDrag();
    }
  }
}
