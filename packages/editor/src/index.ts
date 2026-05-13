import type { RenderGraphNodeSchema, WebGpuSimulationSchema } from "schema";
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

export function createEditorState(): EditorState {
  return { selectedId: null };
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
