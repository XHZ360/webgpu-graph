import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";
import type { VisualBadge, VisualEdge, VisualNode, VisualProjection, VisualSeverity } from "editor";

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  kind: VisualNode["kind"];
  groupId: string;
  groupLabel: string;
  badges: VisualBadge[];
  severity: VisualSeverity;
  sourcePath: string;
  readonlyReason: string;
}

export interface CanvasEdgeData extends Record<string, unknown> {
  meaning: VisualEdge["meaning"];
  badges: VisualBadge[];
  severity: VisualSeverity;
  sourcePath: string;
  readonlyReason: string;
}

export type CanvasNode = Node<CanvasNodeData, "visualNode">;
export type CanvasEdge = Edge<CanvasEdgeData>;
export type CanvasEdgeMeaning = VisualEdge["meaning"];

export type CanvasSelection = { kind: "node" | "edge"; id: string } | null;

export const STRUCTURAL_EDGE_MEANINGS: readonly CanvasEdgeMeaning[] = [
  "uses-layout",
  "binds-resource",
  "references-layout",
  "uses-shader",
  "uses-bind-group-layout",
  "uses-pipeline",
  "uses-bind-group",
  "contains-pass",
  "contains-subgraph",
  "depends-on",
];

export const EDGE_MEANING_LABELS: Record<CanvasEdgeMeaning, string> = {
  "uses-layout": "Uses layout",
  "binds-resource": "Binds resource",
  "references-layout": "References layout",
  "uses-shader": "Uses shader",
  "uses-bind-group-layout": "Uses bind group layout",
  "uses-pipeline": "Uses pipeline",
  "uses-bind-group": "Uses bind group",
  "contains-pass": "Contains pass",
  "contains-subgraph": "Contains subgraph",
  "depends-on": "Depends on",
  references: "References",
};

const GROUP_ORDER = [
  "group:resources",
  "group:bindings",
  "group:programs",
  "group:execution",
  "group:graphs",
];
const COLUMN_WIDTH = 270;
const ROW_HEIGHT = 128;
const COLUMN_GAP = 72;

export function toReactFlowGraph(projection: VisualProjection): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
} {
  const groupLabels = new Map(projection.groups.map((group) => [group.id, group.label]));
  const groupedNodeIndexes = new Map<string, number>();

  const nodes = projection.nodes.map((visualNode) => {
    const groupIndex = Math.max(0, GROUP_ORDER.indexOf(visualNode.groupId));
    const rowIndex = groupedNodeIndexes.get(visualNode.groupId) ?? 0;
    groupedNodeIndexes.set(visualNode.groupId, rowIndex + 1);

    return {
      id: visualNode.id,
      type: "visualNode" as const,
      position: {
        x: groupIndex * (COLUMN_WIDTH + COLUMN_GAP),
        y: rowIndex * ROW_HEIGHT,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: false,
      selectable: visualNode.capabilities.selectable,
      focusable: visualNode.capabilities.focusable,
      connectable: false,
      data: {
        label: visualNode.label,
        kind: visualNode.kind,
        groupId: visualNode.groupId,
        groupLabel: groupLabels.get(visualNode.groupId) ?? visualNode.groupId,
        badges: visualNode.badges,
        severity: visualNode.severity,
        sourcePath: visualNode.sourceRef.schemaPath,
        readonlyReason: visualNode.editability.reason,
      },
    } satisfies CanvasNode;
  });

  const edges = projection.edges.map((visualEdge) => ({
    id: visualEdge.id,
    source: visualEdge.from,
    target: visualEdge.to,
    label: visualEdge.label,
    type: "smoothstep",
    animated: visualEdge.meaning === "depends-on" || visualEdge.meaning === "contains-subgraph",
    selectable: visualEdge.capabilities.selectable,
    focusable: visualEdge.capabilities.focusable,
    reconnectable: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
    },
    data: {
      meaning: visualEdge.meaning,
      badges: visualEdge.badges,
      severity: visualEdge.severity,
      sourcePath: visualEdge.sourceRef.schemaPath,
      readonlyReason: visualEdge.editability.reason,
    },
  })) satisfies CanvasEdge[];

  return { nodes, edges };
}

export function deriveVisibleCanvasGraph(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  enabledMeanings: ReadonlySet<VisualEdge["meaning"]>,
  selection: CanvasSelection,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const visibleEdges = filterCanvasEdges(edges, enabledMeanings);
  const adjacent = getAdjacentElementIds(visibleEdges, selection);
  const hasSelection = selection !== null;

  return {
    nodes: nodes.map((node) => ({
      ...node,
      className: getElementClass(hasSelection, adjacent.nodeIds.has(node.id)),
    })),
    edges: visibleEdges.map((edge) => ({
      ...edge,
      className: getElementClass(hasSelection, adjacent.edgeIds.has(edge.id)),
    })),
  };
}

export function filterCanvasEdges(
  edges: CanvasEdge[],
  enabledMeanings: ReadonlySet<VisualEdge["meaning"]>,
): CanvasEdge[] {
  return edges.filter((edge) => edge.data && enabledMeanings.has(edge.data.meaning));
}

export function getAdjacentElementIds(
  edges: CanvasEdge[],
  selection: CanvasSelection,
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (!selection) {
    return { nodeIds, edgeIds };
  }

  if (selection.kind === "edge") {
    const edge = edges.find((candidate) => candidate.id === selection.id);
    if (edge) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
    return { nodeIds, edgeIds };
  }

  nodeIds.add(selection.id);
  for (const edge of edges) {
    if (edge.source !== selection.id && edge.target !== selection.id) {
      continue;
    }

    edgeIds.add(edge.id);
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  return { nodeIds, edgeIds };
}

function getElementClass(hasSelection: boolean, active: boolean): string | undefined {
  if (!hasSelection) {
    return undefined;
  }
  return active ? "is-adjacent" : "is-dimmed";
}
