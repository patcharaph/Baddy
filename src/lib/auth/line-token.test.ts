import { describe, expect, it, vi } from "vitest";

import { syntheticEmailFor, verifyLineIdToken } from "./line-token";

const CHANNEL = "1234567890";

function fakeFetch(body: unknown, { status = 200 }: { status?: number } = {}) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

const validPayload = {
  iss: "https://access.line.me",
  sub: "U1234567890abcdef",
  aud: CHANNEL,
  exp: Math.floor(Date.now() / 1000) + 3600,
  name: "แชมป์",
  picture: "https://profile.line-scdn.net/abc",
};

describe("verifyLineIdToken", () => {
  it("returns the profile for a token LINE accepts", async () => {
    const result = await verifyLineIdToken("tok", CHANNEL, fakeFetch(validPayload));

    expect(result).toEqual({
      ok: true,
      profile: {
        userId: "U1234567890abcdef",
        displayName: "แชมป์",
        pictureUrl: "https://profile.line-scdn.net/abc",
      },
    });
  });

  it("sends the token and channel id to LINE as form data", async () => {
    const fetchImpl = fakeFetch(validPayload);
    await verifyLineIdToken("tok", CHANNEL, fetchImpl);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("https://api.line.me/oauth2/v2.1/verify");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toBe(`id_token=tok&client_id=${CHANNEL}`);
  });

  it("rejects a token issued for another channel", async () => {
    const result = await verifyLineIdToken(
      "tok",
      CHANNEL,
      fakeFetch({ ...validPayload, aud: "9999999999" }),
    );

    expect(result).toEqual({ ok: false, reason: "token นี้ออกให้ channel อื่น" });
  });

  it("rejects an expired token", async () => {
    const result = await verifyLineIdToken(
      "tok",
      CHANNEL,
      fakeFetch({ ...validPayload, exp: Math.floor(Date.now() / 1000) - 10 }),
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/หมดอายุ/);
  });

  it("passes LINE's own error message through", async () => {
    const result = await verifyLineIdToken(
      "tok",
      CHANNEL,
      fakeFetch(
        { error: "invalid_request", error_description: "Invalid IdToken." },
        { status: 400 },
      ),
    );

    expect(result).toEqual({ ok: false, reason: "Invalid IdToken." });
  });

  it("rejects a payload with no user id", async () => {
    const result = await verifyLineIdToken(
      "tok",
      CHANNEL,
      fakeFetch({ ...validPayload, sub: undefined }),
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/user id/);
  });

  it("does not call LINE at all without a token", async () => {
    const fetchImpl = fakeFetch(validPayload);
    const result = await verifyLineIdToken("", CHANNEL, fetchImpl);

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("says so when the channel id is not configured", async () => {
    const result = await verifyLineIdToken("tok", "", fakeFetch(validPayload));
    expect(result.ok === false && result.reason).toMatch(/LINE_CHANNEL_ID/);
  });

  it("reports a network failure instead of throwing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const result = await verifyLineIdToken("tok", CHANNEL, fetchImpl);
    expect(result.ok === false && result.reason).toMatch(/ติดต่อ LINE ไม่ได้/);
  });

  it("survives a non-JSON response", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>502</html>", { status: 502 }),
    ) as unknown as typeof fetch;

    const result = await verifyLineIdToken("tok", CHANNEL, fetchImpl);
    expect(result.ok === false && result.reason).toMatch(/อ่านไม่ได้/);
  });

  it("treats a missing name and picture as absent, not as a failure", async () => {
    const result = await verifyLineIdToken(
      "tok",
      CHANNEL,
      fakeFetch({ ...validPayload, name: undefined, picture: undefined }),
    );

    expect(result.ok).toBe(true);
    expect(result.ok === true && result.profile.displayName).toBeNull();
  });
});

describe("syntheticEmailFor", () => {
  it("is deterministic, so the same LINE user maps to the same account", () => {
    expect(syntheticEmailFor("U123")).toBe(syntheticEmailFor("U123"));
  });

  it("uses a domain that can never receive mail", () => {
    expect(syntheticEmailFor("U123")).toMatch(/@baddy\.invalid$/);
  });

  it("keeps different users apart", () => {
    expect(syntheticEmailFor("U123")).not.toBe(syntheticEmailFor("U456"));
  });
});
