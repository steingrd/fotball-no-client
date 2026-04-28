import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { parseMatchList, parseMatchResult, parseLogo } from "../src/parser"

const fixturesDir = path.resolve(__dirname, "fixtures")
const readFixture = (name: string) => fs.readFileSync(path.join(fixturesDir, name), "utf-8")

describe("parseMatchList", () => {
  it("parses played matches with scores", () => {
    const html = readFixture("match-list.html")
    const matches = parseMatchList(html)

    expect(matches).toHaveLength(3)
    expect(matches[0]).toMatchObject({
      fiksId: "8710735",
      homeName: "Brann 2",
      awayName: "Fyllingsdalen",
      homeGoals: 3,
      awayGoals: 1,
      tournament: "3. divisjon avd. 1",
    })
  })

  it("parses unplayed matches with null scores", () => {
    const html = readFixture("match-list.html")
    const matches = parseMatchList(html)

    const unplayed = matches.find((m) => m.fiksId === "8710736")!
    expect(unplayed.homeGoals).toBeNull()
    expect(unplayed.awayGoals).toBeNull()
    expect(unplayed.homeName).toBe("Fyllingsdalen")
    expect(unplayed.awayName).toBe("Brann 2")
  })

  it("extracts fiksId from date cell link", () => {
    const html = readFixture("match-list.html")
    const matches = parseMatchList(html)

    expect(matches.map((m) => m.fiksId)).toEqual(["8710735", "8710736", "8710737"])
  })

  it("parses dates correctly", () => {
    const html = readFixture("match-list.html")
    const matches = parseMatchList(html)

    const first = matches[0]
    expect(first.date.getFullYear()).toBe(2025)
    expect(first.date.getMonth()).toBe(3) // April = 3 (0-indexed)
    expect(first.date.getDate()).toBe(15)
    expect(first.date.getHours()).toBe(19)
    expect(first.date.getMinutes()).toBe(0)
  })

  it("parses tournament column", () => {
    const html = readFixture("match-list.html")
    const matches = parseMatchList(html)

    expect(matches[2].tournament).toBe("OBOS-ligaen")
  })

  it("returns empty array for HTML without match table", () => {
    const matches = parseMatchList("<html><body><p>No matches here</p></body></html>")
    expect(matches).toEqual([])
  })

  it("skips rows without fiksId link", () => {
    const html = `
      <table class="customSorterAtomicMatches">
      <tbody>
        <tr><td>15.04.2025</td><td>Tir</td><td>19:00</td><td>Home</td><td>1 - 0</td><td>Away</td></tr>
      </tbody>
      </table>
    `
    const matches = parseMatchList(html)
    expect(matches).toEqual([])
  })

  it("skips rows with fewer than 6 columns", () => {
    const html = `
      <table class="customSorterAtomicMatches">
      <tbody>
        <tr><td><a href="/fotballdata/kamp/?fiksId=123">15.04.2025</a></td><td>Tir</td></tr>
      </tbody>
      </table>
    `
    const matches = parseMatchList(html)
    expect(matches).toEqual([])
  })
})

describe("parseMatchResult", () => {
  it("extracts score from .match-result div", () => {
    const html = readFixture("match-result.html")
    const result = parseMatchResult(html)

    expect(result).toEqual({ homeGoals: 3, awayGoals: 1 })
  })

  it("falls back to og:title meta tag", () => {
    const html = `
      <html>
      <head><meta property="og:title" content="Brann 2 vs Fyllingsdalen 2 - 0" /></head>
      <body></body>
      </html>
    `
    const result = parseMatchResult(html)
    expect(result).toEqual({ homeGoals: 2, awayGoals: 0 })
  })

  it("returns null when no score found", () => {
    const result = parseMatchResult("<html><body>No score here</body></html>")
    expect(result).toBeNull()
  })

  it("handles score with extra whitespace", () => {
    const html = '<html><body><div class="match-result">  2  -  3  </div></body></html>'
    const result = parseMatchResult(html)
    expect(result).toEqual({ homeGoals: 2, awayGoals: 3 })
  })

  it("handles .score class", () => {
    const html = '<html><body><div class="score">1 - 1</div></body></html>'
    const result = parseMatchResult(html)
    expect(result).toEqual({ homeGoals: 1, awayGoals: 1 })
  })

  it("handles .result class", () => {
    const html = '<html><body><div class="result">0 - 4</div></body></html>'
    const result = parseMatchResult(html)
    expect(result).toEqual({ homeGoals: 0, awayGoals: 4 })
  })
})

describe("parseLogo", () => {
  it("extracts logo from og:image meta tag", () => {
    const html = readFixture("team-with-logo.html")
    const logoUrl = parseLogo(html)

    expect(logoUrl).toBe("https://www.fotball.no/images/team/brann-logo.png")
  })

  it("returns null when no logo found", () => {
    const html = readFixture("team-no-logo.html")
    const logoUrl = parseLogo(html)

    expect(logoUrl).toBeNull()
  })

  it("finds logo in img tag with logo class", () => {
    const html = '<html><body><img class="team-logo" src="https://example.com/logo.png" /></body></html>'
    const logoUrl = parseLogo(html)
    expect(logoUrl).toBe("https://example.com/logo.png")
  })

  it("finds logo in img src containing 'logo'", () => {
    const html = '<html><body><img src="https://example.com/team-logo-large.png" /></body></html>'
    const logoUrl = parseLogo(html)
    expect(logoUrl).toBe("https://example.com/team-logo-large.png")
  })

  it("prepends fotball.no domain for relative URLs", () => {
    const html = '<html><body><img class="club-logo" src="/images/logo.png" /></body></html>'
    const logoUrl = parseLogo(html)
    expect(logoUrl).toBe("https://www.fotball.no/images/logo.png")
  })

  it("prefers og:image over img tags", () => {
    const html = `
      <html>
      <head><meta property="og:image" content="https://example.com/og-logo.png" /></head>
      <body><img class="logo" src="https://example.com/other-logo.png" /></body>
      </html>
    `
    const logoUrl = parseLogo(html)
    expect(logoUrl).toBe("https://example.com/og-logo.png")
  })
})
