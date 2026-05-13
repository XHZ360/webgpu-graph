# preview

`preview` 包负责把 `schema` 描述的模拟结构推进到 WebGPU 运行时预览层。它当前聚焦 Compute 优先的最小闭环：资源创建、RenderGraph 执行、dispatch 表达式上下文与 device limits 推导。

## 包职责

- 消费 `schema` 包导出的 `WebGpuSimulationSchema`
- 基于 `DefaultSchemaFactory` 创建运行时资源
- 执行 compute-oriented RenderGraph 节点
- 为 dispatch 表达式提供受控求值上下文
- 根据 Schema 推导 host 请求 `GPUDevice` 所需的最小 device limits

## 当前公开能力

当前包入口 `src/index.ts` 导出以下能力：

- `GraphExecutor`：按 RenderGraph 顺序执行 compute pass
- `SimulationRunner`：封装资源初始化、单步执行、buffer 写入与读取
- `createDispatchExecutionContext()`：创建 dispatch 表达式求值上下文
- `evaluateDispatchExpression()`：求值受支持的 dispatch 表达式
- `getRequiredDeviceLimits()`：从 Schema 推导当前支持的 `requiredLimits`
- `createPreviewFrame()`：创建最小 HTML preview frame 数据结构

## Device limits 协商

`preview` 当前会从 Schema 静态推导 `maxStorageBuffersPerShaderStage`。当某个 pipeline 在任意 shader stage 使用的 storage buffer 数量超过默认值时，host 应在 `requestDevice()` 时带入推导出的 `requiredLimits`。

职责划分如下：

- `schema` 提供可推导 limits 的静态结构
- `preview` 推导最小 `requiredLimits`
- host（例如 `website`）负责请求 `GPUAdapter` / `GPUDevice` 并呈现失败信息

## 与 schema 的关系

`preview` 只负责运行时预览，不定义 Schema 规则。模型约束、字段含义和验证规则以 `schema` 包和相关规范文档为准：

- `../schema/docs/PROJECT_OVERVIEW.md`
- `../schema/docs/SCHEMA_MODEL.md`
- `../schema/docs/SCHEMA_RUNTIME.md`
- `../../openspec/specs/project-architecture/spec.md`
- `../../openspec/specs/schema-model/spec.md`
- `../../openspec/specs/schema-runtime/spec.md`

## 当前非目标

- 不把 `GPUAdapter` / `GPUDevice` 生命周期整体迁入 preview
- 不在 preview 包内重新定义 Schema 模型规则
- 不承诺完整 RenderPass、纹理、采样器或自动屏障策略已经落地
- 不替代 host 的错误展示、设备选择或页面级交互逻辑

## 开发命令

```bash
vp run preview#dev
vp run preview#test
vp run preview#build
vp run preview#check
```

仓库级检查可使用：

```bash
vp check
vp run test -r
vp run build -r
```
