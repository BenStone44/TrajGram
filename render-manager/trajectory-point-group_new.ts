import mapboxgl, { LngLat } from 'mapbox-gl';
import { EPSG3857_project, zoom2scale } from '../project';
import * as d3 from 'd3'
import { createProgram, createArrayBuffer } from './renderer/utils';
import type { Trajectorypoint } from '../interfaces/trajectory';
import { ColorConverter, type colorArray } from '../utils/utils_color';
import {
  TrajectoryPointElement,
  type TrajectoryPointRenderBufferFields,
  type CircleRenderStyle
} from '../element/trajectorypoint';
// import { DragAction } from '../interaction/drag';
import { getPixelLength } from '../utils/utils_scale';
import { Trajectoolkit } from '../Trajectoolkit';
import type { PointStyleMappingFunction } from '../encoding/annotation_new';

export type TrajectoryPointRenderInfos = {
  element: Trajectorypoint;
  style: CircleRenderStyle;
};


export type TrajectoryPointGroupProps = {
  id: string;
  data: () => Trajectorypoint[];
  maxZoom?: number;
  minZoom?: number;
  widthFollowZoom?: boolean;
  style: PointStyleMappingFunction;
};
export class TrajectoryPointGroup {
  type = 'point';
  core: Trajectoolkit;
  // DA: DragAction | null = null;
  program: WebGLProgram;
  props: TrajectoryPointGroupProps;
  buffers: { [key: string]: WebGLBuffer } = {};
  drawSize: number;
  elementDict: { [key: string]: TrajectoryPointElement } = {};

  private colorMap: Map<string, string> = new Map();

  static vertexShader = `
          attribute vec4 aColor;
          attribute vec4 offColor;
          attribute vec2 aDirection;
          attribute float aDistance;
          attribute vec2 aLngLat;
          varying vec4 vColor;
          
          uniform vec2 uResolution;
          uniform vec2 uTranslation;
          uniform vec2 uScale;
          uniform float uRatio;
          uniform bool uOffScreen;
          uniform float uZIndex;

          vec2 latlng2pixel(vec2 latlng, vec2 u_translation, vec2 u_scale) {
              float pi = 3.1415926535;
              float max_lat = 85.0511287798;
              
              float lat = max(min(max_lat, latlng.x), -max_lat);
              float sin0 = sin(radians(lat));
              float ln0 = -log((1.0+sin0)/(1.0-sin0))/(4.0 * pi);
              float py = ln0 + 0.5;
              float px = latlng.y / 360.0 + 0.5;;
            
              vec2 a_position = vec2(px, py);
  
              // Scale the position
              vec2 scaledPosition = a_position * uScale;
            
              // Add in the translation.
              vec2 position = scaledPosition + uTranslation + uRatio * aDistance * aDirection;
  
              // convert the position from pixels to 0.0 to 1.0
              vec2 zeroToOne = position * 2.0 * vec2(1, -1) -  vec2(1, -1) * uResolution;
  
              return zeroToOne;
          }
  
  
  
          void main() {
              vec2 aPosition = latlng2pixel(aLngLat, uTranslation, uScale);
              float normalizedZ = uZIndex * 0.001;
              gl_Position = vec4(aPosition/ uResolution, 0, 1.0);
              
              if(uOffScreen)
                vColor = offColor;
              else 
                vColor = aColor;
          }
      `;

  static fragmentShader = `
          precision highp float;
          varying vec4 vColor;
  
          void main() {
              gl_FragColor = vColor;
          }
      `;

  constructor(core: Trajectoolkit, props: TrajectoryPointGroupProps) {
    this.core = core;

    this.drawSize = 0;
    this.props = props;

    const gl = this.core.pointRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    // 创建着色器程序
    this.program = createProgram(
      gl,
      TrajectoryPointGroup.vertexShader,
      TrajectoryPointGroup.fragmentShader
    );

    this._createPointElements(props.data());
    this._createArrayBuffers();
  }

