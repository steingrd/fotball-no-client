import * as cheerio from "cheerio"

export interface ParsedMatch {
  fiksId: string
  date: Date
  homeName: string
  awayName: string
  homeGoals: number | null
  awayGoals: number | null
  tournament: string | null
}

/**
 * Parses a FIKS team page HTML to extract the match list.
 * Expects a table with class "customSorterAtomicMatches".
 */
export function parseMatchList(html: string): ParsedMatch[] {
  const $ = cheerio.load(html)
  const matches: ParsedMatch[] = []

  $("table.customSorterAtomicMatches tbody tr").each((_, row) => {
    const $row = $(row)
    const cells = $row.find("td")

    if (cells.length < 6) return

    const dateLink = $(cells[0]).find("a").attr("href")
    const fiksIdMatch = dateLink?.match(/fiksId=(\d+)/)
    if (!fiksIdMatch) return
    const fiksId = fiksIdMatch[1]

    const dateText = $(cells[0]).text().trim()
    const timeText = $(cells[2]).text().trim()
    const homeName = $(cells[3]).text().trim()
    const scoreText = $(cells[4]).text().trim()
    const awayName = $(cells[5]).text().trim()

    const tournament = cells.length > 7 ? $(cells[7]).text().trim() : ""

    const dateMatch = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})/)
    const timeMatch = timeText.match(/(\d{2}):(\d{2})/)

    if (!dateMatch || !timeMatch) return

    const [, day, month, year] = dateMatch
    const [, hour, minute] = timeMatch

    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    )

    let homeGoals: number | null = null
    let awayGoals: number | null = null

    const scoreMatch = scoreText.match(/(\d+)\s*-\s*(\d+)/)
    if (scoreMatch) {
      homeGoals = parseInt(scoreMatch[1])
      awayGoals = parseInt(scoreMatch[2])
    }

    if (homeName && awayName) {
      matches.push({
        fiksId,
        date,
        homeName,
        awayName,
        homeGoals,
        awayGoals,
        tournament: tournament || null,
      })
    }
  })

  return matches
}

/**
 * Parses a FIKS match page HTML to extract the match result.
 * Tries .match-result/.score/.result first, falls back to og:title meta tag.
 */
export function parseMatchResult(html: string): { homeGoals: number; awayGoals: number } | null {
  const $ = cheerio.load(html)

  const scoreText = $(".match-result, .score, .result").first().text().trim()
  const scoreMatch = scoreText.match(/(\d+)\s*-\s*(\d+)/)

  if (scoreMatch) {
    return { homeGoals: parseInt(scoreMatch[1]), awayGoals: parseInt(scoreMatch[2]) }
  }

  const ogTitle = $('meta[property="og:title"]').attr("content") || ""
  const titleScoreMatch = ogTitle.match(/(\d+)\s*-\s*(\d+)/)
  if (titleScoreMatch) {
    return { homeGoals: parseInt(titleScoreMatch[1]), awayGoals: parseInt(titleScoreMatch[2]) }
  }

  return null
}

/**
 * Parses a FIKS team page HTML to extract the team logo URL.
 * Tries og:image meta tag first, then common logo patterns in img tags.
 */
export function parseLogo(html: string): string | null {
  const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)
  if (ogImageMatch) {
    return ogImageMatch[1]
  }

  const logoPatterns = [
    /<img[^>]*class="[^"]*logo[^"]*"[^>]*src="([^"]*)"/i,
    /<img[^>]*src="([^"]*logo[^"]*)"/i,
    /<img[^>]*alt="[^"]*logo[^"]*"[^>]*src="([^"]*)"/i,
  ]

  for (const pattern of logoPatterns) {
    const match = html.match(pattern)
    if (match) {
      let logoUrl = match[1]
      if (logoUrl.startsWith("/")) {
        logoUrl = `https://www.fotball.no${logoUrl}`
      }
      return logoUrl
    }
  }

  return null
}
