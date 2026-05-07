import type { WebGpuSimulationSchema } from "../../types/simulation.ts";
import type { RenderGraphSchema } from "../../types/renderGraph.ts";
import type { ValidationError } from "../types.ts";

function hasCycle(graph: RenderGraphSchema): string[] | null {
  const nodes = graph.nodes;
  const nodeNames = new Set(nodes.map((n) => n.name));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.name, 0);
    adjacency.set(node.name, []);
  }

  for (const node of nodes) {
    if (node.dependencies) {
      for (const dep of node.dependencies) {
        if (nodeNames.has(dep)) {
          adjacency.get(dep)!.push(node.name);
          inDegree.set(node.name, (inDegree.get(node.name) ?? 0) + 1);
        }
      }
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    processed++;
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (processed === nodes.length) return null;

  const remaining: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree > 0) remaining.push(name);
  }
  return remaining;
}

function collectGraphReferences(graph: RenderGraphSchema): string[] {
  return graph.nodes.filter((node) => node.kind === "subgraph").map((node) => node.graphRef);
}

function findGraphReferenceCycle(schema: WebGpuSimulationSchema): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(graphName: string, path: string[]): string[] | null {
    if (visiting.has(graphName)) {
      const cycleStart = path.indexOf(graphName);
      return cycleStart >= 0 ? path.slice(cycleStart) : [graphName];
    }

    if (visited.has(graphName)) {
      return null;
    }

    visiting.add(graphName);
    const graph = schema.renderGraphs[graphName];
    if (graph) {
      for (const ref of collectGraphReferences(graph)) {
        const cycle = visit(ref, [...path, ref]);
        if (cycle) {
          return cycle;
        }
      }
    }
    visiting.delete(graphName);
    visited.add(graphName);
    return null;
  }

  for (const graphName of Object.keys(schema.renderGraphs)) {
    const cycle = visit(graphName, [graphName]);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

export function checkRenderGraphCycles(schema: WebGpuSimulationSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [graphName, graph] of Object.entries(schema.renderGraphs)) {
    const cycleNodes = hasCycle(graph);
    if (cycleNodes) {
      errors.push({
        rule: "RENDER_GRAPH_CYCLE",
        message: `RenderGraph "${graphName}" has a cycle involving: ${cycleNodes.join(", ")}`,
        path: `renderGraphs.${graphName}`,
      });
    }
  }

  const graphReferenceCycle = findGraphReferenceCycle(schema);
  if (graphReferenceCycle) {
    errors.push({
      rule: "RENDER_GRAPH_CYCLE",
      message: `RenderGraph graph references have a cycle involving: ${graphReferenceCycle.join(" -> ")}`,
      path: "renderGraphs",
    });
  }

  return errors;
}
