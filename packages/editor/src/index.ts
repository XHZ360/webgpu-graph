import {
  DefaultSchemaValidator,
  type BufferBindingSchema,
  type PassSchema,
  type RenderGraphNodeSchema,
  type ValidationError,
  type WebGpuSimulationSchema,
} from "schema";
import {
  generateMermaidFromSchema,
  generateStructuralSummary,
  type StructuralSummary,
} from "schema/visualization";

export type EditorState = {
  selectedId: string | null;
};

export interface EditorNode {
  id: string;
  type: "buffer" | "layout" | "bindGroup" | "shader" | "pipeline" | "pass" | "renderGraph";
  label: string;
  properties: Record<string, unknown>;
}

export interface EditorEdge {
  from: string;
  to: string;
  label: string;
}

export interface GraphData {
  nodes: EditorNode[];
  edges: EditorEdge[];
}

export interface SchemaInspection {
  summary: StructuralSummary;
  mermaid: string;
  graph: GraphData;
}

export type EditorSelectionType = "buffer" | "pass" | "renderGraphNode" | null;

export interface EditorValidationState {
  status: "valid" | "invalid";
  diagnostics: ValidationError[];
}

export interface EditorDraftSession {
  draft: WebGpuSimulationSchema;
  selectedId: string | null;
  selectedType: EditorSelectionType;
  dirty: boolean;
  validation: EditorValidationState;
}

export type EditorOperation =
  | { kind: "selectEntity"; id: string | null; entityType: EditorSelectionType }
  | { kind: "createBuffer"; name: string; buffer: BufferBindingSchema }
  | { kind: "updateBuffer"; name: string; patch: Partial<BufferBindingSchema> }
  | { kind: "deleteBuffer"; name: string }
  | { kind: "createPass"; name: string; pass: PassSchema }
  | { kind: "updatePass"; name: string; patch: Partial<PassSchema> }
  | { kind: "deletePass"; name: string }
  | { kind: "addRenderGraphNode"; graphName: string; node: RenderGraphNodeSchema }
  | {
      kind: "updateRenderGraphNode";
      graphName: string;
      nodeName: string;
      patch: Partial<RenderGraphNodeSchema>;
    }
  | { kind: "removeRenderGraphNode"; graphName: string; nodeName: string };

export type EditorOperationResult =
  | { ok: true; session: EditorDraftSession; diagnostics: ValidationError[] }
  | { ok: false; session: EditorDraftSession; diagnostics: ValidationError[] };

export function createEditorState(): EditorState {
  return { selectedId: null };
}

export function createEditorDraftSession(schema: WebGpuSimulationSchema): EditorDraftSession {
  return createSession(cloneSchema(schema), null, null, false);
}

