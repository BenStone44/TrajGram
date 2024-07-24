import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import * as d3 from 'd3';
import mapboxgl from 'mapbox-gl';
export type MarkerInfo = {
  point: LngLat;
  color: string;
  opacity: number;
  size: number;
};

export class MarkerSVG {
  core: Trajectoolkit;
  _map: mapboxgl.Map;
  container: SVGSVGElement;
  g: d3.Selection<SVGGElement, unknown, null, undefined>;

  data: MarkerInfo;
  coordinates = { x: 0, y: 0 };
  center: LngLat;
  constructor(core: Trajectoolkit, data: MarkerInfo) {
    this.core = core;
    if (!core.AnnotationsSVG || !core.map)
      throw new Error('TKT not initialized');
    this.container = core.AnnotationsSVG;
    this._map = core.map;
    this.center = data.point;
    this.g = d3.select(this.container).append('g');

    this.data = data;
    this.coordinates = this._calculateCoordinates();

    this.draw();
  }
  private _calculateCoordinates() {
    const rp = this._map.project(this.center);

    return {
      x: rp.x,
      y: rp.y
    };
  }
  public draw() {
    const scale = this.data.size;
    //this.coordinates = this._calculateCoordinates();
    const x = this.coordinates.x;
    const y = this.coordinates.y;
    //console.log('x', x, 'y', y);
    this.remove();
    this.g = d3.select(this.container).append('g');
    this.g
      .append('path')
      .attr('transform', ` scale(${scale}) translate(${x - 14},${y - 36})`)
      .attr('transform-origin', `${x}px ${y}px`)
      .attr(
        'd',
        'M14,0 C21.732,0 28,5.641 28,12.6 C28,23.963 14,36 14,36 C14,36 0,24.064 0,12.6 C0,5.641 6.268,0 14,0 Z'
      )
      .attr('fill', this.data.color || '#000000');
    this.g
      .append('circle')
      .attr('transform', ` scale(${scale}) translate(${x - 14},${y - 36})`)
      .attr('transform-origin', `${x}px ${y}px`)
      .attr('id', 'Oval')
      .attr('fill', '#FFFFFF')
      .attr('fill-rule', 'nonzero')
      .attr('cx', 14)
      .attr('cy', 14)
      .attr('r', 7);
    //console.log('color', this.data);
    //   .attr('id', 'marker');
    // const marker = document.querySelector('#marker');
    // if (marker) {
    //   const b = marker.getBoundingClientRect();
    //   console.log('b', b);
    //   const heng = b.width / 2 + b.x - x;
    //   const shu = b.y - y + b.height;
    //   console.log('heng', heng, 'shu', shu);
    // }
    // const map = this.core.map;
    // if (map) {
    //   const marker = new mapboxgl.Marker(
    //     //el
    //     //draggable: true
    //     { color: this.data.color || '#000000' }
    //   )
    //     .setLngLat([this.center.lng, this.center.lat])
    //     .addTo(map);
    // }
  }
  public remove() {
    this.g.remove();
  }
}
