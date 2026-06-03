import mapboxgl from 'mapbox-gl';
import { LensSVG } from './lens_svg';

type CallbackFunction = () => void;

export class DragLensAction {
  private map: mapboxgl.Map;
  private isDragging: boolean;
  private dragListenersEnabled: boolean;
  private startPoint: mapboxgl.Point | null;
  private element: LensSVG | null = null;
  private onMouseDownCallback: Array<CallbackFunction> = [];
  private onMouseMoveCallback: Array<CallbackFunction> = [];
  private onMouseUpCallback: Array<CallbackFunction> = [];
  private boundWindowMouseUp: () => void;

  constructor(map: mapboxgl.Map) {
    this.map = map;
    this.isDragging = false;
    this.dragListenersEnabled = false;
    this.startPoint = null;

    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.boundWindowMouseUp = this.handleWindowMouseUp.bind(this);
  }

  public get dragging() {
    return this.isDragging;
  }

  public setOnMouseDownCallback(callback: CallbackFunction) {
    this.onMouseDownCallback.push(callback);
  }

  public setOnMouseMoveCallback(callback: CallbackFunction) {
    this.onMouseMoveCallback.push(callback);
  }

  public setOnMouseUpCallback(callback: CallbackFunction) {
    this.onMouseUpCallback.push(callback);
  }

  private onMouseDown(event: mapboxgl.MapMouseEvent) {
    this.map.dragPan.disable();
    this.startPoint = event.point;
    this.isDragging = true;
    window.addEventListener('mouseup', this.boundWindowMouseUp);
    this.onMouseDownCallback.forEach((cb) => cb());
  }

  private onMouseMove(event: mapboxgl.MapMouseEvent) {
    if (!this.isDragging || !this.startPoint) return;
    const currentPoint = event.point;
    const deltax = currentPoint.x - this.startPoint.x;
    const deltay = currentPoint.y - this.startPoint.y;

    if (this.element) {
      const coordinates = this.element.coordinates;
      this.element.setCoordinates({
        x: coordinates.x + deltax,
        y: coordinates.y + deltay
      });
      this.startPoint = currentPoint;
      this.onMouseMoveCallback.forEach((cb) => cb());
    }
  }

  public async setElement(element: any) {
    this.element = element;
  }

  private finishDrag(finalPoint?: mapboxgl.Point) {
    if (!this.isDragging) return;

    if (this.element && this.startPoint && finalPoint) {
      const deltax = finalPoint.x - this.startPoint.x;
      const deltay = finalPoint.y - this.startPoint.y;
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
    window.removeEventListener('mouseup', this.boundWindowMouseUp);
    this.map.dragPan.enable();
    this.onMouseUpCallback.forEach((cb) => cb());
  }

  private onMouseUp(event: mapboxgl.MapMouseEvent) {
    this.finishDrag(event.point);
  }

  private handleWindowMouseUp() {
    this.finishDrag();
  }

  public enableDrag() {
    if (this.dragListenersEnabled) {
      return;
    }
    this.map.on('mousedown', this.onMouseDown);
    this.map.on('mousemove', this.onMouseMove);
    this.map.on('mouseup', this.onMouseUp);
    this.dragListenersEnabled = true;
  }

  public disableDrag() {
    if (this.isDragging) {
      return;
    }
    if (!this.dragListenersEnabled) {
      return;
    }
    this.map.off('mousedown', this.onMouseDown);
    this.map.off('mousemove', this.onMouseMove);
    this.map.off('mouseup', this.onMouseUp);
    this.dragListenersEnabled = false;
  }
}