  private _createPointElements(data: Trajectorypoint[]) {
    data.forEach((point, index) => {
      // 处理颜色映射
      let color: d3.RGBColor;
      const colorEncoding = this.props.encodings.color;
      if (typeof colorEncoding === 'function') {
        color = colorEncoding(point);
      } else if (Array.isArray(colorEncoding)) {
        // 处理 colorArray 类型
        color = d3.rgb(colorEncoding[0] || '#000000');
      } else {
        color = d3.rgb(colorEncoding || '#000000');
      }

      // 处理透明度映射
      let opacity: number;
      const opacityEncoding = this.props.encodings.opacity;
      if (typeof opacityEncoding === 'function') {
        opacity = opacityEncoding(point);
      } else {
        opacity = opacityEncoding || 1;
      }

      // 处理半径映射
      let radius: number;
      const radiusEncoding = this.props.encodings.r;
      if (typeof radiusEncoding === 'function') {
        radius = radiusEncoding(point);
      } else {
        radius = Number(radiusEncoding) || 5;
      }

      const colorConverter = new ColorConverter(color);
      const array = colorConverter.Array();
      array[3] = opacity;

      const newCircle = new TrajectoryPointElement(
        {
          source: point,
          style: {
            r: radius,
            fill: array
          }
        },
        this.program,
        this
      );

      const newid = point.id + '#' + index;
      const c = new ColorConverter(newCircle.offColor);
      this.colorMap.set(c.Hex(), newid);
      if (newid in this.elementDict) throw new Error('duplicated id!');
      this.elementDict[newid] = newCircle;
    });
  }

  pick(point: mapboxgl.Point) {
    const gl = this.core.pointRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.core.pointRendering.frameBuffer);

    const pixel = new Uint8Array(4);
    gl.readPixels(
      point.x,
      gl.canvas.height - point.y,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const color = new ColorConverter(pixel);

    const pickedObject = this.colorMap.get(color.Hex());

    if (pickedObject) return this.elementDict[pickedObject];
  }

  public refreshBuffer(
    bufferName: TrajectoryPointRenderBufferFields,
    startIndex: number,
    data: number[]
  ) {
    const gl = this.core.pointRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[bufferName]);
    const offset = startIndex * Float32Array.BYTES_PER_ELEMENT;
    gl.bufferSubData(gl.ARRAY_BUFFER, offset, new Float32Array(data));

