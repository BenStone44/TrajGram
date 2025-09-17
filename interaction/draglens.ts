// 导入 Mapbox 类型定义
import mapboxgl from 'mapbox-gl';
import { LensSVG } from '../selection/lens_svg';
// import { MarkerSVG } from '../selection/marker';

// 定义回调函数类型
type CallbackFunction = () => void;

// 定义拖拽类
export class DragLensAction {
  private map: mapboxgl.Map;
  private isDragging: boolean;
  private startPoint: mapboxgl.Point | null;
  private element: LensSVG | null = null;
  private onMouseDownCallback: Array<CallbackFunction> = [];
  private onMouseMoveCallback: Array<CallbackFunction> = [];
  private onMouseUpCallback: Array<CallbackFunction> = [];

  constructor(map: mapboxgl.Map) {
    this.map = map;
    this.isDragging = false;
    this.startPoint = null;

    // 绑定 this 上下文，以便在事件监听器中使用
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
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
  // mousedown 事件的处理函数启动拖拽
  private onMouseDown(event: mapboxgl.MapMouseEvent) {
    this.map.dragPan.disable();
    this.startPoint = event.point;
    this.isDragging = true;
    this.onMouseDownCallback.forEach((cb) => cb());
  }

  // mousemove 事件的处理函数捕获拖拽
  private onMouseMove(event: mapboxgl.MapMouseEvent) {
    if (!this.isDragging || !this.startPoint) return;
    const currentPoint = event.point;
    const deltax = currentPoint.x - this.startPoint.x,
      deltay = currentPoint.y - this.startPoint.y;
    if (this.element) {
      const coordinates = this.element.coordinates;
      this.element.setCoordinates({
        x: coordinates.x + deltax,
        y: coordinates.y + deltay
      });
      // this.element.draw();
      this.startPoint = currentPoint;
      this.onMouseMoveCallback.forEach((cb) => cb());
    }
  }

  public async setElement(element: any) {
    this.element = element;
  }

  // mouseup 事件的处理函数结束拖拽
  private onMouseUp(event: mapboxgl.MapMouseEvent) {
    if (!this.isDragging) return;

    if (this.element && this.startPoint) {
      const currentPoint = event.point;
      const deltax = currentPoint.x - this.startPoint.x,
        deltay = currentPoint.y - this.startPoint.y;
      const coordinates = this.element.coordinates;

      this.element.setCoordinates({
        x: coordinates.x + deltax,
        y: coordinates.y + deltay
      });
      this.element.draw();
    }

    this.element = null;
    this.isDragging = false;
    this.startPoint = null;
    this.map.dragPan.enable();
    this.onMouseUpCallback.forEach((cb) => cb());
  }

  // 添加事件监听器以启用拖拽效果
  public enableDrag() {
    this.map.on('mousedown', this.onMouseDown);
    this.map.on('mousemove', this.onMouseMove);
    this.map.on('mouseup', this.onMouseUp);
  }

  // 移除事件监听器以取消拖拽效果
  public disableDrag() {
    this.map.off('mousedown', this.onMouseDown);
    this.map.off('mousemove', this.onMouseMove);
    this.map.off('mouseup', this.onMouseUp);
  }
}
