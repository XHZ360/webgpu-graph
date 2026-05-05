import type { WebGpuSimulationSchema } from "../types/simulation.ts";
import type { ValidationError, ValidationResult } from "./types.ts";
import {
  checkMissingReferences,
  checkRenderGraphCycles,
  checkBufferAlignmentRule,
  checkBindGroupLayoutMatching,
  checkPipelineGroupUniqueness,
  checkPassPipelineConsistency,
  checkDispatchExpressionValidity,
} from "./rules/index.ts";

type Rule = (schema: WebGpuSimulationSchema) => ValidationError[];

const RULES: Rule[] = [
  checkMissingReferences,
  checkBindGroupLayoutMatching,
  checkPipelineGroupUniqueness,
  checkPassPipelineConsistency,
  checkDispatchExpressionValidity,
  checkRenderGraphCycles,
  checkBufferAlignmentRule,
];

export class DefaultSchemaValidator {
  validate(schema: WebGpuSimulationSchema): ValidationResult {
    const errors: ValidationError[] = [];

    for (const rule of RULES) {
      errors.push(...rule(schema));
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
