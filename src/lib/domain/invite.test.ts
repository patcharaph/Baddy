import { describe, expect, it } from "vitest";

import { inviteUrl, isInviteCode, parseInviteCode } from "./invite";

const CODE = "aB3-_xYz9Qr1";

describe("isInviteCode", () => {
  it("accepts the shape the database mints", () => {
    expect(isInviteCode(CODE)).toBe(true);
  });

  it("accepts both halves of the URL-safe alphabet", () => {
    expect(isInviteCode("----____")).toBe(true);
  });

  // The reason the default was changed in 0002: these two characters are what
  // base64 emits and what a URL cannot carry.
  it("rejects the base64 characters a URL cannot carry", () => {
    expect(isInviteCode("abc+def/ghi=")).toBe(false);
  });

  it("rejects something too short to be worth guessing against", () => {
    expect(isInviteCode("abc123")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isInviteCode("")).toBe(false);
  });

  it("rejects whitespace inside the code", () => {
    expect(isInviteCode("aB3-_xYz 9Qr1")).toBe(false);
  });
});

describe("parseInviteCode", () => {
  it("takes a bare code as-is", () => {
    expect(parseInviteCode(CODE)).toBe(CODE);
  });

  it("forgives the whitespace a paste brings with it", () => {
    expect(parseInviteCode(`  ${CODE}\n`)).toBe(CODE);
  });

  it("reads the code out of a LIFF link", () => {
    expect(parseInviteCode(`https://liff.line.me/1234567890-abcdef/join/${CODE}`)).toBe(
      CODE,
    );
  });

  it("reads the code out of a plain link", () => {
    expect(parseInviteCode(`https://baddy.example/join/${CODE}`)).toBe(CODE);
  });

  // LINE appends this itself when a link is opened externally.
  it("drops the query string LINE adds to a shared link", () => {
    expect(
      parseInviteCode(`https://baddy.example/join/${CODE}?openExternalBrowser=1`),
    ).toBe(CODE);
  });

  it("drops a hash", () => {
    expect(parseInviteCode(`https://baddy.example/join/${CODE}#top`)).toBe(CODE);
  });

  it("ignores a trailing slash", () => {
    expect(parseInviteCode(`https://baddy.example/join/${CODE}/`)).toBe(CODE);
  });

  it("decodes a percent-encoded paste", () => {
    expect(parseInviteCode("https://baddy.example/join/aB3%2D_xYz9Qr1")).toBe(CODE);
  });

  it("survives a malformed escape rather than throwing", () => {
    expect(parseInviteCode("https://baddy.example/join/%E0%A4%A")).toBeNull();
  });

  // Case matters: base64url uses both, so folding case would hand back a code
  // that looks right and resolves to nothing.
  it("does not change the case of the code", () => {
    expect(parseInviteCode("ABCDEFGHIJKL")).toBe("ABCDEFGHIJKL");
    expect(parseInviteCode("abcdefghijkl")).toBe("abcdefghijkl");
  });

  it("returns null for a link with no code in it", () => {
    expect(parseInviteCode("https://baddy.example/join")).toBeNull();
  });

  it("returns null for something that is not an invite at all", () => {
    expect(parseInviteCode("สวัสดีครับ")).toBeNull();
  });

  it("returns null for an empty paste", () => {
    expect(parseInviteCode("   ")).toBeNull();
  });
});

describe("inviteUrl", () => {
  it("prefers the LIFF form so the link opens signed in", () => {
    expect(inviteUrl({ code: CODE, liffId: "1234-abcd", origin: "https://x.test" })).toBe(
      `https://liff.line.me/1234-abcd/join/${CODE}`,
    );
  });

  it("falls back to the app's own origin without a LIFF id", () => {
    expect(inviteUrl({ code: CODE, liffId: "", origin: "https://baddy.example" })).toBe(
      `https://baddy.example/join/${CODE}`,
    );
  });

  it("does not double the slash when the origin has a trailing one", () => {
    expect(inviteUrl({ code: CODE, liffId: "", origin: "https://baddy.example/" })).toBe(
      `https://baddy.example/join/${CODE}`,
    );
  });

  it("round-trips through parseInviteCode", () => {
    const url = inviteUrl({ code: CODE, liffId: "1234-abcd", origin: "https://x.test" });
    expect(parseInviteCode(url)).toBe(CODE);
  });
});
