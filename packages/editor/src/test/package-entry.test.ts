import { describe, expect, it } from "vitest";
import { createEditorState } from "editor";

describe("editor package entry", () => {
  it("resolves the package root to the source entry", () => {
    expect(createEditorState()).toEqual({ selectedId: null });
  });
});