export function applyEditorOperation(
  session: EditorDraftSession,
  operation: EditorOperation,
): EditorOperationResult {
  if (operation.kind === "selectEntity") {
    return {
      ok: true,
      session: createSession(session.draft, operation.id, operation.entityType, session.dirty),
      diagnostics: [],
    };
  }

  const draft = cloneSchema(session.draft);
  const failure = (message: string, path?: string): EditorOperationResult => ({
    ok: false,
    session,
    diagnostics: [{ rule: "EDITOR_OPERATION", message, path }],
  });

  switch (operation.kind) {
    case "createBuffer": {
      if (draft.buffers[operation.name]) {
        return failure(`Buffer '${operation.name}' already exists`, `buffers.${operation.name}`);
      }
      if (operation.buffer.name !== operation.name) {
        return failure("Buffer name must match its map key", `buffers.${operation.name}.name`);
      }
      draft.buffers[operation.name] = cloneValue(operation.buffer);
      break;
    }
    case "updateBuffer": {
      const buffer = draft.buffers[operation.name];
      if (!buffer) {
        return failure(`Buffer '${operation.name}' does not exist`, `buffers.${operation.name}`);
      }
      if (operation.patch.name !== undefined && operation.patch.name !== operation.name) {
        return failure("Buffer update cannot rename the map key", `buffers.${operation.name}.name`);
      }
      draft.buffers[operation.name] = {
        ...buffer,
        ...cloneValue(operation.patch),
        name: operation.name,
      };
      break;
    }
    case "deleteBuffer": {
      if (!draft.buffers[operation.name]) {
        return failure(`Buffer '${operation.name}' does not exist`, `buffers.${operation.name}`);
      }
      delete draft.buffers[operation.name];
      break;
    }
    case "createPass": {
      if (draft.passes[operation.name]) {
        return failure(`Pass '${operation.name}' already exists`, `passes.${operation.name}`);
      }
      if (operation.pass.name !== operation.name) {
        return failure("Pass name must match its map key", `passes.${operation.name}.name`);
      }
      draft.passes[operation.name] = cloneValue(operation.pass);
      break;
    }
    case "updatePass": {
      const pass = draft.passes[operation.name];
      if (!pass) {
        return failure(`Pass '${operation.name}' does not exist`, `passes.${operation.name}`);
      }
      if (operation.patch.name !== undefined && operation.patch.name !== operation.name) {
        return failure("Pass update cannot rename the map key", `passes.${operation.name}.name`);
      }
      const nextPass = {
        ...pass,
        ...cloneValue(operation.patch),
        name: operation.name,
      } as PassSchema;
      draft.passes[operation.name] = nextPass;
      break;
    }
    case "deletePass": {
      if (!draft.passes[operation.name]) {
        return failure(`Pass '${operation.name}' does not exist`, `passes.${operation.name}`);
      }
      delete draft.passes[operation.name];
      break;
    }
    case "addRenderGraphNode": {
      const graph = draft.renderGraphs[operation.graphName];
      if (!graph) {
        return failure(
          `Render graph '${operation.graphName}' does not exist`,
          `renderGraphs.${operation.graphName}`,
        );
      }
      if (graph.nodes.some((node) => node.name === operation.node.name)) {
        return failure(
          `Render graph node '${operation.node.name}' already exists`,
          `renderGraphs.${operation.graphName}.nodes.${operation.node.name}`,
        );
      }
      graph.nodes = [...graph.nodes, cloneValue(operation.node)];
      break;
    }
    case "updateRenderGraphNode": {
      const graph = draft.renderGraphs[operation.graphName];
      if (!graph) {
        return failure(
          `Render graph '${operation.graphName}' does not exist`,
          `renderGraphs.${operation.graphName}`,
        );
      }
      const index = graph.nodes.findIndex((node) => node.name === operation.nodeName);
      if (index === -1) {
        return failure(
          `Render graph node '${operation.nodeName}' does not exist`,
          `renderGraphs.${operation.graphName}.nodes.${operation.nodeName}`,
        );
      }
      if (operation.patch.name !== undefined && operation.patch.name !== operation.nodeName) {
        return failure(
          "Render graph node update cannot rename the node",
          `renderGraphs.${operation.graphName}.nodes.${operation.nodeName}.name`,
        );
      }
      graph.nodes = graph.nodes.map((node, nodeIndex) =>
        nodeIndex === index
          ? ({
              ...node,
              ...cloneValue(operation.patch),
              name: operation.nodeName,
            } as RenderGraphNodeSchema)
          : node,
      );
      break;
    }
    case "removeRenderGraphNode": {
      const graph = draft.renderGraphs[operation.graphName];
      if (!graph) {
        return failure(
          `Render graph '${operation.graphName}' does not exist`,
          `renderGraphs.${operation.graphName}`,
        );
      }
      if (!graph.nodes.some((node) => node.name === operation.nodeName)) {
        return failure(
          `Render graph node '${operation.nodeName}' does not exist`,
          `renderGraphs.${operation.graphName}.nodes.${operation.nodeName}`,
        );
      }
      graph.nodes = graph.nodes.filter((node) => node.name !== operation.nodeName);
      break;
    }
    default: {
      const unsupported = operation as { kind?: string };
      return failure(`Unsupported editor operation '${unsupported.kind ?? "unknown"}'`);
    }
  }

  const nextSession = createSession(draft, session.selectedId, session.selectedType, true);

  return {
    ok: true,
    session: nextSession,
    diagnostics: nextSession.validation.diagnostics,
  };
}

export function inspectSchema(schema: WebGpuSimulationSchema): SchemaInspection {
  const summary = generateStructuralSummary(schema);
  const mermaid = generateMermaidFromSchema(schema);
  const graph = buildGraphData(schema);

  return { summary, mermaid, graph };
}

