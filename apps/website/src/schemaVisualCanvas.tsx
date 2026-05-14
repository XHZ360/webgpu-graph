import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type NodeProps,
} from "@xyflow/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { createVisualProjection, type VisualProjection } from "editor";
import { createPbfSimulationSchema } from "schema/examples/pbf-simulation";
import type { ValidationError, WebGpuSimulationSchema } from "schema";
import {
  deriveVisibleCanvasGraph,
  EDGE_MEANING_LABELS,
  STRUCTURAL_EDGE_MEANINGS,
  toReactFlowGraph,
  type CanvasEdgeMeaning,
  type CanvasNode,
  type CanvasSelection,
} from "./visualCanvasAdapter.ts";

export interface SchemaVisualCanvasState {
  schema: WebGpuSimulationSchema;
  diagnostics?: ValidationError[];
  draftVersion?: number;
  activePreviewDraftVersion?: number | null;
  previewStatus?: string;
  previewMessage?: string;
  previewStale?: boolean;
  dirty?: boolean;
  selectedId?: string | null;
}

export interface SchemaVisualCanvasHandle {
  update(state: SchemaVisualCanvasState): void;
  dispose(): void;
}

const NODE_TYPES = { visualNode: VisualNodeCard };

export function mountSchemaVisualCanvas(container: HTMLElement): SchemaVisualCanvasHandle {
  const root = createRoot(container);
  let state: SchemaVisualCanvasState = { schema: createPbfSimulationSchema() };

  const render = (): void => {
    root.render(
      <ReactFlowProvider>
        <SchemaVisualCanvas state={state} />
      </ReactFlowProvider>,
    );
  };

  render();

  return {
    update(nextState: SchemaVisualCanvasState): void {
      state = nextState;
      render();
    },
    dispose(): void {
      root.unmount();
    },
  };
}

function SchemaVisualCanvas({ state }: { state: SchemaVisualCanvasState }) {
  const [selection, setSelection] = useState<CanvasSelection>(null);
  const [enabledMeanings, setEnabledMeanings] = useState(() => new Set(STRUCTURAL_EDGE_MEANINGS));
  const projection = createVisualProjection(state.schema, {
    diagnostics: state.diagnostics,
    validate: state.diagnostics === undefined,
  });
  const graph = toReactFlowGraph(projection);
  const { nodes, edges } = deriveVisibleCanvasGraph(
    graph.nodes,
    graph.edges,
    enabledMeanings,
    selection,
  );

  const toggleEdgeMeaning = (meaning: CanvasEdgeMeaning): void => {
    setEnabledMeanings((current) => {
      const next = new Set(current);
      if (next.has(meaning)) {
        next.delete(meaning);
      } else {
        next.add(meaning);
      }
      return next;
    });
  };

  return (
    <section className="visual-canvas page" aria-labelledby="visual-canvas-title">
      <section className="visual-canvas__hero">
        <p className="hero__body">React Flow island backed by editor visual projection.</p>
        <h2 className="hero__title" id="visual-canvas-title">
          Schema Visual Canvas
        </h2>
        <p className="hero__body">
          Read-only spatial view of the same schema used by the Inspector, Designer, and PBF
          preview.
        </p>
      </section>

      <section className="visual-canvas__layout">
        <article className="visual-canvas__stage" aria-label="Read-only schema visual graph">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            edgesReconnectable={false}
            elementsSelectable
            nodesFocusable
            edgesFocusable
            panOnDrag
            panOnScroll
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick
            selectionOnDrag={false}
            deleteKeyCode={null}
            multiSelectionKeyCode={null}
            minZoom={0.18}
            maxZoom={1.8}
            onNodeClick={(_, node) => setSelection({ kind: "node", id: node.id })}
            onEdgeClick={(_, edge) => setSelection({ kind: "edge", id: edge.id })}
            onPaneClick={() => setSelection(null)}
          >
            <Background color="rgba(148, 186, 255, 0.22)" gap={24} />
            <MiniMap pannable zoomable nodeColor={getMiniMapNodeColor} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </article>
        <VisualCanvasSummary
          enabledMeanings={enabledMeanings}
          projection={projection}
          state={state}
          visibleEdgeCount={edges.length}
          onToggleEdgeMeaning={toggleEdgeMeaning}
        />
      </section>
    </section>
  );
}

