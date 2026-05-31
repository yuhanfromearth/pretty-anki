# anki-ui

You like Anki but can't stand how it looks?

> ⚠️ **Reality check:** no amount of prettiness will help you learn a language. In the end it comes down to putting in the hours, week after week after week. This just makes those hours a little nicer to look at.

A prettier front-end for [Anki](https://apps.ankiweb.net/). It talks to your local Anki collection through the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on and wraps it in a calm, typed web UI — deck stats, reviewing, a streak heat-map, and full deck management (search, add, edit, and delete cards with a rich-text editor).

## Prerequisites

- Node 20+
- **Anki Desktop App running** with the **AnkiConnect** add-on installed (listening on `localhost:8765`). The backend reaches it via the env var `ANKI_CONNECT_URL` (defaults to `http://localhost:8765`).

## Getting started

```sh
npm install
npm start
```

`npm start` builds the shared DTOs, then runs three watchers concurrently:

- `shared` — `tsc --watch`
- `apps/be` — NestJS on `:8080` (routes under `/api`, Swagger at `/api/docs`)
- `apps/ui` — Vite dev server on `:3000`

Open <http://localhost:3000>. The UI proxies `/api/*` to the backend, which forwards to AnkiConnect. If the header status dot is muted, Anki/AnkiConnect isn't reachable.

## Stack

- `apps/be` — NestJS 11 (ESM) backend that proxies the AnkiConnect HTTP API and validates I/O with Zod
- `apps/ui` — TanStack Start + Vite 7 + React 19 + Tailwind v4, with TipTap for card editing
- `shared` — `@nts/shared`, shared Zod schemas, inferred types, and pure utilities used by both apps
