import mapboxgl from 'mapbox-gl';
// import MapboxDraw from '@mapbox/mapbox-gl-draw';
// import FreehandMode from 'mapbox-gl-draw-freehand-mode';
// import { Feature, Geometry, GeoJsonProperties } from 'geojson';
//import * as turf from '@turf/turf';
type SelectionType = 'drawline' | 'drawpolygon' | 'drawpoint';
export class drawArea {
  // private draw: any; // Adjust the type according to your MapboxDraw typings
  // dataArray: { [key: string]: Feature<Geometry, GeoJsonProperties> } = {};
  // constructor(map: mapboxgl.Map, drawMode: SelectionType) {
  //   this.draw = new MapboxDraw({
  //     id: drawMode,
  //     controls: {
  //       point: drawMode == 'drawpoint' ? true : false,
  //       line_string: drawMode == 'drawline' ? true : false,
  //       polygon: drawMode == 'drawpolygon' ? true : false,
  //       // point: drawMode.includes('drawpoint'), // 启用绘制点
  //       // line_string: drawMode.includes('drawline'),
  //       // polygon: drawMode.includes('drawpolygon'),
  //       trash: true,
  //       combine_features: false,
  //       uncombine_features: false
  //     },
  //     modes: Object.assign(MapboxDraw.modes, {
  //       draw_polygon: FreehandMode
  //     })
  //   });

  //   map.addControl(this.draw);
  //   map.on('draw.create', () => this.updateArea());
  //   map.on('draw.delete', () => this.updateArea());
  //   map.on('draw.update', () => this.updateArea());
  // }

  // public updateArea() {
  //   const data = this.draw.getAll();
  //   if (!data || !data.features || !data.features[0]) {
  //     return;
  //   }
  //   console.log('data', data);
  // }
}
