import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import { type LensInfo} from './lens_svg';
import { getPixelLength } from '../utils/utils_scale';

export const randomComponentPosition = (TKT: Trajectoolkit) => {
  const cnum = TKT.getLensNum();
  if (TKT.map) {
    const centerP = TKT.map.project(TKT.map.getCenter());
    const point = {
      x: cnum * getPixelLength(TKT.map, 500) + centerP.x,
      y: centerP.y
    } as mapboxgl.Point;
    return TKT.map.unproject(point) as LngLat;
  }
  return {} as LngLat;
};

export const parseLensInfo = (style: any, TKT: Trajectoolkit): LensInfo => {
  const center =
    style && style.center
      ? ({ lng: style.center[0], lat: style.center[1] } as LngLat)
      : randomComponentPosition(TKT);
  if (!style) {
    return {
      point: center,
      style: {}
    };
  }

  return {
    point: center,
    style: {
      r: style.r,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth
    }
  };
};

