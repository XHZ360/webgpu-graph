export type WorkgroupSize = [number, number, number];

export interface ShaderSchema {
  name: string;
  source: string;
  bindGroupLayoutRefs?: string[];
  workgroupSize?: WorkgroupSize;
  entryPoint: string;
}
