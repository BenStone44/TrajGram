import { LngLat } from 'mapbox-gl';
import * as d3 from 'd3';
import type { GeoEdge, GeoNetwork, GeoNode } from '../../interfaces/network';
import type { Trajectory, Trajectorypoint } from '../../interfaces/trajectory';
import type { Trajectoolkit } from '../../Trajectoolkit';
import type {
  EncodingSettings,
  PointStyleMappingFunction,
  StyleMappingFunction
} from '../types';
import type { GraphResolvedLayout, GraphResolvedStyle } from './style';

type Point = {
  x: number;
  y: number;
};

type WorldNode = {
  id: string;
  position: LngLat;
  world: Point;
  attributes?: Record<string, unknown>;
};

type ScreenNode = {
  id: string;
  x: number;
  y: number;
  attributes?: Record<string, unknown>;
};

type WorldEdge = {
  id: string;
  source: WorldNode;
  target: WorldNode;
  attributes?: Record<string, unknown>;
};

type BundledEdge = {
  id: string;
  points: Point[];
  source: WorldNode;
  target: WorldNode;
  attributes?: Record<string, unknown>;
};

type CompatibilityEntry = {
  index: number;
  compatibility: number;
};

const EARTH_RADIUS = 6378137;
const MAX_LATITUDE = 85.0511287798;
const COMPATIBILITY_THRESHOLD = 0.05;
const INITIAL_SUBDIVISION_POINTS = 1;
const CYCLES = 6;
const INITIAL_ITERATIONS = 50;
const ITERATION_DECAY = 2 / 3;
const INITIAL_STEP = 0.04;

const getByPath = (source: unknown, path: string) => {
  if (!source) return undefined;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, source);
};

const toWorld = (position: LngLat): Point => {
  const d = Math.PI / 180;
  const lat = Math.max(Math.min(MAX_LATITUDE, position.lat), -MAX_LATITUDE);
  const sin = Math.sin(lat * d);
  return {
    x: EARTH_RADIUS * position.lng * d,
    y: (EARTH_RADIUS * Math.log((1 + sin) / (1 - sin))) / 2
  };
};

const toLngLat = (point: Point) => {
  const d = 180 / Math.PI;
  return new LngLat(
    (point.x / EARTH_RADIUS) * d,
    (2 * Math.atan(Math.exp(point.y / EARTH_RADIUS)) - Math.PI / 2) * d
  );
};

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const multiply = (point: Point, scalar: number): Point => ({
  x: point.x * scalar,
  y: point.y * scalar
});
const distance = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2
});
const pointOnSegment = (a: Point, b: Point, ratio: number): Point => ({
  x: a.x + (b.x - a.x) * ratio,
  y: a.y + (b.y - a.y) * ratio
});

const normalize = (vector: Point) => {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
};

const projectPointToLine = (point: Point, lineStart: Point, lineEnd: Point) => {
  const line = subtract(lineEnd, lineStart);
  const lineLengthSquared = dot(line, line);
  if (lineLengthSquared === 0) {
    return { ...lineStart };
  }
  const t = dot(subtract(point, lineStart), line) / lineLengthSquared;
  return add(lineStart, multiply(line, t));
};

const polylineLength = (points: Point[]) => {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
};

const resamplePolyline = (points: Point[], subdivisionPoints: number) => {
  const totalPoints = subdivisionPoints + 2;
  if (points.length === 2) {
    return Array.from({ length: totalPoints }, (_, index) =>
      pointOnSegment(points[0], points[1], index / (totalPoints - 1))
    );
  }

  const totalLength = polylineLength(points);
  if (totalLength === 0) {
    return Array.from({ length: totalPoints }, () => ({ ...points[0] }));
  }

  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distance(points[index - 1], points[index]));
  }

  const sampled: Point[] = [];
  for (let index = 0; index < totalPoints; index += 1) {
    const targetLength = (index / (totalPoints - 1)) * totalLength;
    let segmentIndex = 1;
    while (
      segmentIndex < cumulative.length &&
      cumulative[segmentIndex] < targetLength
    ) {
      segmentIndex += 1;
    }

    const startIndex = Math.max(0, segmentIndex - 1);
    const endIndex = Math.min(points.length - 1, segmentIndex);
    const segmentLength = cumulative[endIndex] - cumulative[startIndex];

    if (segmentLength === 0) {
      sampled.push({ ...points[startIndex] });
      continue;
    }

    const localRatio =
      (targetLength - cumulative[startIndex]) / segmentLength;
    sampled.push(pointOnSegment(points[startIndex], points[endIndex], localRatio));
  }

  return sampled;
};

