import {
  TrajectoryElement,
  type bufferType,
  type pointRenderInfo,
  type styleType
} from '../element/trajectory';

import { EPSG3857_project, zoom2scale } from '../project';
import {
  createProgram,
  createArrayBuffer
} from '../render-manager/renderer/utils';
import type { Trajectory, Trajectorypoint } from '../interfaces/trajectory';
import { ColorConverter, type ColorInput } from '../utils/utils_color';
import { Trajectoolkit } from '../Trajectoolkit';
import { getPixelLength } from '../utils/utils_scale';;
import type { StyleMappingFunction } from '../encoding/encoding';
type CallbackFunction = () => void;

export type capType = 'round' | 'square';
export type renderInfos = {
  element: TrajectoryElement;
  trajectory: pointRenderInfo[][];
};

export type TrajectoryGroupProps = {
  id: string;
  data: () => Trajectory[];
  maxZoom?: number;
  minZoom?: number;
  widthFollowZoom?: boolean;
  capStyle?: capType;
  style: StyleMappingFunction;
};

export class TrajectoryGroup {
  type = 'trajectory';
  program: WebGLProgram;
  drawSize: number;
  elementDict: { [key: string]: TrajectoryElement } = {};
  props: TrajectoryGroupProps;
  lastPickingObjectId?: string;
  core: Trajectoolkit;
  buffers: { [key: string]: WebGLBuffer } = {};
  private colorMap: Map<string, string> = new Map();

  static vertexShader = `
        precision highp float;
        // attribute vec2 aTextureCoord;
        attribute vec2 llPosition;
        attribute vec2 llPrevious;
        attribute vec2 llAfter;
        attribute float aWidth;
        
        attribute vec4 aColor;
        attribute vec4 offColor;
        
        attribute vec4 aCorner;


        varying vec4 vColor;
        
        uniform vec2 uResolution;
        uniform vec2 uTranslation;
        uniform vec2 uScale;
        uniform float uRatio;
        uniform bool uOffScreen;
        // varying highp vec2 vTextureCoord;

        vec2 adjustPoint(vec2 current, vec2 toBeAdjustPoint, vec2 referPoint) {
            if (all(equal(current, toBeAdjustPoint))) {
                toBeAdjustPoint = current + 0.001 * normalize(current - referPoint);
            }
            return toBeAdjustPoint;
        }

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
            vec2 position = scaledPosition + uTranslation;

            // convert the position from pixels to 0.0 to 1.0
            vec2 zeroToOne = position * 2.0 * vec2(1, -1) -  vec2(1, -1) * uResolution;

            return zeroToOne;
        }

        float getMiterLength(vec2 normalLeft, vec2 miter) {
            return uRatio * aWidth / (dot(miter, normalLeft));
        }

        bool isOuterJoint(vec2 miter, vec2 pointer) {
            return aCorner.x * dot(miter, pointer) >= 0.0;
        }


        void main() {
            vec2 aPosition = latlng2pixel(llPosition, uTranslation, uScale);
            vec2 aPrevious = latlng2pixel(llPrevious, uTranslation, uScale);
            vec2 aAfter = latlng2pixel(llAfter, uTranslation, uScale);


            vec2 adjustedPrevious = adjustPoint(aPosition, aPrevious, aAfter);
            vec2 adjustedAfter = adjustPoint(aPosition, aAfter, aPrevious);

            vec2 ab = normalize(aPosition - adjustedPrevious);
            vec2 bc = normalize(adjustedAfter - aPosition);

            vec2 tangent = normalize(ab + bc);

            if(adjustedPrevious == adjustedAfter)
              tangent = ab;

            vec2 miter = vec2(-tangent.y, tangent.x);
            vec2 normalLeft = vec2(-ab.y, ab.x);
            vec2 normalRight = vec2(-bc.y, bc.x);
            vec2 pointer = normalize(ab - bc);
            float miterLength = getMiterLength(normalLeft, miter);

            float moveDistance = 0.0;
            vec2 moveDirection = vec2(0.0);


            float maxMiterLength = aWidth + 1.0;

            if (miterLength > maxMiterLength * uRatio && isOuterJoint(miter, pointer)) {
                float ratio = (aCorner.y + 1.0) / 2.0;
                moveDirection = sign(dot(miter, pointer)) * (normalLeft * (1.0 - ratio) + normalRight * ratio);
                // moveDirection = normalize( sign(dot(miter, pointer)) * (normalLeft * (1.0 - ratio) + normalRight * ratio));
                moveDistance = uRatio * aWidth;
            } else {
                moveDirection = aCorner.x * miter + aCorner.z * ab + aCorner.w * normalLeft;
                moveDistance = miterLength;
            }

            if(moveDistance > maxMiterLength * uRatio)
              moveDistance = maxMiterLength * uRatio;


            gl_Position = vec4(aPosition / uResolution + moveDirection * moveDistance / uResolution, 0.0, 1.0);

            // vTextureCoord = aTextureCoord;
            if(uOffScreen)
              vColor = offColor;
            else 
              vColor = aColor;
        }
    `;

