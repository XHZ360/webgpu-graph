export interface ValidationError {
  rule: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

import type { WebGpuSimulationSchema } from "../types/simulation.ts";

export type ValidationRule = (schema: WebGpuSimulationSchema) => ValidationError[];
