import { LngLat } from 'mapbox-gl';
import * as turf from '@turf/turf';
import * as d3 from 'd3';

export function getPixelLength(
  map: mapboxgl.Map,
  distanceInMeters: number
): number {
  // 将中心点的经纬度坐标转换为地图上的像素坐标
  const center = map.getCenter();
  const centerPixel = map.project(center);
  const point = turf.point([center.lng, center.lat]);
  const target = turf.destination(
    point,
    distanceInMeters / 1000,
    90,
  );

  // 将目标点的经纬度坐标转换为地图上的像素坐标
  const targetPixel = map.project(
    new LngLat(target.geometry.coordinates[0], target.geometry.coordinates[1])
  );

  // 计算两个像素坐标点的水平距离
  const pixelLength =
    (distanceInMeters > 0 ? 1 : -1) * Math.abs(targetPixel.x - centerPixel.x);

  return pixelLength;
}
export function numberTransformScale(
  number: number,
  originRange: number[],
  finalRange: number[]
): number {
  const scale = d3.scaleLinear().domain(originRange).range(finalRange);
  const result: number = scale(number);
  return result;
}