  static fragmentShader = `
        precision highp float;
        // varying highp vec2 vTextureCoord;
        varying vec4 vColor;
        // uniform sampler2D u_texture;

        void main() {
            gl_FragColor = vColor;
        }
    `;

  constructor(core: Trajectoolkit, props: TrajectoryGroupProps) {
    this.core = core;
    this.drawSize = 0;
    this.props = props;
    if (!this.core.trajectoryRendering.gl)
      throw new Error('webgl not initialized!');
    // 创建着色器程序
    this.program = createProgram(
      this.core.trajectoryRendering.gl,
      TrajectoryGroup.vertexShader,
      TrajectoryGroup.fragmentShader
    );

    this._createTrajectoryElements(props.data());
    this._createArrayBuffers();
  }

  public setGroupStyle(type: styleType, value: number | number[]) {
    for (const element in this.elementDict) {
      this.elementDict[element].setStyle(type, value);
    }
  }

  public getTrajectoryById(id: string) {
    return this.elementDict[id];
  }

  public getStartPoint() {
    const points: Trajectorypoint[] = [];
    for (const id in this.elementDict) {
      const trajectory = this.elementDict[id];
      points.push(trajectory.startPoint);
    }
    return points;
  }

  public getEndPoint() {
    const points: Trajectorypoint[] = [];
    for (const id in this.elementDict) {
      const trajectory = this.elementDict[id];
      points.push(trajectory.endPoint);
    }
    return points;
  }

  private _createTrajectoryElements(data: Trajectory[]) {
    data.forEach((traj) => {
      // check
      if (traj.shapingPoints.length >= 2) {
        const newTrajectory = new TrajectoryElement(traj, this.program, this);

        const newid = traj.id;
        const c = new ColorConverter(newTrajectory.offColor);
        this.colorMap.set(c.Hex(), newid);
        if (newid in this.elementDict) throw new Error('duplicated id!');
        this.elementDict[newid] = newTrajectory;
      }
    });
  }

