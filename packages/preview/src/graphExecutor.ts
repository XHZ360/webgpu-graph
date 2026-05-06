import type {
  WebGpuSimulationSchema,
  ComputePassSchema,
  SchemaExecutionContext,
  DispatchValue,
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

  private topologicalSort(): string[] {
    const graph = this.schema.renderGraphs[this.schema.mainGraphRef];
    if (!graph) {
      return [];
    }

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

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
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

  private getComputePass(passRef: string): ComputePassSchema {
    const pass = this.schema.passes[passRef];
    if (!pass) {
      throw new Error(`Compute pass reference "${passRef}" not found in schema`);
    }
    if (pass.type !== "compute") {
      throw new Error(`Pass "${passRef}" is not a compute pass`);
    }
    return pass;
  }

  private getNumericContextParam(
    context: SchemaExecutionContext | undefined,
    name: string,
  ): number | null {
    const value = context?.params[name];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private getPbfIterationCount(context?: SchemaExecutionContext): number {
    const iterations = this.getNumericContextParam(context, "pbfIterations");
    if (iterations !== null) {
      return Math.max(0, Math.floor(iterations));
    }

    const legacyIterations = this.getNumericContextParam(context, "iterationCount");
    if (legacyIterations !== null) {
      return Math.max(0, Math.floor(legacyIterations));
    }

    context?.reportError(
      "PBF iterative execution requested but no pbfIterations/iterationCount param was provided. Falling back to 1 iteration.",
    );
    return 1;
  }

  private shouldUseIterativePbfExecution(): boolean {
    const requiredPasses = [
      "pass-prologue",
      "pass-clear-grid",
      "pass-build-grid",
      "pass-pbf-lambda",
      "pass-pbf-delta",
      "pass-apply-delta",
      "pass-epilogue",
    ];

    return requiredPasses.every((passRef) => passRef in this.schema.passes);
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

  private executeIterativePbfGraph(
    commandEncoder: GPUCommandEncoder,
    context?: SchemaExecutionContext,
  ): void {
    const prologue = this.getComputePass("pass-prologue");
    const clearGrid = this.getComputePass("pass-clear-grid");
    const buildGrid = this.getComputePass("pass-build-grid");
    const lambda = this.getComputePass("pass-pbf-lambda");
    const delta = this.getComputePass("pass-pbf-delta");
    const applyDelta = this.getComputePass("pass-apply-delta");
    const epilogue = this.getComputePass("pass-epilogue");

    this.executeComputePass(commandEncoder, prologue, context);

    const iterations = this.getPbfIterationCount(context);
    for (let index = 0; index < iterations; index += 1) {
      this.executeComputePass(commandEncoder, clearGrid, context);
      this.executeComputePass(commandEncoder, buildGrid, context);
      this.executeComputePass(commandEncoder, lambda, context);
      this.executeComputePass(commandEncoder, delta, context);
      this.executeComputePass(commandEncoder, applyDelta, context);
    }

    this.executeComputePass(commandEncoder, epilogue, context);
  }

  execute(commandEncoder: GPUCommandEncoder, context?: SchemaExecutionContext): void {
    const graph = this.schema.renderGraphs[this.schema.mainGraphRef];
    if (!graph) {
      throw new Error(`mainGraphRef "${this.schema.mainGraphRef}" not found in renderGraphs`);
    }

    if (this.shouldUseIterativePbfExecution()) {
      this.executeIterativePbfGraph(commandEncoder, context);
      return;
    }

    const sortedNodeNames = this.topologicalSort();
    const nodeMap = new Map(graph.nodes.map((n) => [n.name, n]));

    for (const nodeName of sortedNodeNames) {
      const node = nodeMap.get(nodeName);
      if (!node) continue;

      const passSchema = this.schema.passes[node.passRef];
      if (!passSchema) continue;

      if (passSchema.type === "compute") {
        this.executeComputePass(commandEncoder, passSchema, context);
      }
    }
  }
}