    this.draw();
  }

  private _createArrayBuffers() {
    const verticesArray: number[][] = [];

    const colorArray: colorArray[] = [];
    const offScreenColorArray: colorArray[] = [];
    const distance: number[] = [];
    const direction: number[][] = [];

    let drawSize = 0;
    const segment = 40;

    for (const key in this.elementDict) {
      const startVetexIndex = drawSize;
      const point = this.elementDict[key];
      const offScreenColor = point.offColor;
      const lnglat = point.trajectorypoint.basePoint.position;
      const strokeWidth = point.strokeWidth();
      const r = point.r();
      const color = point.fill();
      //console.log('color', color);
      if (strokeWidth) {
        console.log('yes');
      }

      direction.push([0, 0]);
      drawSize += 1;

      for (let i = 0; i <= segment; i++) {
        const angle = (i * 2 * Math.PI) / 40;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        direction.push([x, y]);
      }

      verticesArray.push([lnglat.lat, lnglat.lng]);
      distance.push(r);

      colorArray.push(color);
      offScreenColorArray.push(offScreenColor);

      point.setBufferIndex(startVetexIndex, drawSize - startVetexIndex);
    }
    this.drawSize = drawSize;
    const gl = this.core.pointRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    // Buffer lnglat
    const verticesBuffer = createArrayBuffer(
      gl,
      new Float32Array(this._convertPointToBuffer(verticesArray, 2))
    );

    // Buffer movedirection
    const directionBuffer = createArrayBuffer(
      gl,
      new Float32Array(this._convertPointToBuffer(direction, 2))
    );

    // Buffer off screen color
    const offColorBuffer = createArrayBuffer(
      gl,
      new Float32Array(this._convertPointToBuffer(offScreenColorArray, 4))
    );

    // Buffer color
    const colorBuffer = createArrayBuffer(
      gl,
      new Float32Array(this._convertPointToBuffer(colorArray, 4))
    );

    // Buffer distance
    const distanceBuffer = createArrayBuffer(gl, new Float32Array(distance));

    this.buffers = {
      vertices: verticesBuffer,
      color: colorBuffer,
      offcolor: offColorBuffer,
      direction: directionBuffer,
      r: distanceBuffer
    };
  }

  _convertPointToBuffer(points: number[][], size: number) {
    const convertedPoints: number[] = [];

    // Probably the most fast way
    for (const point of points) {
      for (let index = 0; index < size; index += 1) {
        convertedPoints.push(point[index]);
      }
    }

    return convertedPoints;
  }

  public setGroupStyle(type: string, style: any) {
    return { type, style };
  }

  private _bufferSettings() {
    const gl = this.core.pointRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    // Buffer lnglat
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['vertices']);
    const aPosition = gl.getAttribLocation(this.program, 'aLngLat');
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribDivisor(aPosition, 1);

    // Buffer movedirection
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['direction']);
    const aDirection = gl.getAttribLocation(this.program, 'aDirection');
    gl.vertexAttribPointer(aDirection, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aDirection);

    // Buffer off screen color
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['offcolor']);
    const offColor = gl.getAttribLocation(this.program, 'offColor');
    gl.vertexAttribPointer(offColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(offColor);
    gl.vertexAttribDivisor(offColor, 1);

    // Buffer color
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['color']);
    const aColor = gl.getAttribLocation(this.program, 'aColor');
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribDivisor(aColor, 1);

    // Buffer distance
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['r']);
    const aDistance = gl.getAttribLocation(this.program, 'aDistance');
    gl.vertexAttribPointer(aDistance, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aDistance);
    gl.vertexAttribDivisor(aDistance, 1);
  }

  drawOffScreen() {
    const gl = this.core.pointRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    // offscreen switch
    gl.uniform1i(gl.getUniformLocation(this.program, 'uOffScreen'), 1);

    // 绑定帧缓冲区
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.core.pointRendering.frameBuffer);

    // 进行渲染操作...
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 40 + 2, this.drawSize);

    // 解绑帧缓冲区，恢复到默认的帧缓冲区
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  draw() {
    const gl = this.core.pointRendering.gl;
    if (!gl || !this.core.map) throw new Error(' not initialized!');

    gl.useProgram(this.program);
    this._bufferSettings();
    const zoom = this.core.map?.getZoom() || 14;
    const center = this.core.map?.getCenter() || ({} as LngLat);
    const { maxZoom, minZoom } = this.props;
    if (maxZoom && zoom > maxZoom) return;
    if (minZoom && zoom < minZoom) return;

    const centerP = EPSG3857_project(center, zoom);

    const translation: [number, number] = [
      gl.canvas.width / 2 - centerP.x,
      gl.canvas.height / 2 - centerP.y
    ];
    const scale: [number, number] = [zoom2scale(zoom), zoom2scale(zoom)];

    //z-index
    const zIndex = this.props.zIndex || 2;
    gl.uniform1f(gl.getUniformLocation(this.program, 'uZIndex'), zIndex);

    // Scale
    gl.uniform2fv(gl.getUniformLocation(this.program, 'uScale'), scale);

    // Translation
    gl.uniform2fv(
      gl.getUniformLocation(this.program, 'uTranslation'),
      translation
    );

    // Resolution
    gl.uniform2fv(gl.getUniformLocation(this.program, 'uResolution'), [
      gl.canvas.width,
      gl.canvas.height
    ]);

    // WidthRatio
    gl.uniform1f(
      gl.getUniformLocation(this.program, 'uRatio'),
      getPixelLength(this.core.map, 1)
    );

    //on screen
    gl.uniform1i(gl.getUniformLocation(this.program, 'uOffScreen'), 0);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 40 + 2, this.drawSize);
    this.drawOffScreen();
  }
}
