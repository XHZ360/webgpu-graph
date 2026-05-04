import type { BufferContentType, BufferUsageFlags } from "./basic.ts";

export interface BufferBindingSchema {
  name: string;
  size: number;
  usage: BufferUsageFlags;
  type: "storage" | "uniform" | "index" | "vertex";
  contentType?: BufferContentType;
  initialData?: number[];
  mappable?: boolean;
}

export function createStorageBufferSchema(
  name: string,
  size: number,
  opts?: {
    mappable?: boolean;
    contentType?: BufferContentType;
    initialData?: number[];
  },
): BufferBindingSchema {
  return {
    name,
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    type: "storage",
    ...opts,
  };
}

export function createUniformBufferSchema(
  name: string,
  size: number,
  opts?: {
    contentType?: BufferContentType;
    initialData?: number[];
  },
): BufferBindingSchema {
  return {
    name,
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    type: "uniform",
    ...opts,
  };
}

export function createIndexBufferSchema(name: string, size: number): BufferBindingSchema {
  return {
    name,
    size,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    type: "index",
  };
}

export function createVertexBufferSchema(
  name: string,
  size: number,
  opts?: {
    contentType?: BufferContentType;
    initialData?: number[];
  },
): BufferBindingSchema {
  return {
    name,
    size,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    type: "vertex",
    ...opts,
  };
}