function buildGraphData(schema: WebGpuSimulationSchema): GraphData {
  const nodes: EditorNode[] = [];
  const edges: EditorEdge[] = [];

  for (const [name, buffer] of Object.entries(schema.buffers)) {
    nodes.push({
      id: `buffer:${name}`,
      type: "buffer",
      label: name,
      properties: {
        size: buffer.size,
        bufferType: buffer.type,
        mappable: buffer.mappable ?? false,
      },
    });
  }

  for (const [name, layout] of Object.entries(schema.bindGroupLayouts)) {
    nodes.push({
      id: `layout:${name}`,
      type: "layout",
      label: name,
      properties: {
        bindingCount: layout.bindings.length,
      },
    });
  }

  for (const [name, group] of Object.entries(schema.bindGroups)) {
    nodes.push({
      id: `bindGroup:${name}`,
      type: "bindGroup",
      label: name,
      properties: {
        layoutRef: group.layout,
        bindingCount: group.bindings.length,
      },
    });

    edges.push({
      from: `layout:${group.layout}`,
      to: `bindGroup:${name}`,
      label: "uses layout",
    });

    for (const entry of group.bindings) {
      edges.push({
        from: `buffer:${entry.resourceRef}`,
        to: `bindGroup:${name}`,
        label: `binding ${entry.binding}`,
      });
    }
  }

  for (const [name, shader] of Object.entries(schema.shaders)) {
    nodes.push({
      id: `shader:${name}`,
      type: "shader",
      label: name,
      properties: {
        entryPoint: shader.entryPoint,
        layoutRefs: shader.bindGroupLayoutRefs ?? [],
      },
    });

    for (const layoutRef of shader.bindGroupLayoutRefs ?? []) {
      edges.push({
        from: `shader:${name}`,
        to: `layout:${layoutRef}`,
        label: "layout ref",
      });
    }
  }

  for (const [name, pipeline] of Object.entries(schema.pipelines)) {
    nodes.push({
      id: `pipeline:${name}`,
      type: "pipeline",
      label: name,
      properties: {
        pipelineType: pipeline.type,
        layoutRefs: pipeline.bindGroups.map((b) => `${b.group}:${b.layout}`),
      },
    });

    if (pipeline.type === "compute") {
      edges.push({
        from: `pipeline:${name}`,
        to: `shader:${pipeline.shader}`,
        label: "shader",
      });
    }

    for (const ref of pipeline.bindGroups) {
      edges.push({
        from: `pipeline:${name}`,
        to: `layout:${ref.layout}`,
        label: `group ${ref.group}`,
      });
    }
  }

  for (const [name, pass] of Object.entries(schema.passes)) {
    nodes.push({
      id: `pass:${name}`,
      type: "pass",
      label: name,
      properties: {
        passType: pass.type,
        pipelineRef: pass.pipelineRef,
        bindGroupCount: pass.bindGroups.length,
      },
    });

    edges.push({
      from: `pass:${name}`,
      to: `pipeline:${pass.pipelineRef}`,
      label: "uses pipeline",
    });

    for (const ref of pass.bindGroups) {
      edges.push({
        from: `pass:${name}`,
        to: `bindGroup:${ref.bindGroupRef}`,
        label: `group ${ref.group}`,
      });
    }
  }

  for (const [graphName, graph] of Object.entries(schema.renderGraphs)) {
    nodes.push({
      id: `renderGraph:${graphName}`,
      type: "renderGraph",
      label: graphName,
      properties: {
        nodeCount: graph.nodes.length,
        main: graphName === schema.mainGraphRef,
      },
    });

    for (const node of graph.nodes) {
      edges.push({
        from: `renderGraph:${graphName}`,
        to: getRenderGraphNodeTargetId(node),
        label: node.kind === "subgraph" ? `subgraph ${node.name}` : "contains",
      });

      for (const dependency of node.dependencies ?? []) {
        const dependencyNode = graph.nodes.find((candidate) => candidate.name === dependency);
        if (!dependencyNode) {
          continue;
        }

        edges.push({
          from: getRenderGraphNodeTargetId(dependencyNode),
          to: getRenderGraphNodeTargetId(node),
          label: `depends ${dependency}`,
        });
      }
    }
  }

  return { nodes, edges };
}

