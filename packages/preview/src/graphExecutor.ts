import type {
  WebGpuSimulationSchema,
  ComputePassSchema,
  SchemaExecutionContext,
  DispatchValue,
  RenderGraphNodeSchema,
  RenderGraphIterationCountSchema,
  RenderGraphSchema,
} from "schema";

export interface GraphExecutorOptions {
  schema: WebGpuSimulationSchema;
  computePipelines: Map<string, GPUComputePipeline>;
  bindGroups: Map<string, GPUBindGroup>;
}

export class GraphExecutor {
  readonly schema: WebGpuSimulationSchema;
  readonly computePipelines: Map<string, GPUComputePipeline>;
  readonly bindGroups: Map<string, GPUBindGroup>;

  constructor(options: GraphExecutorOptions) {
    this.schema = options.schema;
    this.computePipelines = options.computePipelines;
    this.bindGroups = options.bindGroups;
  }

  private topologicalSort(graph: RenderGraphSchema): RenderGraphNodeSchema[] {
    const nodes = graph.nodes;
    const nodeNames = new Set(nodes.map((n) => n.name));
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adjacency.set(node.name, []);
      inDegree.set(node.name, 0);
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

    const sorted: RenderGraphNodeSchema[] = [];
    const nodeMap = new Map(nodes.map((node) => [node.name, node]));
    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = nodeMap.get(current);
      if (node) {
        sorted.push(node);
      }
      for (const neighbor of adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return sorted;
  }

  private resolveDispatch(
    pass: ComputePassSchema,
    context?: SchemaExecutionContext,
  ): DispatchValue {
    if (typeof pass.dispatch === "number" || Array.isArray(pass.dispatch)) {
      return pass.dispatch;
    }

    if (context?.evaluateDispatch) {
      return context.evaluateDispatch(pass.dispatch.expr);
    }

    context?.reportError?.(
      `Compute pass "${pass.name}" requires dispatch expression evaluation but no evaluator was provided. Falling back to 1.`,
    );
    return 1;
  }

  private getNumericContextParam(
    context: SchemaExecutionContext | undefined,
    name: string,
  ): number | null {
    const value = context?.params[name];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private resolveIterationCount(
    iterations: RenderGraphIterationCountSchema,
    context?: SchemaExecutionContext,
  ): number {
    if (typeof iterations === "number") {
      return Math.max(0, Math.floor(iterations));
    }

    const value = this.getNumericContextParam(context, iterations.param);
    if (value !== null) {
      return Math.max(0, Math.floor(value));
    }

    context?.reportError(
      `Render subgraph iteration requested but no numeric param named "${iterations.param}" was provided. Falling back to 1 iteration.`,
    );
    return 1;
  }

  private executeComputePass(
    commandEncoder: GPUCommandEncoder,
    passSchema: ComputePassSchema,
    context?: SchemaExecutionContext,
  ): void {
    const pipeline = this.computePipelines.get(passSchema.pipelineRef);
    if (!pipeline) {
      throw new Error(
        `Compute pass "${passSchema.name}" references pipeline "${passSchema.pipelineRef}" which is not available`,
      );
    }

    const computePass = commandEncoder.beginComputePass();

    computePass.setPipeline(pipeline);

    for (const bindingRef of passSchema.bindGroups) {
      const bindGroup = this.bindGroups.get(bindingRef.bindGroupRef);
      if (!bindGroup) {
        throw new Error(
          `Compute pass "${passSchema.name}" references bind group "${bindingRef.bindGroupRef}" which is not available`,
        );
      }
      computePass.setBindGroup(bindingRef.group, bindGroup);
    }

    const dispatch = this.resolveDispatch(passSchema, context);
    const [x, y, z] = typeof dispatch === "number" ? [dispatch, 1, 1] : dispatch;

    computePass.dispatchWorkgroups(x, y, z);
    computePass.end();
  }

  private executeNode(
    commandEncoder: GPUCommandEncoder,
    node: RenderGraphNodeSchema,
    context?: SchemaExecutionContext,
  ): void {
    if (node.kind === "subgraph") {
      const iterations = this.resolveIterationCount(node.iterations, context);
      for (let index = 0; index < iterations; index += 1) {
        this.executeGraph(commandEncoder, node.graphRef, context);
      }
      return;
    }

    const passSchema = this.schema.passes[node.passRef];
    if (!passSchema) {
      throw new Error(
        `Pass reference "${node.passRef}" not found for render graph node "${node.name}"`,
      );
    }

    if (passSchema.type === "compute") {
      this.executeComputePass(commandEncoder, passSchema, context);
    }
  }

  private executeGraph(
    commandEncoder: GPUCommandEncoder,
    graphRef: string,
    context?: SchemaExecutionContext,
  ): void {
    const graph = this.schema.renderGraphs[graphRef];
    if (!graph) {
      throw new Error(`Render graph reference "${graphRef}" not found in schema`);
    }

    const sortedNodes = this.topologicalSort(graph);
    for (const node of sortedNodes) {
      this.executeNode(commandEncoder, node, context);
    }
  }

  execute(commandEncoder: GPUCommandEncoder, context?: SchemaExecutionContext): void {
    this.executeGraph(commandEncoder, this.schema.mainGraphRef, context);
  }
}
