# OvoStreams.TOP

Static sports streaming aggregator for Cloudflare Pages using plain HTML, CSS, and vanilla JavaScript.

## Overview

OvoStreams fetches live match data from `https://ovo.ppvtv.top/api/matches` and renders:

- An all-sports homepage at `index.html`
- Sport landing pages at `football.html`, `basketball.html`, and `ufc.html`
- Additional category pages at `nfl.html` and `baseball.html`
- A match watch page at `match.html?id={id}&title={slug}`
- A custom 404 page and Cloudflare Pages route aliases

The site uses session storage caching for 55 seconds, auto-refreshes match data every 60 seconds, and renders stream placeholders when the API reports zero available streams.

## Local Preview

From the repo root:

```powershell
python -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Cloudflare Pages

- Build command: leave blank, or use `echo ok`
- Output directory: `/`
- Framework preset: None
- Custom domain: `ovostreams.top`

## Route Map

- `/` -> all sports homepage
- `/football` and `/soccer` -> football landing page
- `/basketball` and `/nba` -> basketball landing page
- `/nfl`, `/american-football`, and `/americanfootball` -> NFL landing page
- `/baseball`, `/mlb`, and `/major-league-baseball` -> baseball landing page
- `/ufc` and `/mma` -> UFC landing page
- `/watch/*` and `/stream/*` -> match watch page

## Key Files

- `index.html` - all sports homepage
- `football.html` - football landing page
- `basketball.html` - basketball landing page
- `ufc.html` - UFC landing page
- `nfl.html` - NFL landing page
- `baseball.html` - baseball landing page
- `match.html` - dynamic watch page
- `assets/js/app.js` - homepage fetching, filtering, caching, rendering
- `assets/js/match.js` - match resolution, player logic, dynamic metadata, JSON-LD
- `assets/js/utils.js` - shared helpers and category route mapping
- `_redirects` - Cloudflare Pages route aliases
- `_worker.js` - cache headers for static assets
