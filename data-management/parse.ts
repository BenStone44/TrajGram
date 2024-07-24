import { LngLat } from 'mapbox-gl';
import { useParseStore } from '../../store/parse';
import { Trajectoolkit } from '../Trajectoolkit';
import { type LensInfo, LensSVG, type LensType } from '../selection/lens_svg';
import { getPixelLength } from '../utils/utils_scale';
import type { QuerySetting } from '../query/query';
import type { EncodingSettings } from '../encoding/encoding';
import type { DataSetting } from './data';

type LensStyle = {
  center: [number, number];
};

export const componentParse = (type: string, style?: LensStyle) => {
  const Parse = useParseStore();
  const TKT = Parse.tkt;
  if (!TKT || !TKT.map || !TKT.SVG) return;

  return new LensSVG(TKT, type as LensType, parseLensInfo(style, TKT));
};

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

export const parseColorString = (colorString: string) => {
  const rstring1 = /gradient\(([^,]+),\s*\[\s*([^\]]+)\s*\]\)/;
  const match = colorString.match(rstring1);

  if (match) {
    const colors = match[2].split(',');
    return colors;
  } else {
    return [];
  }
};
export const parseOpacityString = (opacityString: string) => {
  const rstring = /gradient\(([^,]+),\s*\[\s*([^\]]+)\s*\]\)/;
  const match = opacityString.match(rstring);

  if (match) {
    const opacity = match[2]
      .split(',')
      .map((value) => parseFloat(value.trim()));
    return opacity;
  } else {
    return [];
  }
};

export const jsonParser = (jsonFile: any) => {
  const store = useParseStore();

  const TKT = store.tkt;
  if (TKT && TKT.map) {
    const dss: DataSetting[] = jsonFile.data;
    const fetchPromises = dss.map((ds) =>
      {
        if(ds.id=="Q3-backend"){

          return fetch('http://127.0.0.1:8000/items/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    week: [0, 7],
                    hour: [0, 24],
                    distance: [0, 1000000]
                })
            }).then((response) => response.json())
        }
        else
          return fetch(ds.url).then((response) => response.json())
      }
    );
    Promise.all(fetchPromises)
      .then((results) => {
        const dataprops = results.map((result, i) => {
          return {
            id: dss[i].id,
            type: dss[i].type,
            data: result
          };
        });

        dataprops.forEach((dataprop) => TKT.addDataByProps(dataprop));

        if (jsonFile.selections) {
          const selectKeys = Object.keys(jsonFile.selections);
          selectKeys.forEach((selectKey: string) => {
            const selectItem = jsonFile.selections[selectKey];
            TKT.addSelectionByJson({ id: selectKey, type: selectItem });
          });
        }

        jsonFile.queries?.forEach((queryItem: QuerySetting) => {
          TKT.addQueryByJson(queryItem);
        });

        jsonFile.encodings?.forEach((encodingItem: EncodingSettings) => {
          TKT.addEncodingByJson(encodingItem);
        });
      })
      .catch((error) => {
        // 如果任一请求失败，Promise.all 的 catch 将捕获到异常
        console.error('请求失败:', error);
      });
  }
};
