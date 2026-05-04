# WebGPU Graph Schema 运行时规范

本文档定义 `packages/schema` 在运行时、构建期和执行阶段的目标能力。

除非另有说明，本文中的能力描述均属于目标规范，而不是当前已经全部落地的公开 API。

## 目标工具链能力

`schema` 包后续应至少提供以下几类能力。

### Builder

Builder 面向逐层构建 Schema，降低手写对象时的噪音。

目标用法如下：

```typescript
const builder = new DefaultSchemaBuilder();

builder.addBuffer(createStorageBufferSchema("positions", 1200));
builder.addBuffer(createStorageBufferSchema("velocities", 1200));

builder.addBindGroupLayout(
  createBindGroupLayoutSchema("layout-sim", [
    createBindingSchema(0, "positions", "buffer", GPUShaderStage.COMPUTE),
    createBindingSchema(1, "velocities", "buffer", GPUShaderStage.COMPUTE),
  ]),
);

builder.addBindGroup({
  name: "bg-main",
  layout: "layout-sim",
  bindings: [
    { binding: 0, resourceRef: "positions" },
    { binding: 1, resourceRef: "velocities" },
  ],
});

const schema = builder.build("MySimulation", "1.0.0");
```

### Validator

Validator 负责结构一致性与引用完整性校验。

最少应覆盖：

1. 缺失引用检查
2. RenderGraph 循环依赖检查
3. Buffer 对齐约束检查
4. BindGroup 与 Layout 匹配检查
5. Pipeline `group` 唯一性检查
6. Pass 与 Pipeline 的 group/layout 一致性检查
7. `dispatch: { expr }` 的结构合法性检查

目标用法如下：

```typescript
const validator = new DefaultSchemaValidator();
const result = validator.validate(schema);

if (!result.valid) {
  console.error(result.errors);
}
```

### Factory

Factory 负责将 Schema 装配成真实 GPU 资源。

目标职责包括：

- 创建 GPUBuffer
- 创建 GPUBindGroupLayout
- 创建 GPUBindGroup
- 创建 GPUShaderModule
- 创建 Compute / Render Pipeline

### 可视化与摘要

Schema 还应支持：

- Mermaid 依赖图导出
- 结构摘要生成
- 面向编辑器的关系图数据导出

## 示例执行流程

以下伪代码描述目标运行方式，而非当前已落地 API：

```typescript
async function stepSimulation(
  commandEncoder: GPUCommandEncoder,
  schema: WebGpuSimulationSchema,
  resources: {
    pipelines: Map<string, GPUComputePipeline>;
    bindGroups: Map<string, GPUBindGroup>;
  },
  executionContext?: SchemaExecutionContext,
) {
  const graph = schema.renderGraphs[schema.mainGraphRef];

  for (const node of graph.nodes) {
    const pass = schema.passes[node.passRef];
    const pipeline = resources.pipelines.get(pass.pipelineRef);

    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(pipeline);

    for (const binding of pass.bindGroups) {
      const bindGroup = resources.bindGroups.get(binding.bindGroupRef);
      computePass.setBindGroup(binding.group, bindGroup);
    }

    const dispatch =
      typeof pass.dispatch === "number" || Array.isArray(pass.dispatch)
        ? pass.dispatch
        : executionContext?.evaluateDispatch(pass.dispatch.expr);

    const [x, y = 1, z = 1] = typeof dispatch === "number" ? [dispatch, 1, 1] : dispatch;

    computePass.dispatchWorkgroups(x, y, z);
    computePass.end();
  }
}
```

## 执行器职责

执行器实现时至少需要额外处理以下问题：

- 资源缺失时的错误报告
- RenderGraph 拓扑排序
- Render 与 Compute Pass 分流执行
- 资源状态转换和屏障策略