const smoothPolyline = (points: Point[], passes = 1) => {
  let current = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.map((point) => ({ ...point }));
    for (let index = 1; index < current.length - 1; index += 1) {
      next[index] = {
        x:
          current[index - 1].x * 0.25 +
          current[index].x * 0.5 +
          current[index + 1].x * 0.25,
        y:
          current[index - 1].y * 0.25 +
          current[index].y * 0.5 +
          current[index + 1].y * 0.25
      };
    }
    current = next;
  }
  return current;
};

const densifyPolyline = (points: Point[], factor: number) => {
  if (points.length <= 2 || factor <= 1) {
    return points.map((point) => ({ ...point }));
  }

  const subdivisionPoints = Math.max(
    points.length - 2,
    Math.round((points.length - 1) * factor)
  );
  return resamplePolyline(points, subdivisionPoints);
};

const angleCompatibility = (edgeA: WorldEdge, edgeB: WorldEdge) => {
  const aVector = subtract(edgeA.target.world, edgeA.source.world);
  const bVector = subtract(edgeB.target.world, edgeB.source.world);
  const denominator =
    Math.sqrt(dot(aVector, aVector)) * Math.sqrt(dot(bVector, bVector));
  if (denominator === 0) {
    return 0;
  }
  return Math.abs(dot(aVector, bVector) / denominator);
};

const scaleCompatibility = (edgeA: WorldEdge, edgeB: WorldEdge) => {
  const lenA = distance(edgeA.source.world, edgeA.target.world);
  const lenB = distance(edgeB.source.world, edgeB.target.world);
  if (lenA === 0 || lenB === 0) {
    return 0;
  }
  const lavg = (lenA + lenB) / 2;
  return 2 / (lavg / Math.min(lenA, lenB) + Math.max(lenA, lenB) / lavg);
};

const positionCompatibility = (edgeA: WorldEdge, edgeB: WorldEdge) => {
  const lenA = distance(edgeA.source.world, edgeA.target.world);
  const lenB = distance(edgeB.source.world, edgeB.target.world);
  const lavg = (lenA + lenB) / 2;
  const midA = midpoint(edgeA.source.world, edgeA.target.world);
  const midB = midpoint(edgeB.source.world, edgeB.target.world);
  return lavg / (lavg + distance(midA, midB));
};

const edgeVisibility = (edgeA: WorldEdge, edgeB: WorldEdge) => {
  const i0 = projectPointToLine(edgeB.source.world, edgeA.source.world, edgeA.target.world);
  const i1 = projectPointToLine(edgeB.target.world, edgeA.source.world, edgeA.target.world);
  const iMid = midpoint(i0, i1);
  const pMid = midpoint(edgeA.source.world, edgeA.target.world);
  const projectedLength = distance(i0, i1);

  if (projectedLength === 0) {
    return 0;
  }

  return Math.max(0, 1 - (2 * distance(pMid, iMid)) / projectedLength);
};

const visibilityCompatibility = (edgeA: WorldEdge, edgeB: WorldEdge) =>
  Math.min(edgeVisibility(edgeA, edgeB), edgeVisibility(edgeB, edgeA));

const totalCompatibility = (edgeA: WorldEdge, edgeB: WorldEdge) =>
  angleCompatibility(edgeA, edgeB) *
  scaleCompatibility(edgeA, edgeB) *
  positionCompatibility(edgeA, edgeB) *
  visibilityCompatibility(edgeA, edgeB);

export class GraphEncoding {
  public static type = 'graph';

  private core: Trajectoolkit;
  private setting: EncodingSettings;
  private style: GraphResolvedStyle;
  private layout: GraphResolvedLayout;
  private cachedData: GeoNetwork | null = null;
  private bundledEdges: BundledEdge[] = [];
  private root: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private graphTrajectoryGroupId: string;
  private graphPointGroupId: string;
  private readonly onMapChange: () => void;

  constructor(
    setting: EncodingSettings,
    style: GraphResolvedStyle,
    layout: GraphResolvedLayout,
    core: Trajectoolkit
  ) {
    this.setting = setting;
    this.style = style;
    this.layout = layout;
    this.core = core;
    this.graphTrajectoryGroupId = `${this.setting.id}__graph_edges`;
    this.graphPointGroupId = `${this.setting.id}__graph_nodes`;
    this.onMapChange = () => this.draw();
  }

