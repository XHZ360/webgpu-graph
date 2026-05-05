import { describe, expect, it } from "vitest";
import { createPreviewFrame } from "preview";

describe("preview package entry", () => {
  it("resolves the package root to the source entry", () => {
    expect(createPreviewFrame("<div />")).toEqual({ html: "<div />" });
  });
});