function getRenderGraphNodeTargetId(node: RenderGraphNodeSchema): string {
  if (node.kind === "subgraph") {
    return `renderGraph:${node.graphRef}`;
  }

  return `pass:${node.passRef}`;
}

export function getNodeDetail(schema: WebGpuSimulationSchema, nodeId: string): EditorNode | null {
  const [type, ...nameParts] = nodeId.split(":");
  const name = nameParts.join(":");

  switch (type) {
    case "buffer": {
      const b = schema.buffers[name];
      if (!b) return null;
      return {
        id: nodeId,
        type: "buffer",
        label: name,
        properties: {
          size: b.size,
          bufferType: b.type,
          contentType: b.contentType,
          mappable: b.mappable ?? false,
          usage: b.usage,
          hasInitialData: b.initialData !== undefined,
        },
      };
    }
    case "layout": {
      const l = schema.bindGroupLayouts[name];
      if (!l) return null;
      return {
        id: nodeId,
        type: "layout",
        label: name,
        properties: {
          bindings: l.bindings.map((b) => ({
            binding: b.binding,
            resource: b.resource,
            resourceType: b.resourceType,
          })),
        },
      };
    }
    case "bindGroup": {
      const bg = schema.bindGroups[name];
      if (!bg) return null;
      return {
        id: nodeId,
        type: "bindGroup",
        label: name,
        properties: {
          layout: bg.layout,
          bindings: bg.bindings.map((b) => ({
            binding: b.binding,
            resourceRef: b.resourceRef,
          })),
        },
      };
    }
    case "shader": {
      const s = schema.shaders[name];
      if (!s) return null;
      return {
        id: nodeId,
        type: "shader",
        label: name,
        properties: {
          entryPoint: s.entryPoint,
          layoutRefs: s.bindGroupLayoutRefs ?? [],
          workgroupSize: s.workgroupSize,
          sourceLength: s.source.length,
        },
      };
    }
    case "pipeline": {
      const p = schema.pipelines[name];
      if (!p) return null;
      const props: Record<string, unknown> = {
        pipelineType: p.type,
        bindGroups: p.bindGroups.map((b) => ({ group: b.group, layout: b.layout })),
      };
      if (p.type === "compute") {
        props.shader = p.shader;
        props.workgroupSize = p.workgroupSize;
      }
      return {
        id: nodeId,
        type: "pipeline",
        label: name,
        properties: props,
      };
    }
    case "pass": {
      const p = schema.passes[name];
      if (!p) return null;
      const props: Record<string, unknown> = {
        passType: p.type,
        pipelineRef: p.pipelineRef,
        bindGroups: p.bindGroups.map((b) => ({ group: b.group, bindGroupRef: b.bindGroupRef })),
      };
      if (p.type === "compute") {
        props.dispatch = p.dispatch;
      }
      return {
        id: nodeId,
        type: "pass",
        label: name,
        properties: props,
      };
    }
    case "renderGraph": {
      const g = schema.renderGraphs[name];
      if (!g) return null;
      return {
        id: nodeId,
        type: "renderGraph",
        label: name,
        properties: {
          nodes: g.nodes.map((n) =>
            n.kind === "subgraph"
              ? {
                  name: n.name,
                  kind: n.kind,
                  graphRef: n.graphRef,
                  iterations: n.iterations,
                  dependencies: n.dependencies ?? [],
                }
              : {
                  name: n.name,
                  kind: n.kind ?? "pass",
                  passRef: n.passRef,
                  dependencies: n.dependencies ?? [],
                },
          ),
        },
      };
    }
    default:
      return null;
  }
}

function createSession(
  draft: WebGpuSimulationSchema,
  selectedId: string | null,
  selectedType: EditorSelectionType,
  dirty: boolean,
): EditorDraftSession {
  const validationResult = new DefaultSchemaValidator().validate(draft);

  return {
    draft,
    selectedId,
    selectedType,
    dirty,
    validation: {
      status: validationResult.valid ? "valid" : "invalid",
      diagnostics: validationResult.errors,
    },
  };
}

function cloneSchema(schema: WebGpuSimulationSchema): WebGpuSimulationSchema {
  return cloneValue(schema);
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
