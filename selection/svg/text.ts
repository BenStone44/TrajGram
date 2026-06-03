import { LngLat } from 'mapbox-gl';
import { Trajectoolkit } from '../../Trajectoolkit';
import * as d3 from 'd3';

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
    if (!core.AnnotationsSVG || !core.map) {
      throw new Error('TKT not initialized');
    }
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

  public parseTransform() {
    const initialTransform = this.data.transform;
    const regex = /translate\((-?\d*\.?\d+),\s*(-?\d*\.?\d+)\)/;
    const match = initialTransform.match(regex);

    if (match && match.length === 3) {
      const currentX = parseFloat(match[1]);
      const currentY = parseFloat(match[2]);
      return {
        x: this.coordinates.x + currentX,
        y: this.coordinates.y + currentY
      };
    }

    return {
      x: this.coordinates.x,
      y: this.coordinates.y
    };
  }

  public draw() {
    const x = this.coordinates.x;
    const y = this.coordinates.y;

    this.remove();
    const transform = this.parseTransform();

    this.g = d3.select(this.container).append('g');
    const rect = this.g
      .append('rect')
      .attr('fill', '#ffffff')
      .attr('rx', 3)
      .attr('opacity', Math.min(this.data.opacity, 0.9));

    const text = this.g
      .append('text')
      .text(this.data.text)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('fill', this.data.color || '#333333')
      .attr('opacity', this.data.opacity)
      .attr('font-size', `${this.data.font_size}px`);

    const textElement = text.node();
    if (!textElement) {
      console.error('Text element is null or undefined.');
      return;
    }

    const box = textElement.getBBox();
    const width = box.width;
    const height = box.height;

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
        },${transform.y - (height + 10) / 2})`
      );
  }

  public remove() {
    this.g.remove();
  }
}