function VisualNodeCard({ data, selected }: NodeProps<CanvasNode>) {
  return (
    <div
      className={`visual-node visual-node--${data.kind} visual-node--severity-${data.severity}${selected ? " is-selected" : ""}`}
      title={`${data.sourcePath}. ${data.readonlyReason}`}
    >
      <Handle
        className="visual-node__handle visual-node__handle--target"
        isConnectable={false}
        position={Position.Left}
        type="target"
      />
      <div className="visual-node__group">{data.groupLabel}</div>
      <div className="visual-node__label">{data.label}</div>
      <div className="visual-node__meta">
        <span>{formatKind(data.kind)}</span>
        {data.severity !== "none" ? <strong>{data.severity}</strong> : null}
      </div>
      <div className="visual-node__badges">
        {data.badges.map((badge) => (
          <span key={badge.id} className={`visual-badge visual-badge--${badge.tone}`}>
            {badge.label}
          </span>
        ))}
      </div>
      <Handle
        className="visual-node__handle visual-node__handle--source"
        isConnectable={false}
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

function VisualCanvasSummary({
  projection,
  state,
  visibleEdgeCount,
  enabledMeanings,
  onToggleEdgeMeaning,
}: {
  projection: VisualProjection;
  state: SchemaVisualCanvasState;
  visibleEdgeCount: number;
  enabledMeanings: ReadonlySet<CanvasEdgeMeaning>;
  onToggleEdgeMeaning: (meaning: CanvasEdgeMeaning) => void;
}) {
  const severityCounts = projection.diagnostics.reduce(
    (counts, diagnostic) => ({
      ...counts,
      [diagnostic.severity]: counts[diagnostic.severity] + 1,
    }),
    { info: 0, warning: 0, error: 0 },
  );
  const previewState = formatPreviewState(state);

  return (
    <aside className="visual-canvas__summary">
      <article className="visual-summary-card">
        <div className="inspector-card__eyebrow">Readonly Summary</div>
        <dl className="visual-summary-kv">
          <div>
            <dt>Nodes</dt>
            <dd>{projection.nodes.length}</dd>
          </div>
          <div>
            <dt>Edges</dt>
            <dd>
              {visibleEdgeCount} / {projection.edges.length}
            </dd>
          </div>
          <div>
            <dt>Severity</dt>
            <dd>{projection.severity === "none" ? "No diagnostics" : projection.severity}</dd>
          </div>
          <div>
            <dt>Preview</dt>
            <dd>{previewState}</dd>
          </div>
          <div>
            <dt>Draft</dt>
            <dd>{formatDraftState(state)}</dd>
          </div>
        </dl>
      </article>

      <article className="visual-summary-card">
        <div className="inspector-card__eyebrow">Edge Filters</div>
        <div className="visual-filter-list">
          {STRUCTURAL_EDGE_MEANINGS.map((meaning) => (
            <label key={meaning} className="visual-filter-toggle">
              <input
                checked={enabledMeanings.has(meaning)}
                onChange={() => onToggleEdgeMeaning(meaning)}
                type="checkbox"
              />
              <span>{EDGE_MEANING_LABELS[meaning]}</span>
            </label>
          ))}
        </div>
      </article>

      <article className="visual-summary-card">
        <div className="inspector-card__eyebrow">Legend</div>
        <ul className="visual-legend">
          <li>
            <span className="visual-legend__swatch visual-legend__swatch--resources" /> Resources:
            buffers and storage inputs.
          </li>
          <li>
            <span className="visual-legend__swatch visual-legend__swatch--bindings" /> Bindings:
            layouts and bind groups.
          </li>
          <li>
            <span className="visual-legend__swatch visual-legend__swatch--programs" /> Programs:
            shaders and pipelines.
          </li>
          <li>
            <span className="visual-legend__swatch visual-legend__swatch--execution" /> Execution:
            passes and graph membership.
          </li>
          <li>
            Arrow labels show semantic edge meanings; badges show kind, main graph, and type hints.
          </li>
          <li>
            Canvas is read-only: pan, zoom, selection, and focus are enabled; dragging, connecting,
            deleting, editing, and layout persistence are disabled.
          </li>
        </ul>
      </article>

      <article className="visual-summary-card">
        <div className="inspector-card__eyebrow">Validation Overlay</div>
        <p className="visual-summary-note">
          {projection.diagnostics.length === 0
            ? "No schema validator diagnostics are available for the current projection."
            : `${severityCounts.error} errors, ${severityCounts.warning} warnings, ${severityCounts.info} info diagnostics.`}
        </p>
        {state.previewMessage ? (
          <p className="visual-summary-note">{state.previewMessage}</p>
        ) : null}
      </article>
    </aside>
  );
}

function getMiniMapNodeColor(node: CanvasNode): string {
  if (node.data.severity === "error") {
    return "#ef4444";
  }

  switch (node.data.groupId) {
    case "group:resources":
      return "#38bdf8";
    case "group:bindings":
      return "#a78bfa";
    case "group:programs":
      return "#f59e0b";
    case "group:execution":
      return "#22c55e";
    case "group:graphs":
      return "#f472b6";
    default:
      return "#94a3b8";
  }
}

function formatPreviewState(state: SchemaVisualCanvasState): string {
  if (state.previewStale) {
    return "stale draft";
  }
  if (state.previewStatus) {
    return state.previewStatus;
  }
  return "active PBF schema";
}

function formatDraftState(state: SchemaVisualCanvasState): string {
  if (state.draftVersion === undefined) {
    return "initial PBF schema";
  }
  return `v${state.draftVersion}${state.dirty ? " dirty" : " synced"}`;
}

function formatKind(kind: string): string {
  return kind.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
}
