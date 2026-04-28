export type NodeSchema = {
  id: string;
  label: string;
};

export function createNodeSchema(id: string, label: string): NodeSchema {
  return { id, label };
}
