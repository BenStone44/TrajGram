import { LngLat } from 'mapbox-gl';
import type { GeoEdge, GeoNetwork, GeoNode } from '../../interfaces/network';
import type { NormalizationReportBuilder } from '../report';
import {
  getByPath,
  isRecord,
  normalizePosition,
  toNumberOrUndefined,
  toStringOrUndefined
} from '../shared';

const NODE_COLLECTION_KEYS = ['nodes', 'vertices', 'points'] as const;
const EDGE_COLLECTION_KEYS = ['edges', 'links'] as const;
const NODE_ID_KEYS = ['id', 'nodeId', 'node_id', 'name'] as const;
const EDGE_FROM_KEYS = ['from', 'source', 'u', 'start'] as const;
const EDGE_TO_KEYS = ['to', 'target', 'v', 'end'] as const;

const pickFirstString = (value: Record<string, unknown>, keys: readonly string[]) =>
  keys.map((key) => toStringOrUndefined(value[key])).find((item) => item !== undefined);

const extractGraphCollections = (data: unknown) => {
  if (!isRecord(data)) {
    return null;
  }

  const nodeCollection = NODE_COLLECTION_KEYS
    .map((key) => data[key])
    .find((candidate) => Array.isArray(candidate));
  const edgeCollection = EDGE_COLLECTION_KEYS
    .map((key) => data[key])
    .find((candidate) => Array.isArray(candidate));

  if (Array.isArray(nodeCollection) && Array.isArray(edgeCollection)) {
    return { nodes: nodeCollection, edges: edgeCollection, shape: 'graph-object' };
  }

  for (const wrapperKey of ['data', 'graph', 'network', 'result'] as const) {
    const wrapped = data[wrapperKey];
    if (!isRecord(wrapped)) {
      continue;
    }

    const wrappedNodes = NODE_COLLECTION_KEYS
      .map((key) => wrapped[key])
      .find((candidate) => Array.isArray(candidate));
    const wrappedEdges = EDGE_COLLECTION_KEYS
      .map((key) => wrapped[key])
      .find((candidate) => Array.isArray(candidate));

    if (Array.isArray(wrappedNodes) && Array.isArray(wrappedEdges)) {
      return {
        nodes: wrappedNodes,
        edges: wrappedEdges,
        shape: `wrapped-${wrapperKey}-graph`
      };
    }
  }

  return null;
};

const normalizeGraphNode = (
  value: unknown,
  index: number,
  report: NormalizationReportBuilder
): GeoNode | null => {
  if (!isRecord(value)) {
    report.addWarning(
      'graph-node-invalid',
      `Skipped node ${index} because it is not an object.`,
      `nodes[${index}]`,
      'low'
    );
    return null;
  }

  const nodeId = pickFirstString(value, NODE_ID_KEYS) ?? `node_${index}`;
  const position =
    normalizePosition(value.position) ??
    normalizePosition(value.coordinates) ??
    normalizePosition(value.geometry?.coordinates) ??
    normalizePosition(value);

  if (!position) {
    report.addWarning(
      'graph-node-position-missing',
      `Skipped node "${nodeId}" because no valid coordinate pair was found.`,
      `nodes[${index}]`,
      'low'
    );
    return null;
  }

  const attributes: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (
      key === 'id' ||
      key === 'nodeId' ||
      key === 'node_id' ||
      key === 'name' ||
      key === 'position' ||
      key === 'coordinates' ||
      key === 'geometry'
    ) {
      continue;
    }
    attributes[key] = raw;
  }

  return {
    id: nodeId,
    position: new LngLat(position.lng, position.lat),
    attributes
  };
};

const resolveEndpointId = (
  value: Record<string, unknown>,
  keys: readonly string[]
) => {
  for (const key of keys) {
    const direct = toStringOrUndefined(value[key]);
    if (direct) {
      return direct;
    }

    const nestedId = toStringOrUndefined(getByPath(value[key], 'id'));
    if (nestedId) {
      return nestedId;
    }
  }

  return undefined;
};

const normalizeGraphEdge = (
  value: unknown,
  index: number,
  nodeIds: Set<string>,
  report: NormalizationReportBuilder
): GeoEdge | null => {
  if (!isRecord(value)) {
    report.addWarning(
      'graph-edge-invalid',
      `Skipped edge ${index} because it is not an object.`,
      `edges[${index}]`,
      'low'
    );
    return null;
  }

  const from = resolveEndpointId(value, EDGE_FROM_KEYS);
  const to = resolveEndpointId(value, EDGE_TO_KEYS);

  if (!from || !to) {
    report.addWarning(
      'graph-edge-endpoint-missing',
      `Skipped edge ${index} because "from/to" or "source/target" was incomplete.`,
      `edges[${index}]`,
      'low'
    );
    return null;
  }

  if (!nodeIds.has(from) || !nodeIds.has(to)) {
    report.addWarning(
      'graph-edge-node-missing',
      `Skipped edge ${index} because at least one endpoint node was not found.`,
      `edges[${index}]`,
      'low'
    );
    return null;
  }

  const attributes: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (
      key === 'from' ||
      key === 'to' ||
      key === 'source' ||
      key === 'target' ||
      key === 'u' ||
      key === 'v' ||
      key === 'start' ||
      key === 'end'
    ) {
      continue;
    }
    attributes[key] = raw;
  }

  return {
    from,
    to,
    attributes
  };
};

export const normalizeGraphData = (
  data: unknown,
  report: NormalizationReportBuilder
): GeoNetwork | null => {
  const collections = extractGraphCollections(data);
  if (!collections) {
    report.setDetectedShape('unrecognized');
    report.addWarning(
      'graph-unrecognized',
      'Unable to detect a node-link graph from the input data.',
      undefined,
      'low'
    );
    return null;
  }

  const nodes = collections.nodes
    .map((node, index) => normalizeGraphNode(node, index, report))
    .filter((node): node is GeoNode => node !== null);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = collections.edges
    .map((edge, index) => normalizeGraphEdge(edge, index, nodeIds, report))
    .filter((edge): edge is GeoEdge => edge !== null);

  report.setDetectedShape(collections.shape);
  report.setGraphCounts(nodes.length, edges.length);
  report.addTrace(
    'graph-detection',
    `Detected ${nodes.length} node(s) and ${edges.length} edge(s).`
  );

  return {
    nodes,
    edges
  };
};
