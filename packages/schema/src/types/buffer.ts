import type { BufferContentType, BufferUsageFlags } from "./basic.ts";
import { BUFFER_USAGE } from "./basic.ts";

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
    usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST,
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
    usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST,
    type: "uniform",
    ...opts,
  };
}

export function createIndexBufferSchema(name: string, size: number): BufferBindingSchema {
  return {
    name,
    size,
    usage: BUFFER_USAGE.INDEX | BUFFER_USAGE.COPY_DST,
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
    usage: BUFFER_USAGE.VERTEX | BUFFER_USAGE.COPY_DST,
    type: "vertex",
    ...opts,
  };
}
