export interface BindingSchema {
  binding: number;
  resource: string;
  resourceType: "buffer" | "sampler" | "texture";
  visibility: GPUShaderStageFlags;
}

export interface BindGroupLayoutSchema {
  name: string;
  bindings: BindingSchema[];
}

export interface BindGroupEntrySchema {
  binding: number;
  resourceRef: string;
}

export interface BindGroupSchema {
  name: string;
  layout: string;
  bindings: BindGroupEntrySchema[];
}

export interface PipelineBindGroupRef {
  group: number;
  layout: string;
}

export interface PassBindGroupRef {
  group: number;
  bindGroupRef: string;
}

export function createBindingSchema(
  binding: number,
  resource: string,
  resourceType: BindingSchema["resourceType"],
  visibility: GPUShaderStageFlags,
): BindingSchema {
  return { binding, resource, resourceType, visibility };
}

export function createBindGroupLayoutSchema(
  name: string,
  bindings: BindingSchema[],
): BindGroupLayoutSchema {
  return { name, bindings };
}
