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

export interface SchemaExecutionContext {
  params: Record<string, number>;
  evaluateDispatch(expr: string): DispatchValue;
  reportError(message: string): void;
}
