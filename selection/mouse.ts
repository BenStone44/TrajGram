import mapboxgl from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import { TrajectoryElement } from '../element/trajectory';
import { TrajectoryPointElement } from '../element/trajectorypoint';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import type { RoadNetworkItem } from '../interfaces/road-network';

// 定义回调函数类型
type CallbackFunction = () => void;

export type MouseEventType = 'mouse.hover' | 'mouse.click';

export class MouseSelection {
  private core: Trajectoolkit;
  public type: MouseEventType;
  public currentElement: TrajectoryElement | TrajectoryPointElement | null =
    null;
  public lastElement: TrajectoryElement | TrajectoryPointElement | null = null;
  public MouseSelectionResult: (Trajectory | Trajectorypoint | RoadNetworkItem)[] = []
  private onMouseDownCallback: Array<CallbackFunction> = [];
  private onMouseMoveCallback: Array<CallbackFunction> = [];
  private onMouseUpCallback: Array<CallbackFunction> = [];

  constructor(type: MouseEventType, core: Trajectoolkit) {
    this.core = core;
    this.type = type;

    // 绑定 this 上下文，以便在事件监听器中使用
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    this.core.map?.on('mousedown', this.onMouseDown);
    this.core.map?.on('mousemove', this.onMouseMove);

    switch (type) {
      case 'mouse.click':
        this.core.map?.on(
          'click',
          (e: mapboxgl.MapMouseEvent) => {
            this.currentElement = this.pickTrajectory(e.point);
            if(this.currentElement)
              this.MouseSelectionResult = [(this.currentElement as TrajectoryElement).detailedTrajectory]
            else this.MouseSelectionResult = []
          }
        );
        break;
      case 'mouse.hover':
        this.core.map?.on(
          'mousemove',
          (e: mapboxgl.MapMouseEvent) => {
            this.currentElement = this.pickTrajectory(e.point);
            if(this.currentElement)
              this.MouseSelectionResult = [(this.currentElement as TrajectoryElement).detailedTrajectory]
            else this.MouseSelectionResult = []
          }
        );
        break;
    }
  }

  // mousedown 事件的处理函数启动拖拽
  private onMouseDown(event: mapboxgl.MapMouseEvent) {
    event
    this.onMouseDownCallback.forEach((cb) => cb());
  }

  // mousemove 事件的处理函数捕获拖拽
  private onMouseMove(event: mapboxgl.MapMouseEvent) {
    event
      this.onMouseMoveCallback.forEach((cb) => cb());
  }

  // mouseup 事件的处理函数结束拖拽
  private onMouseUp(event: mapboxgl.MapMouseEvent) {
    event
    this.onMouseUpCallback.forEach((cb) => cb());
  }
    // 设置回调函数
  public setOnMouseDownCallback(callback: CallbackFunction) {
    this.onMouseDownCallback.push(callback);
  }

  public setOnMouseMoveCallback(callback: CallbackFunction) {
    this.onMouseMoveCallback.push(callback);
  }

  public setOnMouseUpCallback(callback: CallbackFunction) {
    this.onMouseUpCallback.push(callback);
  }

  public setCallBack(callback: CallbackFunction) {
    if(this.type == 'mouse.click') {
      this.setOnMouseDownCallback(callback)
    }
    if(this.type == 'mouse.hover') {
      this.setOnMouseMoveCallback(callback)
    }
  }

  public toGeoElement() {
    
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
