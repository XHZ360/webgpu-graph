import { describe, expect, it } from "vitest";
import { createVisualProjection } from "editor";
import { createPbfSimulationSchema } from "schema/examples/pbf-simulation";
import {
  deriveVisibleCanvasGraph,
  filterCanvasEdges,
  getAdjacentElementIds,
  STRUCTURAL_EDGE_MEANINGS,
  toReactFlowGraph,
} from "../visualCanvasAdapter.ts";

describe("visual canvas adapter", () => {
  it("maps projection nodes to read-only React Flow nodes", () => {
    const projection = createVisualProjection(createPbfSimulationSchema());
    const { nodes } = toReactFlowGraph(projection);
    const positionsNode = nodes.find((node) => node.id === "buffer:positions");

    expect(positionsNode).toMatchObject({
      id: "buffer:positions",
      type: "visualNode",
      draggable: false,
      connectable: false,
      selectable: true,
      focusable: true,
      data: {
        label: "positions",
        kind: "buffer",
        groupId: "group:resources",
        groupLabel: "Resources",
        severity: "none",
        sourcePath: "buffers.positions",
      },
    });
    expect(positionsNode?.position).toEqual({ x: 0, y: 0 });
    expect(positionsNode?.data.badges).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "storage" })]),
    );
  });

  it("keeps custom node and edge connection interactions readonly", () => {
    const projection = createVisualProjection(createPbfSimulationSchema());
    const { nodes, edges } = toReactFlowGraph(projection);

    expect(nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ draggable: false, connectable: false })]),
    );
    expect(edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ reconnectable: false })]),
    );
  });

  it("maps semantic edges with readonly interaction metadata", () => {
    const projection = createVisualProjection(createPbfSimulationSchema());
    const { edges } = toReactFlowGraph(projection);
    const layoutEdge = edges.find(
      (edge) =>
        edge.id === "edge:layout:layout-shared->bindGroup:bg-shared:uses-layout:uses-layout",
    );

    expect(layoutEdge).toMatchObject({
      source: "layout:layout-shared",
      target: "bindGroup:bg-shared",
      label: "uses layout",
      type: "smoothstep",
      animated: false,
      selectable: true,
      focusable: true,
      reconnectable: false,
      data: {
        meaning: "uses-layout",
        severity: "none",
        sourcePath: "layout:layout-shared.uses-layout.bindGroup:bg-shared",
      },
    });
    expect(layoutEdge?.data?.badges).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "uses-layout" })]),
    );
  });

  it("preserves validation severity in rendered node and edge data", () => {
    const schema = createPbfSimulationSchema();
    schema.passes["pass-prologue"].pipelineRef = "missing-pipeline";
    const projection = createVisualProjection(schema);
    const { nodes, edges } = toReactFlowGraph(projection);

    expect(nodes.find((node) => node.id === "pass:pass-prologue")?.data.severity).toBe("error");
    expect(edges.find((edge) => edge.id.includes("depends-on"))?.data?.severity).toBe("error");
  });

  it("shows structural relationship edges by default and filters by meaning", () => {
    const projection = createVisualProjection(createPbfSimulationSchema());
    const { edges } = toReactFlowGraph(projection);
    const structuralEdges = filterCanvasEdges(edges, new Set(STRUCTURAL_EDGE_MEANINGS));
    const dependencyEdges = filterCanvasEdges(edges, new Set(["depends-on"]));

    expect(structuralEdges.length).toBe(edges.length);
    expect(structuralEdges.map((edge) => edge.data?.meaning)).toEqual(
      expect.arrayContaining(["binds-resource", "uses-layout", "uses-pipeline", "depends-on"]),
    );
    expect(dependencyEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ data: expect.objectContaining({ meaning: "depends-on" }) }),
      ]),
    );
    expect(dependencyEdges.every((edge) => edge.data?.meaning === "depends-on")).toBe(true);
  });

  it("derives first-degree adjacency highlight state for selected nodes and edges", () => {
    const projection = createVisualProjection(createPbfSimulationSchema());
    const graph = toReactFlowGraph(projection);
    const selectedNode = deriveVisibleCanvasGraph(
      graph.nodes,
      graph.edges,
      new Set(STRUCTURAL_EDGE_MEANINGS),
      { kind: "node", id: "pass:pass-prologue" },
    );
    const selectedEdge = graph.edges.find((edge) => edge.data?.meaning === "uses-layout")!;
    const edgeAdjacency = getAdjacentElementIds(graph.edges, { kind: "edge", id: selectedEdge.id });

    expect(selectedNode.nodes.find((node) => node.id === "pass:pass-prologue")?.className).toBe(
      "is-adjacent",
    );
    expect(selectedNode.edges.find((edge) => edge.source === "pass:pass-prologue")?.className).toBe(
      "is-adjacent",
    );
    expect(selectedNode.nodes.find((node) => node.id === "buffer:positions")?.className).toBe(
      "is-dimmed",
    );
    expect(edgeAdjacency.edgeIds.has(selectedEdge.id)).toBe(true);
    expect(edgeAdjacency.nodeIds.has(selectedEdge.source)).toBe(true);
    expect(edgeAdjacency.nodeIds.has(selectedEdge.target)).toBe(true);
  });
});
