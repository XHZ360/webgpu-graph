import { describe, expect, it } from "vitest";
import {
  BUFFER_USAGE,
  DefaultSchemaBuilder,
  DefaultSchemaValidator,
  createStorageBufferSchema,
} from "schema";

describe("schema package entry", () => {
  it("resolves the package root to the source entry", () => {
    expect(BUFFER_USAGE.STORAGE).toBe(0x0080);
    expect(new DefaultSchemaBuilder()).toBeInstanceOf(DefaultSchemaBuilder);
    expect(new DefaultSchemaValidator()).toBeInstanceOf(DefaultSchemaValidator);
    expect(createStorageBufferSchema("positions", 64).usage).toBe(
      BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST | BUFFER_USAGE.COPY_SRC,
    );
  });
});
