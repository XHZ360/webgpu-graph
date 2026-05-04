export interface RenderGraphNodeSchema {
  name: string;
  passRef: string;
  dependencies?: string[];
  resources?: {
    reads?: string[];
    writes?: string[];
  };
}

export interface RenderGraphSchema {
  name: string;
  nodes: RenderGraphNodeSchema[];
}
