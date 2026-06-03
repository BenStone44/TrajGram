import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { ColorConverter } from '../../utils/utils_color';
import type { Trajectoolkit } from '../../Trajectoolkit';
import type {
  AreaFeature,
  AreaStyleMappingFunction,
  EncodingSettings
} from '../types';

const AREA_COLOR_KEY = '__trajgram_area_color';
const AREA_OPACITY_KEY = '__trajgram_area_opacity';
const AREA_WIDTH_KEY = '__trajgram_area_width';

const isPolygonFeature = (
  feature: Feature
): feature is Feature<Polygon | MultiPolygon> =>
  feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon';

const toAreaFeatureCollection = (
  data: FeatureCollection | Feature | null
): FeatureCollection | null => {
  if (!data) return null;

  const features = data.type === 'FeatureCollection' ? data.features : [data];
  const polygonFeatures = features.filter(isPolygonFeature).map((feature) => ({
    ...feature,
    properties: { ...(feature.properties ?? {}) }
  }));

  return {
    type: 'FeatureCollection',
    features: polygonFeatures
  };
};

const resolveColor = (value: AreaStyleMappingFunction['color'], feature: AreaFeature) => {
  if (value.type === 'static') {
    return value.value;
  }

  const result = value.value(feature);
  return typeof result === 'string' ? result : new ColorConverter(result).Hex();
};

const resolveNumber = (
  value: AreaStyleMappingFunction['opacity'] | AreaStyleMappingFunction['width'],
  feature: AreaFeature
) => {
  if (value.type === 'static') {
    return value.value;
  }
  return value.value(feature);
};

export class AreaEncoding {
  public static type = 'area';
  private core: Trajectoolkit;
  private setting: EncodingSettings;
  private style: AreaStyleMappingFunction;
  private sourceId: string;
  private fillLayerId: string;
  private lineLayerId: string;
  private cachedData: FeatureCollection | Feature | null = null;

  constructor(
    setting: EncodingSettings,
    style: AreaStyleMappingFunction,
    core: Trajectoolkit
  ) {
    this.setting = setting;
    this.style = style;
    this.core = core;
    this.sourceId = `${setting.id}-source`;
    this.fillLayerId = `${setting.id}-fill`;
    this.lineLayerId = `${setting.id}-outline`;
  }

  public async update(data: FeatureCollection | Feature | null) {
    this.cachedData = data;
    this.draw();
  }

  public draw() {
    if (!this.core.map) {
      throw new Error('map not initialized!');
    }

    const map = this.core.map;
    const source = toAreaFeatureCollection(this.cachedData);
    this.clear();

    if (!source || source.features.length === 0) {
      return;
    }

    const styledSource: FeatureCollection = {
      type: 'FeatureCollection',
      features: source.features.map((feature) => {
        const areaFeature = feature as AreaFeature;
        return {
          ...feature,
          properties: {
            ...(feature.properties ?? {}),
            [AREA_COLOR_KEY]: resolveColor(this.style.color, areaFeature),
            [AREA_OPACITY_KEY]: resolveNumber(this.style.opacity, areaFeature),
            [AREA_WIDTH_KEY]: resolveNumber(this.style.width, areaFeature)
          }
        };
      })
    };

    map.addSource(this.sourceId, {
      type: 'geojson',
      data: styledSource
    });

    map.addLayer({
      id: this.fillLayerId,
      type: 'fill',
      source: this.sourceId,
      paint: {
        'fill-color': ['get', AREA_COLOR_KEY],
        'fill-opacity': ['get', AREA_OPACITY_KEY]
      }
    });

    map.addLayer({
      id: this.lineLayerId,
      type: 'line',
      source: this.sourceId,
      paint: {
        'line-color': ['get', AREA_COLOR_KEY],
        'line-width': ['get', AREA_WIDTH_KEY],
        'line-opacity': ['get', AREA_OPACITY_KEY]
      }
    });
  }

  public clear() {
    if (!this.core.map) {
      return;
    }

    const map = this.core.map;
    if (map.getLayer(this.lineLayerId)) {
      map.removeLayer(this.lineLayerId);
    }
    if (map.getLayer(this.fillLayerId)) {
      map.removeLayer(this.fillLayerId);
    }
    if (map.getSource(this.sourceId)) {
      map.removeSource(this.sourceId);
    }
  }
}