  public async update(data: GeoNetwork | null) {
    this.cachedData = data;
    this.bundledEdges = this.layout.edgeBundling
      ? this.computeBundledEdges(data)
      : this.computeStraightEdges(data);
    if (this.layout.renderMode === 'svg') {
      this.bindMapEvents();
    } else {
      this.unbindMapEvents();
    }
    this.draw();
  }

  public draw() {
    if (!this.core.map) {
      throw new Error('map not initialized!');
    }

    this.clearRenderedLayers();
    if (!this.cachedData || this.cachedData.nodes.length === 0) {
      return;
    }

    if (this.layout.renderMode === 'webgl') {
      this.drawWebgl();
      return;
    }

    if (!this.core.SVG) {
      throw new Error('svg not initialized!');
    }

    const svg = d3.select(this.core.SVG);
    this.root = svg
      .insert('g', ':first-child')
      .attr('data-encoding-id', this.setting.id);

    const screenNodes = this.projectNodes(this.createWorldNodes(this.cachedData.nodes));
    const edgeGroup = this.root.append('g').attr('class', 'graph-edges');
    const nodeGroup = this.root.append('g').attr('class', 'graph-nodes');
    const labelGroup = this.root.append('g').attr('class', 'graph-labels');

    const line = d3
      .line<Point>()
      .x((point) => point.x)
      .y((point) => point.y)
      .curve(d3.curveBasis);

    edgeGroup
      .selectAll('path')
      .data(this.bundledEdges)
      .enter()
      .append('path')
      .attr('d', (edge) => line(edge.points.map((point) => this.projectWorldPoint(point))) ?? '')
      .attr('fill', 'none')
      .attr('stroke', this.style.linkColor)
      .attr('stroke-width', this.style.linkWidth)
      .attr('stroke-opacity', this.style.linkOpacity)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');

    nodeGroup
      .selectAll('circle')
      .data(screenNodes)
      .enter()
      .append('circle')
      .attr('cx', (node) => node.x)
      .attr('cy', (node) => node.y)
      .attr('r', this.style.nodeRadius)
      .attr('fill', this.style.nodeColor)
      .attr('fill-opacity', this.style.nodeOpacity)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    if (this.style.showLabels) {
      labelGroup
        .selectAll('text')
        .data(screenNodes)
        .enter()
        .append('text')
        .attr('x', (node) => node.x + this.style.nodeRadius + 4)
        .attr('y', (node) => node.y - this.style.nodeRadius - 2)
        .attr('fill', this.style.labelColor)
        .attr('font-size', `${this.style.labelSize}px`)
        .attr('font-family', 'Georgia, "Times New Roman", serif')
        .text((node) => this.nodeLabel(node));
    }
  }

  public clear() {
    this.unbindMapEvents();
    this.clearRenderedLayers();
  }

  private clearRoot() {
    this.root?.remove();
    this.root = null;
  }

  private clearWebglGroups() {
    this.core.trajectoryRendering.groups.delete(this.graphTrajectoryGroupId);
    this.core.pointRendering.groups.delete(this.graphPointGroupId);
  }

  private clearRenderedLayers() {
    this.clearRoot();
    this.clearWebglGroups();
  }

  private bindMapEvents() {
    if (!this.core.map) {
      return;
    }
    this.unbindMapEvents();
    this.core.map.on('move', this.onMapChange);
    this.core.map.on('resize', this.onMapChange);
  }

  private unbindMapEvents() {
    if (!this.core.map) {
      return;
    }
    this.core.map.off('move', this.onMapChange);
    this.core.map.off('resize', this.onMapChange);
  }

  private createWorldNodes(nodes: GeoNode[]): WorldNode[] {
    return nodes.map((node) => ({
      id: node.id,
      position: node.position,
      world: toWorld(node.position),
      attributes: node.attributes
    }));
  }

  private projectNodes(nodes: WorldNode[]): ScreenNode[] {
    if (!this.core.map) {
      return [];
    }

    return nodes.map((node) => {
      const point = this.core.map!.project(node.position);
      return {
        id: node.id,
        x: point.x,
        y: point.y,
        attributes: node.attributes
      };
    });
  }

