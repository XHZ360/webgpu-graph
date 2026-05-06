import type { WebGpuSimulationSchema } from "../types/simulation.ts";
import type { BufferBindingSchema } from "../types/buffer.ts";
import type { BindingSchema } from "../types/binding.ts";
import type {
  ComputePipelineSchema,
  RenderPipelineSchema,
  PipelineSchema,
} from "../types/pipeline.ts";

export interface FactoryResources {
  buffers: Map<string, GPUBuffer>;
  bindGroupLayouts: Map<string, GPUBindGroupLayout>;
  bindGroups: Map<string, GPUBindGroup>;
  shaderModules: Map<string, GPUShaderModule>;
  computePipelines: Map<string, GPUComputePipeline>;
  renderPipelines: Map<string, GPURenderPipeline>;
}

function resolveBufferBindingType(
  binding: BindingSchema,
  schema: WebGpuSimulationSchema,
): GPUBufferBindingType {
  const bufferSchema = schema.buffers[binding.resource];
  if (!bufferSchema) {
    console.warn(
      `Binding "${binding.binding}" references resource "${binding.resource}" which does not exist in schema buffers`,
    );
    return "storage";
  }
  switch (bufferSchema.type) {
    case "uniform":
      return "uniform";
    case "storage":
      return "storage";
    case "index":
    case "vertex":
      return "read-only-storage";
    default:
      return "storage";
  }
}

function createBindGroupLayoutEntry(
  binding: BindingSchema,
  schema: WebGpuSimulationSchema,
): GPUBindGroupLayoutEntry {
  const entry: GPUBindGroupLayoutEntry = {
    binding: binding.binding,
    visibility: binding.visibility,
  };

  switch (binding.resourceType) {
    case "buffer":
      entry.buffer = { type: resolveBufferBindingType(binding, schema) };
      break;
    case "sampler":
      entry.sampler = { type: "filtering" };
      break;
    case "texture":
      entry.texture = { sampleType: "float", viewDimension: "2d" };
      break;
  }

  return entry;
}

function createBufferFromSchema(bufferSchema: BufferBindingSchema, device: GPUDevice): GPUBuffer {
  const descriptor: GPUBufferDescriptor = {
    size: bufferSchema.size,
    usage: bufferSchema.usage,
  };

  if (bufferSchema.mappable) {
    descriptor.usage |= GPUBufferUsage.MAP_READ;
  }

  return device.createBuffer(descriptor);
}

function initializeBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  data: number[] | ArrayBuffer | ArrayBufferView,
  contentType?: string,
): void {
  if (Array.isArray(data)) {
    const useUint = contentType?.startsWith("uint32") || contentType?.startsWith("int32");
    const typedData = useUint ? new Uint32Array(data) : new Float32Array(data);
    device.queue.writeBuffer(buffer, 0, typedData);
  } else if (data instanceof ArrayBuffer) {
    device.queue.writeBuffer(buffer, 0, data);
  } else {
    device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  }
}

export class DefaultSchemaFactory {
  createBuffers(schema: WebGpuSimulationSchema, device: GPUDevice): Map<string, GPUBuffer> {
    const buffers = new Map<string, GPUBuffer>();

    for (const [name, bufferSchema] of Object.entries(schema.buffers)) {
      const buffer = createBufferFromSchema(bufferSchema, device);

      if (bufferSchema.initialData) {
        initializeBuffer(device, buffer, bufferSchema.initialData, bufferSchema.contentType);
      }

      buffers.set(name, buffer);
    }

    return buffers;
  }

  createBindGroupLayouts(
    schema: WebGpuSimulationSchema,
    device: GPUDevice,
  ): Map<string, GPUBindGroupLayout> {
    const layouts = new Map<string, GPUBindGroupLayout>();

    for (const [name, layoutSchema] of Object.entries(schema.bindGroupLayouts)) {
      const entries: GPUBindGroupLayoutEntry[] = layoutSchema.bindings.map((binding) =>
        createBindGroupLayoutEntry(binding, schema),
      );

      const layout = device.createBindGroupLayout({ entries });
      layouts.set(name, layout);
    }

    return layouts;
  }

  createBindGroups(
    schema: WebGpuSimulationSchema,
    device: GPUDevice,
    buffers: Map<string, GPUBuffer>,
    bindGroupLayouts: Map<string, GPUBindGroupLayout>,
  ): Map<string, GPUBindGroup> {
    const groups = new Map<string, GPUBindGroup>();

    for (const [name, bindGroupSchema] of Object.entries(schema.bindGroups)) {
      const layout = bindGroupLayouts.get(bindGroupSchema.layout);
      if (!layout) {
        throw new Error(
          `BindGroup "${name}" references layout "${bindGroupSchema.layout}" which was not created`,
        );
      }

      const entries: GPUBindGroupEntry[] = bindGroupSchema.bindings.map((entry) => {
        const buffer = buffers.get(entry.resourceRef);
        if (!buffer) {
          throw new Error(
            `BindGroup "${name}" binding ${entry.binding} references buffer "${entry.resourceRef}" which was not created`,
          );
        }

        return {
          binding: entry.binding,
          resource: { buffer, offset: 0, size: buffer.size },
        };
      });

      const bindGroup = device.createBindGroup({ layout, entries });
      groups.set(name, bindGroup);
    }

    return groups;
  }

  createShaderModules(
    schema: WebGpuSimulationSchema,
    device: GPUDevice,
  ): Map<string, GPUShaderModule> {
    const modules = new Map<string, GPUShaderModule>();

    for (const [name, shaderSchema] of Object.entries(schema.shaders)) {
      const module = device.createShaderModule({ code: shaderSchema.source });
      modules.set(name, module);
    }

    return modules;
  }

