import type { WebGpuSimulationSchema } from "../../types/simulation.ts";
import type { ValidationError } from "../types.ts";

export function checkPassPipelineConsistency(schema: WebGpuSimulationSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [passName, pass] of Object.entries(schema.passes)) {
    const pipeline = schema.pipelines[pass.pipelineRef];
    if (!pipeline) continue;

    const passBindingsByGroup = new Map(pass.bindGroups.map((binding) => [binding.group, binding]));

    for (const passBinding of pass.bindGroups) {
      const pipelineBinding = pipeline.bindGroups.find((pb) => pb.group === passBinding.group);

      if (!pipelineBinding) {
        errors.push({
          rule: "PASS_PIPELINE_CONSISTENCY",
          message: `Pass "${passName}" uses bind group ${passBinding.group} which is not defined in pipeline "${pass.pipelineRef}"`,
          path: `passes.${passName}.bindGroups.${passBinding.group}`,
        });
        continue;
      }

      const bindGroup = schema.bindGroups[passBinding.bindGroupRef];
      if (!bindGroup) continue;

      if (bindGroup.layout !== pipelineBinding.layout) {
        errors.push({
          rule: "PASS_PIPELINE_CONSISTENCY",
          message: `Pass "${passName}" bind group ${passBinding.group}: bindGroup "${passBinding.bindGroupRef}" has layout "${bindGroup.layout}" but pipeline "${pass.pipelineRef}" expects layout "${pipelineBinding.layout}"`,
          path: `passes.${passName}.bindGroups.${passBinding.group}`,
        });
      }
    }

    for (const pipelineBinding of pipeline.bindGroups) {
      if (!passBindingsByGroup.has(pipelineBinding.group)) {
        errors.push({
          rule: "PASS_PIPELINE_CONSISTENCY",
          message: `Pass "${passName}" is missing bind group ${pipelineBinding.group} required by pipeline "${pass.pipelineRef}"`,
          path: `passes.${passName}.bindGroups`,
        });
      }
    }
  }

  return errors;
}
