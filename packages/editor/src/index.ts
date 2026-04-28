export type EditorState = {
  selectedId: string | null;
};

export function createEditorState(): EditorState {
  return { selectedId: null };
}
