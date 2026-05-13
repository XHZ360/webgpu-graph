import type { WebGpuSimulationSchema } from "../types/simulation.ts";
import type { RenderGraphSchema } from "../types/renderGraph.ts";

export function generateMermaidGraph(graph: RenderGraphSchema): string {
  const lines: string[] = ["flowchart TD"];

  for (const node of graph.nodes) {
    const nodeId = sanitizeId(node.name);
    const label = node.kind === "subgraph" ? node.graphRef : node.passRef;

    lines.push(`  ${nodeId}["${label}"]`);

    if (node.dependencies) {
      for (const dep of node.dependencies) {
        const depId = sanitizeId(dep);
        lines.push(`  ${depId} --> ${nodeId}`);
      }
    }
  }

  return lines.join("\n");
}

export function generateMermaidFromSchema(schema: WebGpuSimulationSchema): string {
  const graph = schema.renderGraphs[schema.mainGraphRef];
  if (!graph) {
    return "flowchart TD\n  empty[No render graph found]";
  }

  return generateMermaidGraph(graph);
}

export interface StructuralSummary {
  name: string;
  version: string;
  bufferCount: number;
  bindGroupLayoutCount: number;
  bindGroupCount: number;
  shaderCount: number;
  pipelineCount: number;
  pipelineTypes: { compute: number; render: number };
  passCount: number;
  passTypes: { compute: number; render: number };
  renderGraphCount: number;
  mainGraphRef: string;
  totalBufferSize: number;
  buffers: Array<{
    name: string;
    size: number;
    type: string;
    mappable: boolean;
  }>;
  shaders: Array<{
    name: string;
    entryPoint: string;
    layoutRefs: string[];
  }>;
  pipelines: Array<{
    name: string;
    type: string;
    layoutRefs: string[];
  }>;
  passes: Array<{
    name: string;
    type: string;
    pipelineRef: string;
  }>;
}

export function generateStructuralSummary(schema: WebGpuSimulationSchema): StructuralSummary {
  const pipelines = Object.values(schema.pipelines);
  const passes = Object.values(schema.passes);

  let computePipelines = 0;
  let renderPipelines = 0;
  for (const p of pipelines) {
    if (p.type === "compute") computePipelines++;
    else renderPipelines++;
  }

  let computePasses = 0;
  let renderPasses = 0;
  for (const p of passes) {
    if (p.type === "compute") computePasses++;
    else renderPasses++;
  }

  const totalBufferSize = Object.values(schema.buffers).reduce((sum, b) => sum + b.size, 0);

  return {
    name: schema.name,
    version: schema.version,
    bufferCount: Object.keys(schema.buffers).length,
    bindGroupLayoutCount: Object.keys(schema.bindGroupLayouts).length,
    bindGroupCount: Object.keys(schema.bindGroups).length,
    shaderCount: Object.keys(schema.shaders).length,
    pipelineCount: pipelines.length,
    pipelineTypes: { compute: computePipelines, render: renderPipelines },
    passCount: passes.length,
    passTypes: { compute: computePasses, render: renderPasses },
    renderGraphCount: Object.keys(schema.renderGraphs).length,
    mainGraphRef: schema.mainGraphRef,
    totalBufferSize,
    buffers: Object.values(schema.buffers).map((b) => ({
      name: b.name,
      size: b.size,
      type: b.type,
      mappable: b.mappable ?? false,
    })),
    shaders: Object.values(schema.shaders).map((s) => ({
      name: s.name,
      entryPoint: s.entryPoint,
      layoutRefs: s.bindGroupLayoutRefs ?? [],
    })),
    pipelines: pipelines.map((p) => ({
      name: p.name,
      type: p.type,
      layoutRefs: p.bindGroups.map((b) => b.layout),
    })),
    passes: passes.map((p) => ({
      name: p.name,
      type: p.type,
      pipelineRef: p.pipelineRef,
    })),
  };
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_");
}