  private createWorldEdges(edges: GeoEdge[], nodes: WorldNode[]) {
    const nodeIndex = new Map(nodes.map((node) => [node.id, node]));
    return edges
      .map((edge, index) => {
        const source = nodeIndex.get(edge.from);
        const target = nodeIndex.get(edge.to);
        if (!source || !target) {
          return null;
        }
        return {
          id: `${this.setting.id}-edge-${index}`,
          source,
          target,
          attributes: edge.attributes
        } satisfies WorldEdge;
      })
      .filter((edge): edge is WorldEdge => edge !== null);
  }

  private drawWebgl() {
    if (!this.cachedData) {
      return;
    }

    const trajectories = this.toTrajectories(this.bundledEdges);
    const points = this.toPoints(this.cachedData.nodes);

    if (trajectories.length > 0) {
      this.core.addTrajectoryGroup({
        id: this.graphTrajectoryGroupId,
        data: trajectories,
        zIndex: this.setting.zIndex,
        maxZoom: this.setting.maxzoom,
        minZoom: this.setting.minzoom,
        capStyle: this.setting.capstyle ?? 'round',
        style: this.createEdgeStyle()
      });
    }

    if (points.length > 0) {
      this.core.addPointGroup({
        id: this.graphPointGroupId,
        data: () => points,
        zIndex: (this.setting.zIndex ?? 0) + 1,
        maxZoom: this.setting.maxzoom,
        minZoom: this.setting.minzoom,
        style: this.createNodeStyle()
      });
    }
  }

  private createEdgeStyle(): StyleMappingFunction {
    return {
      color: {
        type: 'static',
        value: this.style.linkColor
      },
      width: {
        type: 'static',
        value: this.style.linkWidth
      },
      opacity: {
        type: 'static',
        value: this.style.linkOpacity
      }
    };
  }

  private createNodeStyle(): PointStyleMappingFunction {
    return {
      color: {
        type: 'static',
        value: this.style.nodeColor
      },
      r: {
        type: 'static',
        value: this.style.nodeRadius
      },
      opacity: {
        type: 'static',
        value: this.style.nodeOpacity
      }
    };
  }

  private toTrajectories(edges: BundledEdge[]): Trajectory[] {
    return edges
      .filter((edge) => edge.points.length >= 2)
      .map((edge) => {
        const shapingPoints = edge.points.map((point, index) =>
          this.createTrajectoryPoint(
            `${edge.id}-p-${index}`,
            toLngLat(point),
            {
              source: {
                tid: edge.id
              },
              others: {
                ...edge.attributes,
                sourceNodeId: edge.source.id,
                targetNodeId: edge.target.id,
                kind: 'graph-edge-point'
              }
            }
          )
        );

        return {
          id: edge.id,
          starttime: '',
          endtime: '',
          distance: polylineLength(edge.points),
          shapingPoints,
          attributes: {
            ...edge.attributes,
            sourceNodeId: edge.source.id,
            targetNodeId: edge.target.id,
            kind: 'graph-edge'
          }
        } satisfies Trajectory;
      });
  }

  private toPoints(nodes: GeoNode[]): Trajectorypoint[] {
    return nodes.map((node, index) =>
      this.createTrajectoryPoint(`${this.setting.id}-node-${index}`, node.position, {
        others: {
          ...node.attributes,
          nodeId: node.id,
          kind: 'graph-node'
        }
      })
    );
  }

  private createTrajectoryPoint(
    id: string,
    position: LngLat,
    attributes: Trajectorypoint['attributes']
  ): Trajectorypoint {
    return {
      id,
      basePoint: {
        position
      },
      attributes
    };
  }

  private computeStraightEdges(data: GeoNetwork | null) {
    if (!data) {
      return [];
    }
    const worldNodes = this.createWorldNodes(data.nodes);
    const worldEdges = this.createWorldEdges(data.edges, worldNodes);
    return worldEdges.map((edge) => ({
      id: edge.id,
      points: [edge.source.world, edge.target.world],
      source: edge.source,
      target: edge.target,
      attributes: edge.attributes
    }));
  }

