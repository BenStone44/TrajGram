/**
 @author Shifu chen <shifu.chen@outlook.com>
 @description enter class of trajectoolkit
 */
import { Map as MapboxMap, type IControl } from 'mapbox-gl';
import {
  TrajectoryGroup,
  type TrajectoryGroupProps
} from './render-manager/trajectory-group';

import * as d3 from 'd3';

import {
  TrajectoryPointGroup,
  type TrajectoryPointGroupProps
} from './render-manager/trajectory-point-group';
import { Query, type QuerySetting } from './query/query';
import { Selection, type SelectionProps } from './selection/selection';
import { Data, type DataProps, type DataSetting } from './data-management/data';
import { Encoding, type EncodingSettings } from './encoding/encoding';
import {
  TrajectoryMarkerGroup,
  type TrajectoryMarkerGroupProps
} from './render-manager/trajectory-marker-group';
import {
  TrajectoryTextGroup,
  type TrajectoryTextGroupProps
} from './render-manager/trajectory-text-group';
import type { MouseSelection } from './selection/mouse';
/**
 * Implements Mapbox [IControl](https://docs.mapbox.com/mapbox-gl-js/api/markers/#icontrol) interface
 */

export type GlRenderingManager = TrajectoryPointGroup | TrajectoryGroup;

export type RelationTreeNode = Data | Query | Selection | Encoding;

export type QueryEvent = 'update';

export const RenderNodeTypes = ['arrows', 'markers', 'points', 'trajectories'];
export const DataNodeTypes = [
  'trajectorydata',
  'roadnetwork',
  'geojson',
  'filter',
  'segmentation',
  'aggregation',
  'mouse.hover',
  'mouse.click'
];

interface GlRendering {
  gl: WebGL2RenderingContext | null;
  frameBuffer: WebGLFramebuffer | null;
  groups: Map<string, GlRenderingManager>;
  container: HTMLCanvasElement | null;
}
interface MarkerRendering {
  groups: Map<string, TrajectoryMarkerGroup>;
}
interface TextRendering {
  groups: Map<string, TrajectoryTextGroup>;
}
export class Trajectoolkit implements IControl {
  public SVG: SVGSVGElement | null = null;
  public AnnotationsSVG: SVGSVGElement | null = null;
  public map: MapboxMap | null = null;
  private _container: HTMLDivElement | null = null;

  public trajectoryRendering: GlRendering;
  public pointRendering: GlRendering;
  public markerRendering: MarkerRendering;
  public textRendering: TextRendering;

  // for parser
  public roadnetwork = new Map<string, any>();
  private _encodings = new Map<string, Encoding>();
  private _queries = new Map<string, Query>();
  private _data = new Map<string, Data>();
  private _selections = new Map<string, Selection>();

  public markers: any[] = [];

  public _baseUrl: string = '';

  constructor(baseUrl?: string) {
    this.trajectoryRendering = {
      gl: null,
      frameBuffer: null,
      groups: new Map<string, TrajectoryGroup>(),
      container: null
    };
    this.pointRendering = {
      gl: null,
      frameBuffer: null,
      groups: new Map<string, TrajectoryPointGroup>(),
      container: null
    };
    this.markerRendering = { groups: new Map<string, TrajectoryMarkerGroup>() };
    this.textRendering = { groups: new Map<string, TrajectoryTextGroup>() };

    if (baseUrl) {
      this._baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    }
  }

    // 简化的 API 调用方法
  public async get(endpoint: string) {
    try {
      const response = await fetch(`${this._baseUrl}${endpoint}`);
      const data = await response.json();
      console.log(data)
      return data;
    } catch (error) {
      console.error('请求失败:', error);
      throw error;
    }
  }

