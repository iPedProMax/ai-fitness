import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aiModelCatalog } from "./model-catalog";

describe("Phase U2 Mistral Text AI-only guard", () => {
  it("does not advertise Mistral for photo uploads", () => {
    const model = aiModelCatalog.find(item => item.id === "mistral");
    expect(model?.text).toBe(true);
    expect(model?.vision).toBe(false);
    expect(model?.maxImages).toBe(0);
  });
  it("rejects every nonzero Mistral image count at the server selector", () => {
    const source = readFileSync(join(process.cwd(),"src/lib/ai/selected-model.ts"),"utf8");
    expect(source).toContain('(model === "mistral" && imageCount > 0)');
  });
});
