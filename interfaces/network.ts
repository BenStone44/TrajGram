import { LngLat } from 'mapbox-gl';

// 节点接口定义
export interface GeoNode {
  id: string;
  position: LngLat;
  attributes?: Record<string, any>;
}

// 边接口定义
export interface GeoEdge {
  from: string;
  to: string;
  attributes?: Record<string, any>;
}

// 地理网络接口定义
export interface GeoNetwork {
  nodes: GeoNode[];
  edges: GeoEdge[];
}

// 用于创建节点的辅助函数
export function createGeoNode(
  id: string, 
  lng: number, 
  lat: number, 
  attributes?: Record<string, any>
): GeoNode {
  return {
    id,
    position: new LngLat(lng, lat),
    attributes
  };
}

// 用于创建边的辅助函数
export function createGeoEdge(
  from: string, 
  to: string, 
  attributes?: Record<string, any>
): GeoEdge {
  return {
    from,
    to,
    attributes
  };
}