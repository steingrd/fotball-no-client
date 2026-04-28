import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  validateFiksUrl,
  safeFetchText,
  UrlValidationError,
  TooManyRedirectsError,
} from "../src/fetch"

describe("validateFiksUrl", () => {
  it("accepts valid fotball.no HTTPS URLs", () => {
    const url = validateFiksUrl("https://www.fotball.no/fotballdata/lag/?fiksId=12345")
    expect(url.hostname).toBe("www.fotball.no")
  })

  it("accepts fotball.no without www", () => {
    const url = validateFiksUrl("https://fotball.no/some/path")
    expect(url.hostname).toBe("fotball.no")
  })

  it("rejects HTTP URLs", () => {
    expect(() => validateFiksUrl("http://www.fotball.no/path")).toThrow(UrlValidationError)
    expect(() => validateFiksUrl("http://www.fotball.no/path")).toThrow("Only HTTPS")
  })

  it("rejects other domains", () => {
    expect(() => validateFiksUrl("https://evil.com/path")).toThrow(UrlValidationError)
    expect(() => validateFiksUrl("https://evil.com/path")).toThrow("not allowed")
  })

  it("rejects IPv4 addresses", () => {
    expect(() => validateFiksUrl("https://192.168.1.1/path")).toThrow(UrlValidationError)
    expect(() => validateFiksUrl("https://127.0.0.1/path")).toThrow("IP addresses")
  })

  it("rejects IPv6 addresses", () => {
    expect(() => validateFiksUrl("https://[::1]/path")).toThrow(UrlValidationError)
  })

  it("rejects malformed URLs", () => {
    expect(() => validateFiksUrl("not-a-url")).toThrow(UrlValidationError)
    expect(() => validateFiksUrl("")).toThrow(UrlValidationError)
  })

  it("rejects subdomains that are not allowed", () => {
    expect(() => validateFiksUrl("https://evil.fotball.no/path")).toThrow(UrlValidationError)
  })
})

describe("safeFetchText redirect handling", () => {
  const originalFetch = globalThis.fetch
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("follows redirects to allowed hosts", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://www.fotball.no/final" },
        })
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))

    const result = await safeFetchText("https://fotball.no/start", { validateUrl: true })
    expect(result).toBe("ok")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("rejects redirects to disallowed hosts when validation is enabled", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.com/steal-data" },
      })
    )

    await expect(
      safeFetchText("https://fotball.no/start", { validateUrl: true })
    ).rejects.toThrow(UrlValidationError)
  })

  it("throws TooManyRedirectsError after exceeding max redirects", async () => {
    // 6 redirects (max is 5)
    for (let i = 0; i < 6; i++) {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: `https://fotball.no/hop-${i + 1}` },
        })
      )
    }

    await expect(
      safeFetchText("https://fotball.no/start", { validateUrl: true })
    ).rejects.toThrow(TooManyRedirectsError)
  })

  it("handles redirect chains within the limit", async () => {
    // 3 redirects then a final 200
    for (let i = 0; i < 3; i++) {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: `https://www.fotball.no/hop-${i + 1}` },
        })
      )
    }
    fetchMock.mockResolvedValueOnce(new Response("final", { status: 200 }))

    const result = await safeFetchText("https://fotball.no/start", { validateUrl: true })
    expect(result).toBe("final")
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
