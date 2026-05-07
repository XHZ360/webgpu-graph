export interface RenderGraphNodeResourcesSchema {
  reads?: string[];
  writes?: string[];
}

export interface RenderGraphNodeBaseSchema {
  name: string;
  dependencies?: string[];
  resources?: RenderGraphNodeResourcesSchema;
}

export interface RenderGraphPassNodeSchema extends RenderGraphNodeBaseSchema {
  kind?: "pass";
  passRef: string;
}

export interface RenderGraphIterationParamSchema {
  param: string;
}

export type RenderGraphIterationCountSchema = number | RenderGraphIterationParamSchema;

export interface RenderGraphSubgraphNodeSchema extends RenderGraphNodeBaseSchema {
  kind: "subgraph";
  graphRef: string;
  iterations: RenderGraphIterationCountSchema;
}

export type RenderGraphNodeSchema = RenderGraphPassNodeSchema | RenderGraphSubgraphNodeSchema;

export interface RenderGraphSchema {
  name: string;
  nodes: RenderGraphNodeSchema[];
}
