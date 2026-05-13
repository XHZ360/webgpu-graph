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
