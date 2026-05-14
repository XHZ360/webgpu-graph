import { describe, expect, it } from "vitest";
import { buildModuleDependencyGraph } from "../moduleDependencyGraph.ts";

describe("module dependency graph", () => {
  it("builds workspace module nodes from the website trigger source", () => {
    const graph = buildModuleDependencyGraph();

    expect(graph.nodes).toEqual([
      { id: "website", label: "website", kind: "app", path: "apps/website" },
      { id: "editor", label: "editor", kind: "package", path: "packages/editor" },
      { id: "preview", label: "preview", kind: "package", path: "packages/preview" },
      { id: "schema", label: "schema", kind: "package", path: "packages/schema" },
    ]);
  });

  it("builds directed internal dependency edges", () => {
    const graph = buildModuleDependencyGraph();

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: "website", to: "editor", label: "workspace dependency" },
        { from: "website", to: "preview", label: "workspace dependency" },
        { from: "website", to: "schema", label: "workspace dependency" },
        { from: "editor", to: "schema", label: "workspace dependency" },
        { from: "preview", to: "schema", label: "workspace dependency" },
      ]),
    );
  });

  it("returns fresh graph objects for repeated builds", () => {
    const first = buildModuleDependencyGraph();
    const second = buildModuleDependencyGraph();
    first.nodes[0]!.label = "changed";
    first.edges[0]!.label = "changed";

    expect(second.nodes[0]?.label).toBe("website");
    expect(second.edges[0]?.label).toBe("workspace dependency");
  });
});
