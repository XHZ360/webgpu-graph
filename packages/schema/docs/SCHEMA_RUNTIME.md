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

### Runtime capability negotiation

当某份 Schema 在特定 stage 上需要超出 WebGPU 默认限制的资源数量时，运行时还需要在设备初始化前完成 capability negotiation。

目标职责划分如下：

- `schema` 提供足够的静态结构，使运行时可以推导所需 limits
- `preview` 负责从 Schema 推导最小 `requiredLimits`
- host（如 `website`）负责请求 `GPUAdapter` / `GPUDevice`，并将 `preview` 推导出的 `requiredLimits` 带入 `requestDevice()`

这意味着：

- Schema 不需要在当前阶段显式存储一份 `requiredLimits` 配置
- Preview 应提供面向 host 的推导工具，而不是让 demo 代码硬编码 schema-specific limit
- Host 只负责协商流程与错误呈现，不负责理解某个示例为何需要某个具体 limit

首个落地范围只覆盖可由 Schema 静态推导的最小子集，例如 `maxStorageBuffersPerShaderStage`。

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
- 基于 Schema 的运行时 capability 需求推导与对 host 协商流程的支撑
