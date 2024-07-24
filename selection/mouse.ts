import mapboxgl from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import { TrajectoryElement } from '../element/trajectory';
import { TrajectoryPointElement } from '../element/trajectorypoint';

export type MouseEventType = 'mouse.hover' | 'mouse.click';

export class MouseSelection {
  private core: Trajectoolkit;
  public type: MouseEventType;
  public currentElement: TrajectoryElement | TrajectoryPointElement | null =
    null;
  public lastElement: TrajectoryElement | TrajectoryPointElement | null = null;

  constructor(type: MouseEventType, core: Trajectoolkit) {
    this.core = core;
    this.type = type;
    switch (type) {
      case 'mouse.click':
        this.core.map?.on(
          'mouseclick',
          (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
            this.currentElement =
              this.pickTrajectory(e.point) || this.pickPoint(e.point);
          }
        );
        break;
      case 'mouse.hover':
        this.core.map?.on(
          'mousemove',
          (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
            this.currentElement =
              this.pickTrajectory(e.point) || this.pickPoint(e.point);
          }
        );
        break;
    }
  }

  pickTrajectory(point: mapboxgl.Point) {
    for (const group of this.core.trajectoryRendering.groups.values()) {
      const T = group.pick(point);
      if (T) return T;
    }
    return null;
  }

  pickPoint(point: mapboxgl.Point) {
    for (const group of this.core.pointRendering.groups.values()) {
      const P = group.pick(point);
      if (P) return P;
    }

    return null;
  }
}
