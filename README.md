# fotball-no-client

TypeScript-bibliotek for å hente og parse kamper, kampresultater og laglogoer fra [fotball.no](https://www.fotball.no) (FIKS).

## Installasjon

```bash
npm install @steingrd/fotball-no-client
```

Krever Node.js 18 eller nyere (bruker innebygd `fetch`).

## Bruk

```ts
import { safeFetchText, parseMatchList, parseMatchResult, parseLogo } from "@steingrd/fotball-no-client"

// Hent kampliste for et lag
const html = await safeFetchText("https://www.fotball.no/lag/...", { validateUrl: true })
const matches = parseMatchList(html)

// Hent enkelt kampresultat
const matchHtml = await safeFetchText(`https://www.fotball.no/fotballdata/kamp/?fiksId=${id}`)
const result = parseMatchResult(matchHtml)

// Hent laglogo
const logoUrl = parseLogo(html)
```

## API

### Parser

- `parseMatchList(html: string): ParsedMatch[]` — parser kamplisten i en lagside
- `parseMatchResult(html: string): { homeGoals, awayGoals } | null` — parser sluttresultatet i en kampside
- `parseLogo(html: string): string | null` — parser laglogo-URL fra en lagside

### Fetch

- `safeFetchText(url, options?)` — HTTP GET med timeout, størrelsesgrense og redirect-håndtering
- `validateFiksUrl(url): URL` — kaster `UrlValidationError` hvis ikke `https://(www.)fotball.no`

Feiltyper: `UrlValidationError`, `FetchTimeoutError`, `ResponseTooLargeError`, `TooManyRedirectsError`.

## Testing

```bash
npm test
```
