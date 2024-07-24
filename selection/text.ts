import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../Trajectoolkit';
import * as d3 from 'd3';
import mapboxgl from 'mapbox-gl';
// import { getPixelLength } from '../utils/utils_scale';
export type TextInfo = {
  point: LngLat;
  color: string;
  opacity: number;
  text: string;
  font_size: number;
  transform: string;
  rotate: number;
};

export class TextSVG {
  core: Trajectoolkit;
  _map: mapboxgl.Map;
  container: SVGSVGElement;
  g: d3.Selection<SVGGElement, unknown, null, undefined>;

  data: TextInfo;
  coordinates = { x: 0, y: 0 };
  center: LngLat;
  constructor(core: Trajectoolkit, data: TextInfo) {
    this.core = core;
    if (!core.AnnotationsSVG || !core.map)
      throw new Error('TKT not initialized');
    this.container = core.AnnotationsSVG;
    this._map = core.map;
    this.center = data.point;
    this.g = d3.select(this.container).append('g');

    this.data = data;
    this.coordinates = this._calculateCoordinates();
    //this.transform = this.parseTransform();

    this.draw();
  }
  private _calculateCoordinates() {
    const rp = this._map.project(this.center);

    return {
      x: rp.x,
      y: rp.y
    };
  }
  //   parseTransform(){

  //   }
  public parseTransform() {
    const initial_transform = this.data.transform;
    const regex = /translate\((-?\d*\.?\d+),\s*(-?\d*\.?\d+)\)/;
    const match = initial_transform.match(regex);

    if (match && match.length === 3) {
      const currentX = this.core.map ? parseFloat(match[1]) : 0;
      const currentY = this.core.map ? parseFloat(match[2]) : 0;

      const x = this.coordinates.x + currentX;
      const y = this.coordinates.y + currentY;

      return { x, y };
    } else {
      const x = this.coordinates.x;
      const y = this.coordinates.y;
      return { x, y };
    }
  }

  public draw() {
    //this.coordinates = this._calculateCoordinates();
    const x = this.coordinates.x;
    const y = this.coordinates.y;
    // const rectWidth = 50;
    // const rectHeight = 30;
    //console.log('x', x, 'y', y);
    this.remove();
    const transform = this.parseTransform();
    // console.log('transform', transform);
    this.g = d3.select(this.container).append('g');
    const rect = this.g
      //.attr('transform', ` translate(${x - rectWidth / 2},${y - rectHeight})`)
      // .attr('transform-origin', `${x}px ${y}px`)
      .text('text')
      .append('rect')
      .attr('fill', this.data.color || 'lightblue')
      .attr('rx', 3)
      .attr('opacity', 0.9);
    const text = this.g
      .append('text')
      .text(this.data.text)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '${this.data.font_size}px');
    //.attr('transform', ` translate(${rectWidth / 2},${rectHeight / 2})`)
    // const textElement = document.querySelector('#text');
    const textElement = text.node();
    if (textElement) {
      const b = textElement.getBBox();
      const width = b.width;
      const height = b.height;
      // console.log('width', width, 'height', height);
      //   console.log('x', x, 'y', y);
      //获取text
      text.attr(
        'transform',
        `rotate(${this.data.rotate} ${x} ${y}) translate(${transform.x},${transform.y})`
      );
      rect
        .attr('width', width + 20)
        .attr('height', height + 10)
        .attr(
          'transform',
          `rotate(${this.data.rotate} ${x} ${y}) translate(${
            transform.x - (width + 20) / 2
          },${transform.y - (height + 10) / 2}) `
        );

      // console.log(
      //   `rotate(${this.data.rotate} ${x} ${y}) translate(${transform.x},${transform.y})`
      // );
    } else {
      console.error('Text element is null or undefined.');
    }
    //attr('fill', this.data.color || '#000000')
    //.attr('id', 'marker');
    // const marker = document.querySelector('#marker');
    // if (marker) {
    //   const b = marker.getBoundingClientRect();
    //   console.log('b', b);
    //   const heng = b.width / 2 + b.x - x;
    //   const shu = b.y - y + b.height;
    //   console.log('heng', heng, 'shu', shu);
    // }
  }
  public remove() {
    this.g.remove();
  }
}
