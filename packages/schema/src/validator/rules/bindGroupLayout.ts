import type { WebGpuSimulationSchema } from "../../types/simulation.ts";
import type { ValidationError } from "../types.ts";

export function checkBindGroupLayoutMatching(schema: WebGpuSimulationSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [bgName, bindGroup] of Object.entries(schema.bindGroups)) {
    const layout = schema.bindGroupLayouts[bindGroup.layout];
    if (!layout) continue;

    for (const entry of bindGroup.bindings) {
      const layoutEntry = layout.bindings.find((b) => b.binding === entry.binding);
      if (!layoutEntry) {
        errors.push({
          rule: "BINDGROUP_LAYOUT_MISMATCH",
          message: `BindGroup "${bgName}" has binding ${entry.binding} which is not defined in layout "${bindGroup.layout}"`,
          path: `bindGroups.${bgName}.bindings.${entry.binding}`,
        });
        continue;
      }
    }

    for (const layoutEntry of layout.bindings) {
      const bindGroupEntry = bindGroup.bindings.find((b) => b.binding === layoutEntry.binding);
      if (!bindGroupEntry) {
        errors.push({
          rule: "BINDGROUP_LAYOUT_MISMATCH",
          message: `BindGroup "${bgName}" is missing binding ${layoutEntry.binding} required by layout "${bindGroup.layout}"`,
          path: `bindGroups.${bgName}.bindings`,
        });
      }
    }
  }

  return errors;
}