  private _createArrayBuffers() {
    const packedTrajectories: renderInfos[] = [];
    const colorFunc = this.props.style.color;
    const opacityFunc = this.props.style.opacity;
    const widthFunc = this.props.style.width;

    for (const elementid in this.elementDict) {
      const element = this.elementDict[elementid];
      const points = element.detailedTrajectory.shapingPoints.map((p) => {
        const color =
          colorFunc.type == 'static'
            ? new ColorConverter(colorFunc.value as ColorInput).RGBA()
            : colorFunc.type == 'gradient'
            ? (colorFunc.value as (P: Trajectorypoint) => d3.RGBColor)(p)
            : (colorFunc.value as ((T: Trajectory) => d3.RGBColor))(element.detailedTrajectory);
        const opacity =
          opacityFunc.type == 'static'
            ? opacityFunc.value
            : opacityFunc.type == 'gradient'
            ? (opacityFunc.value as (P: Trajectorypoint) => number)(p)
            : (opacityFunc.value as (T: Trajectory) => number)(element.detailedTrajectory);

        const width =
          widthFunc.type == 'static'
            ? widthFunc.value
            : widthFunc.type == 'gradient'
            ? (widthFunc.value as (P: Trajectorypoint) => number)(p)
            : (widthFunc.value as (T: Trajectory) => number)(element.detailedTrajectory);

        const coloropacity = [
          color.r / 255,
          color.g / 255,
          color.b / 255,
          opacity
        ];

        return {
          location: [p.basePoint.position.lat, p.basePoint.position.lng],
          color: coloropacity,
          width: width
        } as pointRenderInfo;
      });
      const packedPoints: renderInfos = {
        element,
        trajectory: [] as pointRenderInfo[][]
      };

      points.forEach((point, index) => {
        const previousPoint = index !== 0 ? points[index - 1] : point;
        const afterPoint =
          index !== points.length - 1 ? points[index + 1] : point;
        packedPoints.trajectory.push([point, previousPoint, afterPoint]);
      });
      packedTrajectories.push(packedPoints);
    }

    this._createVerticesArray(packedTrajectories);
  }

  pick(point: mapboxgl.Point) {
    const gl = this.core.trajectoryRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    // 绑定帧缓冲区
    gl.bindFramebuffer(
      gl.FRAMEBUFFER,
      this.core.trajectoryRendering.frameBuffer
    );

    // 读取像素
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
    bufferName: bufferType,
    startIndex: number,
    data: number[]
  ) {
    const gl = this.core.trajectoryRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[bufferName]);
    const offset = startIndex * Float32Array.BYTES_PER_ELEMENT;
    gl.bufferSubData(gl.ARRAY_BUFFER, offset, new Float32Array(data));

