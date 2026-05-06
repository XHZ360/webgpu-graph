import { describe, expect, it } from "vitest";
import { createPreviewFrame, getRequiredDeviceLimits } from "preview";

describe("preview package entry", () => {
  it("resolves the package root to the source entry", () => {
    expect(createPreviewFrame("<div />")).toEqual({ html: "<div />" });
  });

  it("exports the device limit helper", () => {
    expect(getRequiredDeviceLimits).toBeTypeOf("function");
  });
});