  createPipelineLayout(
    pipeline: PipelineSchema,
    device: GPUDevice,
    bindGroupLayouts: Map<string, GPUBindGroupLayout>,
  ): GPUPipelineLayout {
    const sorted = [...pipeline.bindGroups].sort((a, b) => a.group - b.group);

    const layouts: GPUBindGroupLayout[] = sorted.map((ref) => {
      const layout = bindGroupLayouts.get(ref.layout);
      if (!layout) {
        throw new Error(
          `Pipeline "${pipeline.name}" references layout "${ref.layout}" which was not created`,
        );
      }
      return layout;
    });

    return device.createPipelineLayout({ bindGroupLayouts: layouts });
  }

  createComputePipeline(
    pipeline: ComputePipelineSchema,
    device: GPUDevice,
    shaderModules: Map<string, GPUShaderModule>,
    schema: WebGpuSimulationSchema,
    bindGroupLayouts: Map<string, GPUBindGroupLayout>,
  ): GPUComputePipeline {
    const shader = shaderModules.get(pipeline.shader);
    if (!shader) {
      throw new Error(
        `Pipeline "${pipeline.name}" references shader "${pipeline.shader}" which was not created`,
      );
    }

    const shaderSchema = schema.shaders[pipeline.shader];
    if (!shaderSchema) {
      throw new Error(
        `Pipeline "${pipeline.name}" references shader "${pipeline.shader}" which is not present in schema`,
      );
    }

    const pipelineLayout = this.createPipelineLayout(pipeline, device, bindGroupLayouts);

    return device.createComputePipeline({
      layout: pipelineLayout,
      compute: { module: shader, entryPoint: shaderSchema.entryPoint },
    });
  }

  createRenderPipeline(
    pipeline: RenderPipelineSchema,
    device: GPUDevice,
    shaderModules: Map<string, GPUShaderModule>,
    schema: WebGpuSimulationSchema,
    bindGroupLayouts: Map<string, GPUBindGroupLayout>,
  ): GPURenderPipeline {
    const vertexShader = shaderModules.get(pipeline.vertexShader);
    if (!vertexShader) {
      throw new Error(
        `Pipeline "${pipeline.name}" references vertexShader "${pipeline.vertexShader}" which was not created`,
      );
    }

    const vertexShaderSchema = schema.shaders[pipeline.vertexShader];
    if (!vertexShaderSchema) {
      throw new Error(
        `Pipeline "${pipeline.name}" references vertexShader "${pipeline.vertexShader}" which is not present in schema`,
      );
    }

    const pipelineLayout = this.createPipelineLayout(pipeline, device, bindGroupLayouts);

    const descriptor: GPURenderPipelineDescriptor = {
      layout: pipelineLayout,
      vertex: {
        module: vertexShader,
        entryPoint: vertexShaderSchema.entryPoint,
        buffers: pipeline.vertexInput.buffers,
      },
      primitive: pipeline.primitive ?? {
        topology: "triangle-list",
        cullMode: "none",
      },
    };

    if (pipeline.fragmentShader) {
      const fragShader = shaderModules.get(pipeline.fragmentShader);
      if (!fragShader) {
        throw new Error(
          `Pipeline "${pipeline.name}" references fragmentShader "${pipeline.fragmentShader}" which was not created`,
        );
      }

      const fragmentShaderSchema = schema.shaders[pipeline.fragmentShader];
      if (!fragmentShaderSchema) {
        throw new Error(
          `Pipeline "${pipeline.name}" references fragmentShader "${pipeline.fragmentShader}" which is not present in schema`,
        );
      }

      descriptor.fragment = {
        module: fragShader,
        entryPoint: fragmentShaderSchema.entryPoint,
        targets: pipeline.fragmentOutput?.targets ?? [],
      };
    }

    if (pipeline.depthStencil) {
      descriptor.depthStencil = pipeline.depthStencil;
    }

    if (pipeline.multisample) {
      descriptor.multisample = pipeline.multisample;
    }

    return device.createRenderPipeline(descriptor);
  }

  createPipelines(
    schema: WebGpuSimulationSchema,
    device: GPUDevice,
    shaderModules: Map<string, GPUShaderModule>,
    bindGroupLayouts: Map<string, GPUBindGroupLayout>,
  ): {
    computePipelines: Map<string, GPUComputePipeline>;
    renderPipelines: Map<string, GPURenderPipeline>;
  } {
    const computePipelines = new Map<string, GPUComputePipeline>();
    const renderPipelines = new Map<string, GPURenderPipeline>();

    for (const [name, pipeline] of Object.entries(schema.pipelines)) {
      if (pipeline.type === "compute") {
        computePipelines.set(
          name,
          this.createComputePipeline(pipeline, device, shaderModules, schema, bindGroupLayouts),
        );
      } else {
        renderPipelines.set(
          name,
          this.createRenderPipeline(pipeline, device, shaderModules, schema, bindGroupLayouts),
        );
      }
    }

    return { computePipelines, renderPipelines };
  }

  createAllResources(schema: WebGpuSimulationSchema, device: GPUDevice): FactoryResources {
    const buffers = this.createBuffers(schema, device);
    const bindGroupLayouts = this.createBindGroupLayouts(schema, device);
    const bindGroups = this.createBindGroups(schema, device, buffers, bindGroupLayouts);
    const shaderModules = this.createShaderModules(schema, device);
    const { computePipelines, renderPipelines } = this.createPipelines(
      schema,
      device,
      shaderModules,
      bindGroupLayouts,
    );

    return {
      buffers,
      bindGroupLayouts,
      bindGroups,
      shaderModules,
      computePipelines,
      renderPipelines,
    };
  }
}
