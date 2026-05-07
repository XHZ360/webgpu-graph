import type { WebGpuSimulationSchema } from "../../types/simulation.ts";
import type { ValidationError } from "../types.ts";

export function checkMissingReferences(schema: WebGpuSimulationSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [pipelineName, pipeline] of Object.entries(schema.pipelines)) {
    if (pipeline.type === "compute") {
      if (!schema.shaders[pipeline.shader]) {
        errors.push({
          rule: "MISSING_REF",
          message: `Pipeline "${pipelineName}" references shader "${pipeline.shader}" which does not exist`,
          path: `pipelines.${pipelineName}.shader`,
        });
      }
    }
    if (pipeline.type === "render") {
      if (!schema.shaders[pipeline.vertexShader]) {
        errors.push({
          rule: "MISSING_REF",
          message: `Pipeline "${pipelineName}" references vertexShader "${pipeline.vertexShader}" which does not exist`,
          path: `pipelines.${pipelineName}.vertexShader`,
        });
      }
      if (pipeline.fragmentShader && !schema.shaders[pipeline.fragmentShader]) {
        errors.push({
          rule: "MISSING_REF",
          message: `Pipeline "${pipelineName}" references fragmentShader "${pipeline.fragmentShader}" which does not exist`,
          path: `pipelines.${pipelineName}.fragmentShader`,
        });
      }
    }
    for (const ref of pipeline.bindGroups) {
      if (!schema.bindGroupLayouts[ref.layout]) {
        errors.push({
          rule: "MISSING_REF",
          message: `Pipeline "${pipelineName}" bind group ${ref.group} references layout "${ref.layout}" which does not exist`,
          path: `pipelines.${pipelineName}.bindGroups.${ref.group}.layout`,
        });
      }
    }
  }

  for (const [passName, pass] of Object.entries(schema.passes)) {
    if (!schema.pipelines[pass.pipelineRef]) {
      errors.push({
        rule: "MISSING_REF",
        message: `Pass "${passName}" references pipeline "${pass.pipelineRef}" which does not exist`,
        path: `passes.${passName}.pipelineRef`,
      });
    }
    for (const ref of pass.bindGroups) {
      if (!schema.bindGroups[ref.bindGroupRef]) {
        errors.push({
          rule: "MISSING_REF",
          message: `Pass "${passName}" bind group ${ref.group} references bindGroup "${ref.bindGroupRef}" which does not exist`,
          path: `passes.${passName}.bindGroups.${ref.group}.bindGroupRef`,
        });
      }
    }
  }

  for (const [bindGroupName, bindGroup] of Object.entries(schema.bindGroups)) {
    if (!schema.bindGroupLayouts[bindGroup.layout]) {
      errors.push({
        rule: "MISSING_REF",
        message: `BindGroup "${bindGroupName}" references layout "${bindGroup.layout}" which does not exist`,
        path: `bindGroups.${bindGroupName}.layout`,
      });
    }
    for (const entry of bindGroup.bindings) {
      if (!schema.buffers[entry.resourceRef]) {
        errors.push({
          rule: "MISSING_REF",
          message: `BindGroup "${bindGroupName}" binding ${entry.binding} references buffer "${entry.resourceRef}" which does not exist`,
          path: `bindGroups.${bindGroupName}.bindings.${entry.binding}.resourceRef`,
        });
      }
    }
  }

  for (const [shaderName, shader] of Object.entries(schema.shaders)) {
    if (shader.bindGroupLayoutRefs) {
      for (const layoutRef of shader.bindGroupLayoutRefs) {
        if (!schema.bindGroupLayouts[layoutRef]) {
          errors.push({
            rule: "MISSING_REF",
            message: `Shader "${shaderName}" references bindGroupLayout "${layoutRef}" which does not exist`,
            path: `shaders.${shaderName}.bindGroupLayoutRefs`,
          });
        }
      }
    }
  }

  for (const [graphName, graph] of Object.entries(schema.renderGraphs)) {
    for (const node of graph.nodes) {
      if (node.kind === "subgraph") {
        if (!schema.renderGraphs[node.graphRef]) {
          errors.push({
            rule: "MISSING_REF",
            message: `RenderGraph "${graphName}" node "${node.name}" references graph "${node.graphRef}" which does not exist`,
            path: `renderGraphs.${graphName}.nodes.${node.name}.graphRef`,
          });
        }
      } else if (!schema.passes[node.passRef]) {
        errors.push({
          rule: "MISSING_REF",
          message: `RenderGraph "${graphName}" node "${node.name}" references pass "${node.passRef}" which does not exist`,
          path: `renderGraphs.${graphName}.nodes.${node.name}.passRef`,
        });
      }
      for (const dep of node.dependencies ?? []) {
        const depNode = graph.nodes.find((n) => n.name === dep);
        if (!depNode) {
          errors.push({
            rule: "MISSING_REF",
            message: `RenderGraph "${graphName}" node "${node.name}" depends on "${dep}" which is not a node in the same graph`,
            path: `renderGraphs.${graphName}.nodes.${node.name}.dependencies`,
          });
        }
      }
    }
  }

  if (!schema.renderGraphs[schema.mainGraphRef]) {
    errors.push({
      rule: "MISSING_REF",
      message: `mainGraphRef "${schema.mainGraphRef}" does not reference an existing render graph`,
      path: "mainGraphRef",
    });
  }

  return errors;
}
