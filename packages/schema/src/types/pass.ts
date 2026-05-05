import type { PassBindGroupRef } from "./binding.ts";

export type DispatchValue = number | [number, number, number];

export type DispatchExpression = { expr: string };

export interface ComputePassSchema {
  name: string;
  type: "compute";
  pipelineRef: string;
  bindGroups: PassBindGroupRef[];
  dispatch: DispatchValue | DispatchExpression;
}

export interface RenderPassAttachmentSchema {
  bufferRef: string;
  loadOp: "clear" | "load";
  storeOp: "store" | "discard";
  clearValue?: number[];
}

export interface VertexBufferBindingRef {
  slot: number;
  bufferRef: string;
}

export interface IndexBufferBindingRef {
  bufferRef: string;
  format: "uint16" | "uint32";
}

export type DrawCommand =
  | {
      type: "draw";
      vertexCount: number;
      instanceCount?: number;
      firstVertex?: number;
      firstInstance?: number;
    }
  | {
      type: "drawIndexed";
      indexCount: number;
      instanceCount?: number;
      firstIndex?: number;
      baseVertex?: number;
      firstInstance?: number;
    }
  | {
      type: "drawIndirect";
      indirectBufferRef: string;
      indirectOffset?: number;
    };

export interface RenderPassSchema {
  name: string;
  type: "render";
  pipelineRef: string;
  bindGroups: PassBindGroupRef[];
  colorAttachments: RenderPassAttachmentSchema[];
  depthAttachment?: RenderPassAttachmentSchema;
  vertexBufferBindings?: VertexBufferBindingRef[];
  indexBufferBinding?: IndexBufferBindingRef;
  draw: DrawCommand;
}

export type PassSchema = ComputePassSchema | RenderPassSchema;

export interface SchemaExecutionContext {
  params: Record<string, number>;
  evaluateDispatch(expr: string): DispatchValue;
  reportError(message: string): void;
}
