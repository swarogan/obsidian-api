import { describe, it, expect } from "vitest";
import { verifyApiKey } from "../../src/middleware/auth";

describe("verifyApiKey", () => {
  it("returns true for matching keys", () => {
    expect(verifyApiKey("test-key-123", "test-key-123")).toBe(true);
  });

  it("returns false for non-matching keys", () => {
    expect(verifyApiKey("wrong-key", "test-key-123")).toBe(false);
  });

  it("returns false for different length keys", () => {
    expect(verifyApiKey("short", "much-longer-key")).toBe(false);
  });

  it("returns false for empty provided key", () => {
    expect(verifyApiKey("", "test-key")).toBe(false);
  });

  it("returns false for empty expected key", () => {
    expect(verifyApiKey("test-key", "")).toBe(false);
  });

  it("returns false for both empty", () => {
    expect(verifyApiKey("", "")).toBe(false);
  });

  it("handles unicode keys", () => {
    expect(verifyApiKey("klucz-żółć", "klucz-żółć")).toBe(true);
    expect(verifyApiKey("klucz-żółć", "klucz-zolc")).toBe(false);
  });

  it("handles long keys", () => {
    const longKey = "a".repeat(1000);
    expect(verifyApiKey(longKey, longKey)).toBe(true);
    expect(verifyApiKey(longKey, "b".repeat(1000))).toBe(false);
  });
});