  private computeBundledEdges(data: GeoNetwork | null) {
    if (!data) {
      return [];
    }

    const worldNodes = this.createWorldNodes(data.nodes);
    const worldEdges = this.createWorldEdges(data.edges, worldNodes);
    if (worldEdges.length === 0) {
      return [];
    }

    const compatibilities = this.computeCompatibilityLists(worldEdges);
    const averageEdgeLength =
      d3.mean(worldEdges, (edge) => distance(edge.source.world, edge.target.world)) ?? 1;
    const bundlingScale = averageEdgeLength * (0.15 + this.layout.bundlingStrength * 0.85);
    const springConstant = 0.1 + (1 - this.layout.bundlingStrength) * 0.2;

    let subdivisionCount = INITIAL_SUBDIVISION_POINTS;
    let pointsByEdge = worldEdges.map((edge) =>
      resamplePolyline([edge.source.world, edge.target.world], subdivisionCount)
    );
    let iterationCount = INITIAL_ITERATIONS;
    let stepSize = INITIAL_STEP * bundlingScale;

    for (let cycle = 0; cycle < CYCLES; cycle += 1) {
      if (cycle > 0) {
        subdivisionCount *= 2;
        pointsByEdge = pointsByEdge.map((points) =>
          resamplePolyline(points, subdivisionCount)
        );
        stepSize *= 0.5;
        iterationCount = Math.max(2, Math.round(iterationCount * ITERATION_DECAY));
      }

      for (let iteration = 0; iteration < iterationCount; iteration += 1) {
        const newPointsByEdge = pointsByEdge.map((points) =>
          points.map((point) => ({ ...point }))
        );
        const cooling = 1 - iteration / Math.max(iterationCount, 1);

        for (let edgeIndex = 0; edgeIndex < worldEdges.length; edgeIndex += 1) {
          const edge = worldEdges[edgeIndex];
          const edgePoints = pointsByEdge[edgeIndex];
          const localSpringConstant =
            springConstant /
            (distance(edge.source.world, edge.target.world) * (subdivisionCount + 1));

          for (let pointIndex = 1; pointIndex < edgePoints.length - 1; pointIndex += 1) {
            const currentPoint = edgePoints[pointIndex];
            const prevPoint = edgePoints[pointIndex - 1];
            const nextPoint = edgePoints[pointIndex + 1];

            const springForce = multiply(
              add(subtract(prevPoint, currentPoint), subtract(nextPoint, currentPoint)),
              localSpringConstant
            );

            let electrostaticForce = { x: 0, y: 0 };
            for (const entry of compatibilities[edgeIndex]) {
              const otherPoint = pointsByEdge[entry.index][pointIndex];
              const delta = subtract(otherPoint, currentPoint);
              const deltaLength = Math.max(
                distance(otherPoint, currentPoint),
                averageEdgeLength * 0.02
              );
              const attraction = multiply(
                normalize(delta),
                (entry.compatibility / deltaLength) * bundlingScale
              );
              electrostaticForce = add(electrostaticForce, attraction);
            }

            const totalForce = add(springForce, electrostaticForce);
            newPointsByEdge[edgeIndex][pointIndex] = add(
              currentPoint,
              multiply(totalForce, stepSize * cooling)
            );
          }
        }

        pointsByEdge = newPointsByEdge;
      }
    }

    const smoothPasses = Math.max(0, Math.round(this.layout.smoothness * 8));
    const densifyFactor = 1 + this.layout.smoothness * 5;

    return worldEdges.map((edge, index) => ({
      id: edge.id,
      points: smoothPolyline(
        densifyPolyline(pointsByEdge[index], densifyFactor),
        smoothPasses
      ),
      source: edge.source,
      target: edge.target,
      attributes: edge.attributes
    }));
  }

  private computeCompatibilityLists(edges: WorldEdge[]) {
    const compatibilities: CompatibilityEntry[][] = edges.map(() => []);

    for (let left = 0; left < edges.length; left += 1) {
      for (let right = left + 1; right < edges.length; right += 1) {
        const compatibility = totalCompatibility(edges[left], edges[right]);
        if (compatibility < COMPATIBILITY_THRESHOLD) {
          continue;
        }
        compatibilities[left].push({ index: right, compatibility });
        compatibilities[right].push({ index: left, compatibility });
      }
    }

    return compatibilities;
  }

  private projectWorldPoint(point: Point) {
    if (!this.core.map) {
      return { x: 0, y: 0 };
    }
    const projected = this.core.map.project(toLngLat(point));
    return { x: projected.x, y: projected.y };
  }

  private nodeLabel(node: ScreenNode) {
    if (this.style.labelField === 'id') {
      return node.id;
    }

    const value = getByPath(node.attributes, this.style.labelField);
    if (value === null || value === undefined || value === '') {
      return node.id;
    }

    if (typeof value === 'number') {
      return String(Math.round(value * 100) / 100);
    }

    return String(value);
  }
}
