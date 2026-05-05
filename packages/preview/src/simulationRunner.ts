import type { WebGpuSimulationSchema, SchemaExecutionContext } from "schema";
import { DefaultSchemaFactory } from "schema";
import type { FactoryResources } from "schema";
import { GraphExecutor } from "./graphExecutor.ts";

export interface SimulationRunnerOptions {
  schema: WebGpuSimulationSchema;
  device: GPUDevice;
  context?: SchemaExecutionContext;
}

export class SimulationRunner {
  readonly schema: WebGpuSimulationSchema;
  readonly device: GPUDevice;
  readonly context?: SchemaExecutionContext;

  private factory: DefaultSchemaFactory;
  private resources: FactoryResources | null = null;
  private executor: GraphExecutor | null = null;
  private frameCount = 0;

  constructor(options: SimulationRunnerOptions) {
    this.schema = options.schema;
    this.device = options.device;
    this.context = options.context;
    this.factory = new DefaultSchemaFactory();
  }

  initialize(): void {
    if (this.resources) {
      this.dispose();
    }

    this.resources = this.factory.createAllResources(this.schema, this.device);
    this.executor = new GraphExecutor({
      schema: this.schema,
      computePipelines: this.resources.computePipelines,
      bindGroups: this.resources.bindGroups,
    });
  }

  getBuffer(name: string): GPUBuffer | undefined {
    return this.resources?.buffers.get(name);
  }

  writeBuffer(name: string, data: ArrayBuffer | ArrayBufferView): void {
    const buffer = this.getBuffer(name);
    if (!buffer) {
      throw new Error(`Buffer "${name}" not found`);
    }
    if (data instanceof ArrayBuffer) {
      this.device.queue.writeBuffer(buffer, 0, data);
    } else {
      this.device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
    }
  }

  step(): GPUCommandBuffer {
    if (!this.executor || !this.resources) {
      throw new Error("SimulationRunner not initialized. Call initialize() first.");
    }

    const commandEncoder = this.device.createCommandEncoder();
    this.executor.execute(commandEncoder, this.context);
    const commandBuffer = commandEncoder.finish();

    this.frameCount++;
    return commandBuffer;
  }

  async readBuffer(name: string): Promise<Float32Array | Uint32Array> {
    if (!this.resources) {
      throw new Error("SimulationRunner not initialized. Call initialize() first.");
    }

    const bufferSchema = this.schema.buffers[name];
    if (!bufferSchema) {
      throw new Error(`Buffer "${name}" not found in schema`);
    }

    const buffer = this.resources.buffers.get(name);
    if (!buffer) {
      throw new Error(`Buffer "${name}" not found in resources`);
    }

    const stagingBuffer = this.device.createBuffer({
      size: buffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, stagingBuffer, 0, buffer.size);
    this.device.queue.submit([commandEncoder.finish()]);

    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const mapped = stagingBuffer.getMappedRange();

    const contentType = bufferSchema.contentType;
    let result: Float32Array | Uint32Array;

    if (contentType?.startsWith("uint32") || contentType?.startsWith("int32")) {
      result = new Uint32Array(mapped.slice(0));
    } else {
      result = new Float32Array(mapped.slice(0));
    }

    stagingBuffer.unmap();
    stagingBuffer.destroy();

    return result;
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  dispose(): void {
    if (this.resources) {
      for (const buffer of this.resources.buffers.values()) {
        buffer.destroy();
      }
      this.resources = null;
    }
    this.executor = null;
    this.frameCount = 0;
  }
}
