const ALLOWED_HOSTNAMES = ["www.fotball.no", "fotball.no"]
const FETCH_TIMEOUT_MS = 10_000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024 // 2MB
const MAX_REDIRECTS = 5

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UrlValidationError"
  }
}

export class FetchTimeoutError extends Error {
  constructor() {
    super("Request timed out")
    this.name = "FetchTimeoutError"
  }
}

export class ResponseTooLargeError extends Error {
  constructor() {
    super("Response body exceeds size limit")
    this.name = "ResponseTooLargeError"
  }
}

export class TooManyRedirectsError extends Error {
  constructor() {
    super(`Too many redirects (max ${MAX_REDIRECTS})`)
    this.name = "TooManyRedirectsError"
  }
}

/**
 * Validates that a URL is a safe FIKS URL (HTTPS, fotball.no hostname, no IP addresses).
 */
export function validateFiksUrl(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new UrlValidationError("Invalid URL")
  }

  if (parsed.protocol !== "https:") {
    throw new UrlValidationError("Only HTTPS URLs are allowed")
  }

  // Block IP addresses in hostname
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname) || parsed.hostname.startsWith("[")) {
    throw new UrlValidationError("IP addresses are not allowed")
  }

  if (!ALLOWED_HOSTNAMES.includes(parsed.hostname)) {
    throw new UrlValidationError(`Hostname '${parsed.hostname}' is not allowed`)
  }

  return parsed
}

/**
 * Fetch text content with timeout and response size limit.
 */
export async function safeFetchText(
  url: string,
  options?: { validateUrl?: boolean }
): Promise<string> {
  if (options?.validateUrl) {
    validateFiksUrl(url)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    let currentUrl = url
    let redirectCount = 0
    let response: Response

    while (true) {
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
      })

      if ([301, 302, 307, 308].includes(response.status)) {
        redirectCount++
        if (redirectCount > MAX_REDIRECTS) {
          throw new TooManyRedirectsError()
        }

        const location = response.headers.get("location")
        if (!location) {
          throw new Error(`Redirect ${response.status} without Location header`)
        }

        // Resolve relative redirects against the current URL
        const redirectUrl = new URL(location, currentUrl).toString()

        if (options?.validateUrl) {
          validateFiksUrl(redirectUrl)
        }

        currentUrl = redirectUrl
        continue
      }

      break
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    if (!response.body) {
      return await response.text()
    }

    // Stream body and enforce size limit
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.byteLength
      if (totalBytes > MAX_RESPONSE_BYTES) {
        reader.cancel()
        throw new ResponseTooLargeError()
      }
      chunks.push(value)
    }

    const decoder = new TextDecoder()
    return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") +
      decoder.decode()
  } catch (error) {
    if (error instanceof UrlValidationError) throw error
    if (error instanceof ResponseTooLargeError) throw error
    if (error instanceof TooManyRedirectsError) throw error
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new FetchTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
