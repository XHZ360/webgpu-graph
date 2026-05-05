import type { WebGpuSimulationSchema } from "../../types/simulation.ts";
import type { BufferBindingSchema } from "../../types/buffer.ts";
import type { ValidationError } from "../types.ts";

const contentTypeSizes: Record<string, number> = {
  float32: 4,
  float32x2: 8,
  float32x3: 12,
  float32x4: 16,
  uint32: 4,
  int32: 4,
  vec2f: 8,
  vec3f: 12,
  vec4f: 16,
  mat3x3f: 48,
  mat4x4f: 64,
};

function checkBufferAlignment(buffer: BufferBindingSchema, bufferName: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (buffer.size <= 0) {
    errors.push({
      rule: "BUFFER_ALIGNMENT",
      message: `Buffer "${bufferName}" has non-positive size (${buffer.size})`,
      path: `buffers.${bufferName}.size`,
    });
    return errors;
  }

  switch (buffer.type) {
    case "uniform": {
      if (buffer.size % 16 !== 0) {
        errors.push({
          rule: "BUFFER_ALIGNMENT",
          message: `Uniform buffer "${bufferName}" size (${buffer.size}) must be a multiple of 16`,
          path: `buffers.${bufferName}.size`,
        });
      }
      break;
    }
    case "storage": {
      //todo:  直接拿简化尺寸做校验，比如 float32x3 和 vec3f 都按 12 处理。这会把不少真实需要按 16 对齐或按更复杂 WGSL 布局规则处理的场景误判为合法，导致 validator 的结果看起来“通过”，但运行时布局仍然可能错。
      if (buffer.contentType) {
        const elementSize = contentTypeSizes[buffer.contentType];
        if (elementSize && buffer.size % elementSize !== 0) {
          errors.push({
            rule: "BUFFER_ALIGNMENT",
            message: `Storage buffer "${bufferName}" size (${buffer.size}) must be a multiple of element size (${elementSize}) for contentType "${buffer.contentType}"`,
            path: `buffers.${bufferName}.size`,
          });
        }
      }
      break;
    }
    case "index": {
      if (buffer.size < 2 || buffer.size % 2 !== 0) {
        errors.push({
          rule: "BUFFER_ALIGNMENT",
          message: `Index buffer "${bufferName}" size (${buffer.size}) must be at least 2 and a multiple of 2`,
          path: `buffers.${bufferName}.size`,
        });
      }
      break;
    }
  }

  return errors;
}

export function checkBufferAlignmentRule(schema: WebGpuSimulationSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [bufferName, buffer] of Object.entries(schema.buffers)) {
    errors.push(...checkBufferAlignment(buffer, bufferName));
  }

  return errors;
}
