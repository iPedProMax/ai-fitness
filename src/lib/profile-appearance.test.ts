import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AVATAR_BUCKET, MAX_AVATAR_INPUT_BYTES, MAX_AVATAR_OUTPUT_BYTES,
  AVATAR_PIXEL_SIZE, normalizeFocus, safeAvatarPath, validateProfileBio, validateProfileName,
} from "./profile-appearance";

describe("Khalories profile and avatar safety", () => {
  it("accepts human display names and rejects empty/oversized names", () => {
    expect(validateProfileName("  Ped  ")).toBe("Ped");
    expect(validateProfileName(" ")).toBeNull();
    expect(validateProfileName("x".repeat(41))).toBeNull();
    expect(validateProfileName("a\nb")).toBeNull();
  });
  it("keeps profile taglines short", () => {
    expect(validateProfileBio(" Small steps ")).toBe("Small steps");
    expect(validateProfileBio("x".repeat(141))).toBeNull();
  });
  it("never trusts an arbitrary storage path", () => {
    expect(safeAvatarPath("u123", "u123/avatar.webp")).toBe("u123/avatar.webp");
    expect(safeAvatarPath("u123", "u456/avatar.webp")).toBeNull();
    expect(safeAvatarPath("u123", "../../other.webp")).toBeNull();
  });
  it("uses a private, bounded, compressed avatar", () => {
    expect(AVATAR_BUCKET).toBe("khalories-avatars");
    expect(AVATAR_PIXEL_SIZE).toBe(256);
    expect(MAX_AVATAR_OUTPUT_BYTES).toBe(128 * 1024);
    expect(MAX_AVATAR_INPUT_BYTES).toBe(6 * 1024 * 1024);
    expect(normalizeFocus("nonsense")).toBe("balanced");
  });
  it("never grants profile metadata security privileges", () => {
    const source = readFileSync("src/components/profile-personalization.tsx", "utf8");
    expect(source).toContain("auth.getUser()");
    expect(source).toContain("auth.updateUser(");
    expect(source).toContain("compressAvatar(file)");
    expect(source).toContain(".upload(path, compressed");
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("is_admin");
  });
});