  // PUT 请求方法
  public async put(endpoint: string, data?: any) {
    try {
      const response = await fetch(`${this._baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined
      });
      
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error('PUT请求失败:', error);
      throw error;
    }
  }

  public setData(id: string, data: Data) {
    const data_id = 'd_' + id;
    this._data.set(data_id, data);
  }

  public getDataByID(id: string) {
    const data_id = 'd_' + id;
    return this._data.get(data_id);
  }

  public setSelection(id: string, selection: Selection) {
    const selection_id = 's_' + id;
    this._selections.set(selection_id, selection);
  }

  public getSelectionByID(id: string) {
    const selection_id = 's_' + id;
    return this._selections.get(selection_id);
  }

  public setQuery(id: string, queryitem: any) {
    const query_id = 'q_' + id;
    this._queries.set(query_id, queryitem);
  }

  public getQueryByID(id: string) {
    const query_id = 'q_' + id;
    return this._queries.get(query_id);
  }

  public setEncoding(id: string, encodingitem: Encoding) {
    const encoding_id = 'e_' + id;
    this._encodings.set(encoding_id, encodingitem);
  }

  public getEncoding(id: string) {
    const encoding_id = 'e_' + id;
    return this._encodings.get(encoding_id);
  }

  public getTrajectoryGroupByid(id: string) {
    return this.trajectoryRendering.groups.get(id);
  }

  public getPointGroupByid(id: string) {
    return this.pointRendering.groups.get(id);
  }
  public getMarkerGroupByid(id: string) {
    return this.markerRendering.groups.get(id);
  }
  public getTextGroupByid(id: string) {
    return this.textRendering.groups.get(id);
  }

  // 修改 getDQSDatabyID 函数，解析后端返回的数据
  public async getDQSDatabyID(id: string): Promise<any> {
    // 如果配置了后端URL，从后端获取数据
    if (this._baseUrl) {
      try {
        const response = await this.get(`/api/dqs/${id}/data`);
        // 解析后端返回的数据格式 {success: true, id: 'trajectory_data', data: Array(1458)}
        if (response && response.success && response.data) {
          return response.data;
        }
        return response;
      } catch (error) {
        console.warn('从后端获取数据失败，尝试本地数据:', error);
        // 后端获取失败时fallback到本地数据
      }
    }
    
    // 本地数据获取
    return (
      this.getDataByID(id)?.data ||
      this.getQueryByID(id)?.queryResult() ||
      (this.getSelectionByID(id)?.component as MouseSelection).MouseSelectionResult
    );
  }


  public getDQSbyID(id: string) {
    return (
      this.getDataByID(id) || this.getQueryByID(id) || this.getSelectionByID(id)
    );
  }

  public getLensNum() {
    let count = 0;
    for (const value of this._selections.values()) {
      if (value.type.split('.')[0] == 'lens') count += 1;
    }
    return count;
  }

  public addDataByProps(dataprop: DataProps) {
    const newData = new Data(dataprop);
    this.setData(dataprop.id, newData);
    return newData;
  }

  public addSelectionByJson(props: SelectionProps) {
    const newSelection = new Selection(props, this);
    this.setSelection(props.id, newSelection);
    return newSelection;
  }

  public addQueryByJson(json: QuerySetting) {
    const newQuery = new Query(json, this);
    this.setQuery(json.id, newQuery);
    return newQuery;
  }

  public addEncodingByJson(json: EncodingSettings) {
    const newEncoding = new Encoding(json, this);
    this.setEncoding(json.id, newEncoding);
    return newEncoding;
  }

  private _enableOpacity() {
    const gl_t = this.trajectoryRendering.gl;
    const gl_p = this.pointRendering.gl;
    if (gl_t) {
      gl_t.enable(gl_t.BLEND);
      gl_t.blendFunc(gl_t.SRC_ALPHA, gl_t.ONE_MINUS_SRC_ALPHA);
    }

    if (gl_p) {
      gl_p.enable(gl_p.BLEND);
      gl_p.blendFunc(gl_p.SRC_ALPHA, gl_p.ONE_MINUS_SRC_ALPHA);
    }
  }

  private _initFrameBuffer(glPack: GlRendering) {
    // 创建帧缓冲区对象
    const gl = glPack.gl;
    if (!gl) throw new Error('gl not initialized');
    const frameBuffer = gl.createFramebuffer();
    if (!frameBuffer) throw new Error('create buffer failed');
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

    // 创建纹理对象
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.canvas.width,
      gl.canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 将纹理附加到帧缓冲区
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    // 检查帧缓冲区的完整性
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('create buffer failed');
    }

    // 解绑帧缓冲区和纹理
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // 返回帧缓冲区对象
    glPack.frameBuffer = frameBuffer;
  }

  /** Called when the control is added to a map */
  onAdd(map: MapboxMap): HTMLDivElement {
    this.map = map;
    this._container = this._onAddOverlaid(map);
    this._createSVGandCanvasContainer();
    this._createAnnotationsSVG();
    if (this.trajectoryRendering.gl)
      this._initFrameBuffer(this.trajectoryRendering);
    if (this.pointRendering.gl) this._initFrameBuffer(this.pointRendering);

    this._enableOpacity();
    return this._container;
  }

  getDefaultPosition = () => {
    return "top-left" as any;
  };

  private _createContainer() {
    const container = document.createElement('div');
    if (!container) throw new Error('Crate div element error!');
    this._container = container;
    if (this.map && this._container) {
      Object.assign(container.style, {
        position: 'absolute'
      });
    }

    return container;
  }
  private _createAnnotationsSVG() {
    if (this._container && this.map) {
      const { clientWidth, clientHeight } = this.map.getContainer();

      // 创建 SVG 元素
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      svg.style.width = `${clientWidth}px`;
      svg.style.height = `${clientHeight}px`;
      svg.style.zIndex = '10';

      Object.assign(svg.style, {
        position: 'absolute',
        PointerEvent: 'all',
        left: 0,
        top: 0
      });

      // 将 SVG 添加到容器中
      this._container.appendChild(svg);
      this.AnnotationsSVG = svg;
    }
  }
  private _createSVGandCanvasContainer() {
      if (this._container && this.map) {
        const { clientWidth, clientHeight } = this.map.getContainer();

        // 创建 SVG 元素
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.width = `${clientWidth}px`;
        svg.style.height = `${clientHeight}px`;
        svg.style.zIndex = '10';

        Object.assign(svg.style, {
          position: 'absolute',
          PointerEvent: 'all',
          left: 0,
          top: 0
        });

        this._container.appendChild(svg);
        this.SVG = svg;

        // 创建trajectory container
        const canvas_t = document.createElement('canvas');
        if (!canvas_t) throw new Error('Crate canvas element error!');
        canvas_t.width = clientWidth;
        canvas_t.height = clientHeight;
        this._container.appendChild(canvas_t);

        // 关键：在获取上下文时指定深度缓冲区
        const gl_t = canvas_t.getContext('webgl2', {
          depth: true,        // 启用深度缓冲区
          stencil: false,
          antialias: true,
          alpha: true,
          premultipliedAlpha: false
        });
        
        if (!gl_t) throw new Error('webgl2 is not supported!');
        
        // 设置深度测试
        gl_t.enable(gl_t.DEPTH_TEST);
        gl_t.depthFunc(gl_t.LESS);  // 改为 LESS
        gl_t.clearDepth(1.0);       // 设置清除深度值
        
        this.trajectoryRendering.container = canvas_t;
        this.trajectoryRendering.gl = gl_t;

        // 创建point container
        const canvas_p = document.createElement('canvas');
        if (!canvas_p) throw new Error('Crate canvas element error!');
        canvas_p.width = clientWidth;
        canvas_p.height = clientHeight;
        this._container.appendChild(canvas_p);

        // 同样为点渲染启用深度缓冲区
        const gl_p = canvas_p.getContext('webgl2', {
          depth: true,
          stencil: false,
          antialias: true,
          alpha: true,
          premultipliedAlpha: false
        });
        
        if (!gl_p) throw new Error('webgl2 is not supported!');
        
        gl_p.enable(gl_p.DEPTH_TEST);
        gl_p.depthFunc(gl_p.LESS);
        gl_p.clearDepth(1.0);
        
        this.pointRendering.container = canvas_p;
        this.pointRendering.gl = gl_p;

        this._updateContainerSize();
      }
  }

  public clearSVG() {
    if (this.SVG) d3.select(this.SVG).selectAll('*').remove();
  }
  public clearAnnotationsSVG() {
    if (this.AnnotationsSVG)
      d3.select(this.AnnotationsSVG).selectAll('*').remove();
  }
  public addPointGroup(info: TrajectoryPointGroupProps): TrajectoryPointGroup {
    const newlayer = new TrajectoryPointGroup(this, info);
    this.pointRendering.groups.set(info.id, newlayer);
    this._refresh()
    return newlayer;
  }

  public addTrajectoryGroup(info: TrajectoryGroupProps) {
    const newlayer = new TrajectoryGroup(this, info);
    this.trajectoryRendering.groups.set(info.id, newlayer);
    this._refresh()
    return newlayer;
  }

  public addMarkerGroup(
    info: TrajectoryMarkerGroupProps
  ): TrajectoryMarkerGroup {
    const newlayer = new TrajectoryMarkerGroup(this, info);
    this.markerRendering.groups.set(info.id, newlayer);
    newlayer.update();
    return newlayer;
  }
  public addTextGroup(info: TrajectoryTextGroupProps): TrajectoryTextGroup {
    const newlayer = new TrajectoryTextGroup(this, info);
    this.textRendering.groups.set(info.id, newlayer);
    newlayer.update();
    return newlayer;
  }
  private _onAddOverlaid(map: MapboxMap): HTMLDivElement {
    const container = this._createContainer();
    this._updateContainerSize();

    map.on('resize', () => {
      this._updateContainerSize;
      this._refresh;
    });
    map.on('zoom', this._refresh);

    map.on('drag', this._refresh);
    map.on('dragend', this._refresh);

    map.on('dragend', function () {
      map.stop();
    });

    return container;
  }

  // public addGroup(
  //   group: CanvasGroupProps
  // ): TrajectoryGroup | TrajectoryPointGroup {
  //   switch (group.type) {
  //     case 'trajectories': {
  //       if (this.trajectoryRendering.groups.get(group.id))
  //         throw new Error('duplicted group id !');
  //       return this.addTrajectoryGroup(group);
  //     }
  //     case 'points': {
  //       if (this.pointRendering.groups.get(group.id))
  //         throw new Error('duplicted group id !');
  //       return this.addPointGroup(group);
  //     }
  //     default:
  //       throw new Error('add group failed');
  //   }
  // }

  /** Called when the control is removed from a map */
  onRemove(): void {
    const map = this.map;

    if (map) {
      this._onRemoveOverlaid(map);
    }
    this._container = null;
  }

  private _onRemoveOverlaid(map: MapboxMap): void {
    map.off('resize', this._updateContainerSize);
    map.off('zoom', this._refresh);
    map.off('drag', this._refresh);
    map.off('dragend', function () {
      map.stop();
    });
    this.clearAll();
  }

  private _updateContainerSize = async () => {
    if (this.map && this._container) {
      Object.assign(this._container.style, {
        left: 0,
        top: 0
      });
      const { clientWidth, clientHeight } = this.map.getContainer();
      const trajectory_container = this.trajectoryRendering.container;
      if (trajectory_container) {
        trajectory_container.width = clientWidth;
        trajectory_container.height = clientHeight;
        Object.assign(trajectory_container.style, {
          position: 'absolute',
          left: 0,
          top: 0
        });
      }

      const point_container = this.pointRendering.container;
      if (point_container) {
        point_container.width = clientWidth;
        point_container.height = clientHeight;
        Object.assign(point_container.style, {
          position: 'absolute',
          left: 0,
          top: 0
        });
      }
    }
  };

  private clearGL = (renderPack: GlRendering) => {
    const gl = renderPack.gl;
    const frameBuffer = renderPack.frameBuffer;
    if (!gl) throw new Error('not initialized!');
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  public _refresh = () => {
    this.clearGL(this.trajectoryRendering);
    this.clearGL(this.pointRendering);
    this._drawAll();
  };

  private _drawAll() {
    for (const value of this.trajectoryRendering.groups.values()) value?.draw();
    for (const value of this.pointRendering.groups.values()) value?.draw();
    for (const value of this.markerRendering.groups.values()) value?.update();
    for (const value of this.textRendering.groups.values()) value?.update();
    for (const value of this._selections.values()) value?.draw();
  }

  public addEventLisener(
    id: string,
    type: QueryEvent,
    callBckName: string,
    callBack: () => any
  ) {
    const node = this.getDQSbyID(id);
    switch (type) {
      case 'update':
        node?.callBack.set(callBckName, callBack);
        break;
      default:
        throw new Error('wrong id!');
    }
  }

  public jsonParser = (jsonFile: any) => {
    if (this.map) {
        const dss: DataSetting[] = jsonFile.data;
        
        // 如果存在 _baseUrl，跳过数据获取但仍然添加 data
        if (this._baseUrl) {
            console.log('Base URL exists, skipping data fetch');
            
            // 直接创建带有 null data 的 dataprops
            const dataprops = dss.map((ds) => {
                return {
                    id: ds.id,
                    type: ds.type,
                    data: null
                };
            });

            dataprops.forEach((dataprop) => this.addDataByProps(dataprop));

            // 处理其他配置项
            if (jsonFile.selections) {
                const selectKeys = Object.keys(jsonFile.selections);
                selectKeys.forEach((selectKey: string) => {
                    const selectItem = jsonFile.selections[selectKey];
                    this.addSelectionByJson({ id: selectKey, type: selectItem });
                });
            }

            jsonFile.queries?.forEach((queryItem: QuerySetting) => {
                this.addQueryByJson(queryItem);
            });

            jsonFile.encodings?.forEach((encodingItem: EncodingSettings) => {
                this.addEncodingByJson(encodingItem);
            });
            
            return;
        }

        // 原有的数据获取逻辑
        const fetchPromises = dss.map((ds) => fetch(ds.url).then((response) => response.json()));
        Promise.all(fetchPromises)
            .then((results) => {
                const dataprops = results.map((result, i) => {
                    return {
                        id: dss[i].id,
                        type: dss[i].type,
                        data: result
                    };
                });

                dataprops.forEach((dataprop) => this.addDataByProps(dataprop));

                if (jsonFile.selections) {
                    const selectKeys = Object.keys(jsonFile.selections);
                    selectKeys.forEach((selectKey: string) => {
                        const selectItem = jsonFile.selections[selectKey];
                        this.addSelectionByJson({ id: selectKey, type: selectItem });
                    });
                }

                jsonFile.queries?.forEach((queryItem: QuerySetting) => {
                    this.addQueryByJson(queryItem);
                });

                jsonFile.encodings?.forEach((encodingItem: EncodingSettings) => {
                    this.addEncodingByJson(encodingItem);
                });
            })
            .catch((error) => {
                console.error('请求失败:', error);
            });
    }
  };
/**
 * 清空所有内容，包括渲染组、数据、查询、选择、编码等
 */
  public clearAll = () => {
    this.trajectoryRendering.groups.clear();
    this.pointRendering.groups.clear();
    this.markerRendering.groups.clear();
    this.textRendering.groups.clear();
    
    // 清空数据
    this._data.clear();
    // 清空查询
    this._queries.clear();
    
    this._selections.clear();
    // 清空编码
    this._encodings.clear();
    // 清空路网数据
    this.roadnetwork.clear();
    // 清空标记
    this.markers = [];
    
    // 清空SVG内容
    this.clearSVG();
    this.clearAnnotationsSVG();
    
    // 清空WebGL画布
    this.clearGL(this.trajectoryRendering);
    this.clearGL(this.pointRendering);
  };
}
