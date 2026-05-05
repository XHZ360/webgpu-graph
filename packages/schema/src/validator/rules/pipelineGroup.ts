import type { WebGpuSimulationSchema } from "../../types/simulation.ts";
import type { ValidationError } from "../types.ts";

export function checkPipelineGroupUniqueness(schema: WebGpuSimulationSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [pipelineName, pipeline] of Object.entries(schema.pipelines)) {
    const seen = new Set<number>();
    for (const ref of pipeline.bindGroups) {
      if (seen.has(ref.group)) {
        errors.push({
          rule: "PIPELINE_GROUP_DUPLICATE",
          message: `Pipeline "${pipelineName}" has duplicate bind group ${ref.group}`,
          path: `pipelines.${pipelineName}.bindGroups`,
        });
      }
      seen.add(ref.group);
    }
  }

  return errors;
}
