# GoToday

Find something worth doing near you.

## MVP
- ZIP/location entry
- Today-focused event discovery
- Category filters
- Search
- Responsive event cards
- "Find Something for Me" CTA

## Run locally

```bash
npm install
npm run dev
```

## Development

- `npm run check` — typecheck, tests and a production build (the same gate CI runs on every push).
- `npm test` — unit tests plus the **golden set** (`tests/golden/`): labelled keep/drop
  judgments for the listing filters. Add a case there before changing a filter rule.
- `npm run density` — event-density report per area against the live site; an area
  only earns promotion/expansion when it clears the gate in `scripts/density-check.ts`.
- `docs/photos.md` — when photo selection is "done": the stopping rule for photo tuning.
- City landing pages live at `/today/<city>` (e.g. `/today/fort-lauderdale`), with
  `/today/<city>/<category>` for family, kids, music, free and more.
