# WebGPU Graph Schema 模型规范

本文档定义 `packages/schema` 的静态数据模型与结构约束。

除非另有说明，本文中的接口均属于目标规范，而不是当前已经全部落地的公开 API。

## Schema 系统总体设计

以下内容定义的是 `schema` 包的目标模型，也是整个项目后续实现的核心约束。

### 分层结构

Schema 系统按 7 个层级组织，自底向上组装：

1. Basic Types
2. Buffer
3. Binding System
4. Shader
5. Pipeline
6. Pass Execution
7. RenderGraph / Simulation

这一分层的设计意图是：

- 低层对象可被高层重复引用
- 每一层只表达自己的职责，不混入上层运行时语义
- Pipeline 与 Pass 中显式承载 `group`，而不是把 `group` 写死在 Layout 上

### 设计约束

整个 Schema 系统应遵守以下原则：

- 显式优于隐式
- 复用优于复制
- 结构校验优于运行期猜测
- 数据模型与执行器解耦
- 编辑器、预览器与运行时共享同一份 Schema 事实源

## 核心 Schema 规范

### Buffer Schema

Buffer 用于声明 GPU 内存资源。

```typescript
interface BufferBindingSchema {
  name: string;
  size: number;
  usage: BufferUsageFlags;
  type: "storage" | "uniform" | "index" | "vertex";
  contentType?: BufferContentType;
  initialData?: ArrayBuffer;
  mappable?: boolean;
}
```

推荐保留工厂函数以降低样板代码：

```typescript
const positionBuffer = createStorageBufferSchema("positions", 1200, {
  mappable: true,
});

const paramsBuffer = createUniformBufferSchema("simParams", 144);
```

#### Buffer 设计原则

- `name` 必须在整个 Schema 中唯一
- `size` 应满足底层对齐要求
- `type` 用于表达抽象语义，`usage` 用于表达 WebGPU 实际用途
- `contentType` 只做类型提示，不应替代真实 WGSL 约束

### Binding System

Binding System 负责连接资源与着色器。

#### BindingSchema

```typescript
interface BindingSchema {
  binding: number;
  resource: string;
  resourceType: "buffer" | "sampler" | "texture";
  visibility: GPUShaderStageFlags;
}
```

#### BindGroupLayoutSchema

```typescript
interface BindGroupLayoutSchema {
  name: string;
  bindings: BindingSchema[];
}
```

`BindGroupLayoutSchema` 只定义槽位结构，不携带 `group`。这样同一个 Layout 可以在多个 Pipeline 中复用，并映射到不同的 `@group(N)`。

#### BindGroupSchema

```typescript
interface BindGroupEntrySchema {
  binding: number;
  resourceRef: string;
}

interface BindGroupSchema {
  name: string;
  layout: string;
  bindings: BindGroupEntrySchema[];
}
```

#### PipelineBindGroupRef

```typescript
interface PipelineBindGroupRef {
  group: number;
  layout: string;
}
```

Pipeline 决定 Layout 被放到哪个 `group`。

#### PassBindGroupRef

```typescript
interface PassBindGroupRef {
  group: number;
  bindGroupRef: string;
}
```

Pass 决定执行时哪个 BindGroup 实例被绑定到哪个 `group`。

### Shader Schema

```typescript
interface ShaderSchema {
  name: string;
  source: string;
  bindGroupLayoutRefs?: string[];
  workgroupSize?: [number, number, number];
  entryPoint: string;
}
```

设计目标：

- Shader 自身保留最少必要信息
- Layout 引用只用于声明依赖，不替代 Pipeline 的显式 group 映射
- `workgroupSize` 可以由 Shader 声明，也允许在 Compute Pipeline 侧覆盖

### Pipeline Schema

#### ComputePipelineSchema

```typescript
interface ComputePipelineSchema {
  name: string;
  type: "compute";
  shader: string;
  bindGroups: PipelineBindGroupRef[];
  workgroupSize?: [number, number, number];
}
```

#### RenderPipelineSchema