    this.draw();
  }

  private _createVerticesArray(packedTrajectories: renderInfos[]) {
    const verticesArray: number[][] = [];
    const aCornerArray: number[][] = [];
    // color, width, miterlength for triangles
    const colorArray: number[][] = [];
    const offScreenColorArray: number[][] = [];
    const widthArray: number[] = [];

    let drawSize = 0;
    const roundStep = 20;

    const resolvePack = (pack: number[][]): void => {
      pack?.forEach((item) => {
        verticesArray.push(item);
      });
    };

    packedTrajectories.forEach((trajectory) => {
      const offScreenColor = trajectory.element.offColor;
      const packedPoints = trajectory.trajectory;
      const capStyle = this.props.capStyle;
      const startVetexIndex = drawSize;

      packedPoints?.forEach((pack, index) => {
        // const previousColor = pack[1].color;
        const currentColor = pack[0].color;
        const afterColor = pack[2].color;

        // const previousWidth = pack[1].width;
        const currentWidth = pack[0].width;
        const afterWidth = pack[2].width;

        if (index === 0) {
          switch (capStyle) {
            case 'round': {
              drawSize += this._createRoundLineCap(
                Math.PI / 2,
                (3 * Math.PI) / 2,
                roundStep,
                () => resolvePack(pack.map((p) => p.location)),
                aCornerArray,
                colorArray,
                offScreenColorArray,
                widthArray,
                currentColor,
                offScreenColor,
                currentWidth
              );
              break;
            }
            case 'square':
              drawSize += this._createSquareLineCap(
                -1,
                () => resolvePack(pack.map((p) => p.location)),
                aCornerArray,
                colorArray,
                offScreenColorArray,
                widthArray,
                currentColor,
                offScreenColor,
                currentWidth
              );

              break;
            default:
              break;
          }
        }

        // Draw end cap
        if (index === packedPoints.length - 1) {
          switch (capStyle) {
            case 'round':
              drawSize += this._createRoundLineCap(
                -Math.PI / 2,
                Math.PI / 2,
                roundStep,
                () => resolvePack(pack.map((p) => p.location)),
                aCornerArray,
                colorArray,
                offScreenColorArray,
                widthArray,
                currentColor,
                offScreenColor,
                currentWidth
              );

              break;
            case 'square':
              drawSize += this._createSquareLineCap(
                1,
                () => resolvePack(pack.map((p) => p.location)),
                aCornerArray,
                colorArray,
                offScreenColorArray,
                widthArray,
                currentColor,
                offScreenColor,
                currentWidth
              );
              break;
            default:
              break;
          }
          return;
        }

        // Triangle for left miter
        resolvePack(pack.map((p) => p.location));
        resolvePack(pack.map((p) => p.location));
        resolvePack(pack.map((p) => p.location));
        aCornerArray.push([-1, 0, 0, 0]);
        aCornerArray.push([1, 0, 0, 0]);
        aCornerArray.push([0, -1, 0, 0]);

        colorArray.push(currentColor);
        colorArray.push(currentColor);
        colorArray.push(currentColor);

        offScreenColorArray.push(offScreenColor);
        offScreenColorArray.push(offScreenColor);
        offScreenColorArray.push(offScreenColor);

        widthArray.push(currentWidth);
        widthArray.push(currentWidth);
        widthArray.push(currentWidth);

        // Triangle for right miter
        resolvePack(pack.map((p) => p.location));
        resolvePack(pack.map((p) => p.location));
        resolvePack(pack.map((p) => p.location));
        aCornerArray.push([-1, 0, 0, 0]);
        aCornerArray.push([1, 0, 0, 0]);
        aCornerArray.push([0, 1, 0, 0]);

        colorArray.push(currentColor);
        colorArray.push(currentColor);
        colorArray.push(currentColor);

        offScreenColorArray.push(offScreenColor);
        offScreenColorArray.push(offScreenColor);
        offScreenColorArray.push(offScreenColor);

        widthArray.push(currentWidth);
        widthArray.push(currentWidth);
        widthArray.push(currentWidth);

        // Triangle for connection
        resolvePack(pack.map((p) => p.location));
        resolvePack(pack.map((p) => p.location));
        resolvePack(packedPoints[index + 1].map((p) => p.location));

        aCornerArray.push([1, 1, 0, 0]);
        aCornerArray.push([-1, 1, 0, 0]);
        aCornerArray.push([-1, -1, 0, 0]);

        colorArray.push(currentColor);
        colorArray.push(currentColor);
        colorArray.push(afterColor);

        offScreenColorArray.push(offScreenColor);
        offScreenColorArray.push(offScreenColor);
        offScreenColorArray.push(offScreenColor);

        widthArray.push(currentWidth);
        widthArray.push(currentWidth);
        widthArray.push(afterWidth);

        // Triangle for connection
        resolvePack(pack.map((p) => p.location));
        resolvePack(packedPoints[index + 1].map((p) => p.location));
        resolvePack(packedPoints[index + 1].map((p) => p.location));

        aCornerArray.push([1, 1, 0, 0]);
        aCornerArray.push([1, -1, 0, 0]);
        aCornerArray.push([-1, -1, 0, 0]);

        colorArray.push(currentColor);
        colorArray.push(afterColor);
        colorArray.push(afterColor);

        offScreenColorArray.push(offScreenColor);
        offScreenColorArray.push(offScreenColor);
        offScreenColorArray.push(offScreenColor);

        widthArray.push(currentWidth);
        widthArray.push(afterWidth);
        widthArray.push(afterWidth);

        drawSize += 3 * 4;
      });

      trajectory.element.storeColor(
        this._convertPointToBuffer(
          colorArray.slice(startVetexIndex, colorArray.length),
          4
        )
      );
      trajectory.element.setBufferIndex(
        startVetexIndex,
        drawSize - startVetexIndex
      );
    });

    this.drawSize = drawSize;

    const gl = this.core.trajectoryRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    // Buffer previous, current and next points
    const verticesBuffer = createArrayBuffer(
      gl,
      new Float32Array(this._convertPointToBuffer(verticesArray, 2))
    );

    // Buffer acorner
    const acornerBuffer = createArrayBuffer(
      gl,
      new Float32Array(this._convertPointToBuffer(aCornerArray, 4))
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

    // Buffer width
    const widthBuffer = createArrayBuffer(gl, new Float32Array(widthArray));

    // console.log(widthArray, colorArray, verticesArray);
    this.buffers = {
      vertices: verticesBuffer,
      color: colorBuffer,
      offcolor: offColorBuffer,
      acorner: acornerBuffer,
      width: widthBuffer
    };
  }

  /**
   * Create round line cap
   */
  _createRoundLineCap(
    startAngle: number,
    endAngle: number,
    resolution: number,
    resolvePack: CallbackFunction,
    aCornerArray: number[][],
    colorArray: number[][],
    offScreenColorArray: number[][],
    widthArray: number[],
    color: number[],
    offScreenColor: number[],
    width: number
  ) {
    const delta = (endAngle - startAngle) / resolution;
    let countSize = 0;

    for (let angle = startAngle; angle < endAngle; angle += delta) {
      // Draw sector triangle
      resolvePack();
      resolvePack();
      resolvePack();

      const xAxis1 = Math.cos(angle);
      const yAxis1 = Math.sin(angle);

      const xAxis2 = Math.cos(angle + delta);
      const yAxis2 = Math.sin(angle + delta);

      aCornerArray.push([0, 0, 0, 0]);
      aCornerArray.push([0, 0, xAxis1, yAxis1]);
      aCornerArray.push([0, 0, xAxis2, yAxis2]);

      colorArray.push(color);
      colorArray.push(color);
      colorArray.push(color);

      offScreenColorArray.push(offScreenColor);
      offScreenColorArray.push(offScreenColor);
      offScreenColorArray.push(offScreenColor);

      widthArray.push(width);
      widthArray.push(width);
      widthArray.push(width);

      countSize += 3;
    }

    return countSize;
  }

  /**
   * Create square line cap
   */
  _createSquareLineCap(
    direction: number,
    resolvePack: CallbackFunction,
    aCornerArray: number[][],
    colorArray: number[][],
    offScreenColorArray: number[][],
    widthArray: number[],
    color: number[],
    offScreenColor: number[],
    width: number
  ) {
    // Draw up sector triangle
    resolvePack();
    resolvePack();
    resolvePack();

    aCornerArray.push([0, 0, 0, 0]);
    aCornerArray.push([0, 0, 0, 1]);
    aCornerArray.push([0, 0, 1 * direction, 1]);

    colorArray.push(color);
    colorArray.push(color);
    colorArray.push(color);

    offScreenColorArray.push(offScreenColor);
    offScreenColorArray.push(offScreenColor);
    offScreenColorArray.push(offScreenColor);

    widthArray.push(width);
    widthArray.push(width);
    widthArray.push(width);

    // Draw middle sector triangle
    resolvePack();
    resolvePack();
    resolvePack();
    aCornerArray.push([0, 0, 0, 0]);
    aCornerArray.push([0, 0, 1 * direction, 1]);
    aCornerArray.push([0, 0, 1 * direction, -1]);

    colorArray.push(color);
    colorArray.push(color);
    colorArray.push(color);

    offScreenColorArray.push(offScreenColor);
    offScreenColorArray.push(offScreenColor);
    offScreenColorArray.push(offScreenColor);

    widthArray.push(width);
    widthArray.push(width);
    widthArray.push(width);

    // Draw bottom sector triangle
    resolvePack();
    resolvePack();
    resolvePack();
    aCornerArray.push([0, 0, 0, 0]);
    aCornerArray.push([0, 0, 0, -1]);
    aCornerArray.push([0, 0, 1 * direction, -1]);

    colorArray.push(color);
    colorArray.push(color);
    colorArray.push(color);

    offScreenColorArray.push(offScreenColor);
    offScreenColorArray.push(offScreenColor);
    offScreenColorArray.push(offScreenColor);

    widthArray.push(width);
    widthArray.push(width);
    widthArray.push(width);

    return 3 * 3;
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

  // handleSelection() {
  //   const selection = this.props.selections;
  //   if (!selection) return;
  //   for (const id in this.elementDict) {
  //     const T = this.elementDict[id];
  //     const variables = {} as { [key: string]: string };

  //     const condition = selection.replace(
  //       /#\[(\w+)\]/g,
  //       (match: any, variable: any) => {
  //         const name = match.slice(2, -1);
  //         variables[name] = this.core.getSelectionByID(name);
  //         return `variables.${variable}.match(T,'trajectory')`;
  //       }
  //     );

  //     if (eval(condition)) {
  //       const colors = T.getColor();
  //       for (let i = 1; i < colors.length; i += 2) {
  //         colors[i] = 1;
  //       }
  //       T.setStyle('color', colors);
  //       for (let i = 1; i < colors.length; i += 2) {
  //         colors[i] = 0;
  //       }
  //     } else {
  //       T.setStyle('color', T.getColor());
  //     }
  //   }
  // }

  drawOffScreen() {
    const gl = this.core.trajectoryRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');

    // offscreen switch
    gl.uniform1i(gl.getUniformLocation(this.program, 'uOffScreen'), 1);

    // 绑定帧缓冲区
    gl.bindFramebuffer(
      gl.FRAMEBUFFER,
      this.core.trajectoryRendering.frameBuffer
    );

    // 进行渲染操作...
    gl.drawArrays(gl.TRIANGLES, 0, this.drawSize);

    // 解绑帧缓冲区，恢复到默认的帧缓冲区
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private bufferSetting() {
    const gl = this.core.trajectoryRendering.gl;
    if (!gl) throw new Error('webgl not initialized!');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['vertices']);
    // Buffer previous, current and next points
    const aPosition = gl.getAttribLocation(this.program, 'llPosition');
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 6 * 4, 0);
    gl.enableVertexAttribArray(aPosition);

    const aPrevious = gl.getAttribLocation(this.program, 'llPrevious');
    gl.vertexAttribPointer(aPrevious, 2, gl.FLOAT, false, 6 * 4, 2 * 4);
    gl.enableVertexAttribArray(aPrevious);

    const aAfter = gl.getAttribLocation(this.program, 'llAfter');
    gl.vertexAttribPointer(aAfter, 2, gl.FLOAT, false, 6 * 4, 4 * 4);
    gl.enableVertexAttribArray(aAfter);

    // Buffer acorner
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['acorner']);
    const aCorner = gl.getAttribLocation(this.program, 'aCorner');
    gl.vertexAttribPointer(aCorner, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aCorner);

    // Buffer off screen color
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['offcolor']);
    const offColor = gl.getAttribLocation(this.program, 'offColor');
    gl.vertexAttribPointer(offColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(offColor);

    // Buffer color
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['color']);
    const aColor = gl.getAttribLocation(this.program, 'aColor');
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColor);

    // Buffer width
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers['width']);
    const aWidth = gl.getAttribLocation(this.program, 'aWidth');
    gl.vertexAttribPointer(aWidth, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aWidth);
  }

  draw() {
    const gl = this.core.trajectoryRendering.gl;
    if (!gl || !this.core.map) throw new Error('webgl not initialized!');

    gl.useProgram(this.program);
    this.bufferSetting();
    const map = this.core.map;
    if (!map) throw new Error('map not initialized!');
    const zoom = map.getZoom();
    const center = map.getCenter();
    const { maxZoom, minZoom } = this.props;

    if (maxZoom && zoom > maxZoom) return;
    if (minZoom && zoom < minZoom) return;
    const centerP = EPSG3857_project(center, zoom);

    const translation: [number, number] = [
      gl.canvas.width / 2 - centerP.x,
      gl.canvas.height / 2 - centerP.y
    ];
    const scale: [number, number] = [zoom2scale(zoom), zoom2scale(zoom)];

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
      getPixelLength(this.core.map, 3)
    );

    //on screen
    gl.uniform1i(gl.getUniformLocation(this.program, 'uOffScreen'), 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.drawSize);

    this.drawOffScreen();
  }
}