```typescript
interface RenderPipelineSchema {
  name: string;
  type: "render";
  vertexShader: string;
  fragmentShader?: string;
  bindGroups: PipelineBindGroupRef[];
  vertexInput: {
    buffers: GPUVertexBufferLayout[];
  };
  fragmentOutput?: {
    targets: GPUColorTargetState[];
  };
  depthStencil?: GPUDepthStencilState;
  primitive?: GPUPrimitiveState;
  multisample?: GPUMultisampleState;
}
```

Pipeline 设计约束：

- `bindGroups` 内的 `group` 必须唯一
- Layout 顺序必须按 `group` 明确装配到 `GPUPipelineLayout`
- 默认不暴露 `layout: "auto"`，以保留显式验证能力

### Pass Schema

#### ComputePassSchema

```typescript
type DispatchValue = number | [number, number, number];
type DispatchExpression = { expr: string };

interface ComputePassSchema {
  name: string;
  type: "compute";
  pipelineRef: string;
  bindGroups: PassBindGroupRef[];
  dispatch: DispatchValue | DispatchExpression;
}
```

#### SchemaExecutionContext

```typescript
interface SchemaExecutionContext {
  params: Record<string, number>;
  evaluateDispatch(expr: string): DispatchValue;
  reportError(message: string): void;
}
```

约束如下：

- 静态 `dispatch` 是默认路径
- `dispatch: { expr }` 是显式扩展能力，不应隐式启用
- 表达式求值器由调用方提供，Schema 核心不内置解析器
- 解析失败时应通过 `reportError` 报告，并返回安全兜底值

支持的表达式形态建议限制在可控范围内：

```typescript
"ceil(particleCount / 256)";
"[ceil(particleCount / 256), 1, 1]";
```

#### RenderPassSchema

```typescript
interface RenderPassAttachmentSchema {
  bufferRef: string;
  loadOp: "clear" | "load";
  storeOp: "store" | "discard";
  clearValue?: number[];
}

interface VertexBufferBindingRef {
  slot: number;
  bufferRef: string;
}

interface IndexBufferBindingRef {
  bufferRef: string;
  format: "uint16" | "uint32";
}

type DrawCommand =
  | {
      type: "draw";
      vertexCount: number;
      instanceCount?: number;
      firstVertex?: number;
      firstInstance?: number;
    }
  | {
      type: "drawIndexed";
      indexCount: number;
      instanceCount?: number;
      firstIndex?: number;
      baseVertex?: number;
      firstInstance?: number;
    }
  | {
      type: "drawIndirect";
      indirectBufferRef: string;
      indirectOffset?: number;
    };

interface RenderPassSchema {
  name: string;
  type: "render";
  pipelineRef: string;
  bindGroups: PassBindGroupRef[];
  colorAttachments: RenderPassAttachmentSchema[];
  depthAttachment?: RenderPassAttachmentSchema;
  vertexBufferBindings?: VertexBufferBindingRef[];
  indexBufferBinding?: IndexBufferBindingRef;
  draw: DrawCommand;
}
```

### RenderGraph Schema

```typescript
interface RenderGraphNodeSchema {
  name: string;
  passRef: string;
  dependencies?: string[];
  resources?: {
    reads?: string[];
    writes?: string[];
  };
}

interface RenderGraphSchema {
  name: string;
  nodes: RenderGraphNodeSchema[];
}
```

RenderGraph 负责描述：

- 执行顺序
- 依赖关系
- 资源读写语义
- 后续自动屏障与调度分析的基础信息

### WebGpuSimulationSchema

```typescript
interface WebGpuSimulationSchema {
  name: string;
  version: string;
  buffers: BuffersSchemaMap;
  bindGroupLayouts: BindGroupLayoutsSchemaMap;
  bindGroups: BindGroupsSchemaMap;
  shaders: ShadersSchemaMap;
  pipelines: PipelinesSchemaMap;
  passes: PassesSchemaMap;
  renderGraphs: RenderGraphsSchemaMap;
  mainGraphRef: string;
}
```

这是项目的顶层聚合对象，也是编辑器、预览器和验证器之间共享的核心交换格式。
