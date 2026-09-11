# Dial — Custom New Tab

A speed-dial / dashboard replacement for Brave's new tab page, in the spirit of Opera GX's speed dial: a live clock (with a world clock for other timezones), a quick search bar, a drag-to-reorder shortcut grid, an in-depth weather view, news with thumbnails, stocks/currency/gold, background music, notes, to-dos, a junk cleaner, and a live CPU/RAM monitor — all stored locally, all with swappable data sources where it matters, and fully yours to re-theme.

## Install (unpacked, for personal use)

Brave doesn't allow installing arbitrary extensions from the Web Store submission flow without review, but loading your own **unpacked** extension is fully supported and is how you'll use this:

1. Open `brave://extensions` in Brave.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder (`gx-dial/`) — the one containing `manifest.json`.
5. Open a new tab. Your dashboard replaces the default page immediately.

If you already had an earlier version loaded, just click the reload icon for it on `brave://extensions` instead of loading it again.

If you ever want another extension's new-tab page back, just disable or remove this one from `brave://extensions`.

## What's included

- **Draggable, resizable dashboard** — click the "Arrange widgets" dock icon (or Settings → Widgets) to enter layout-edit mode: every on-canvas widget gets a drag handle and a resize corner, plus a translucent alignment grid over the wallpaper with a highlighted center line so you can line things up symmetrically. Dragging snaps to a 1% grid and magnet-snaps to dead-center. Drag to reposition, drag the corner to resize, click "Done arranging" when finished. "Reset positions" puts everything back to the default layout.
- **Per-widget enable/disable** — Settings → Widgets lists Weather, Clock, World clock, Search bar, Speed dial grid, News, and Markets, each with its own on/off switch.
- **Live clock + date + greeting**, with 6 selectable styles (Settings → Clock style): Digital, a glowing **Nixie tube** face, an **Analog** dial, a **Flip** split-flap board, an **LED** digital-watch face, and a **Minimal** thin-type face. Date and greeting text colors are independently customizable with their own color pickers. The greeting adapts to time of day and to an optional name you set in Settings.
- **World clock** — an optional widget (off by default; enable in Settings → Widgets) showing one or more other timezones, each with a live time, city name, UTC offset, and a real photo of a landmark associated with that city (the Eiffel Tower for Paris, Big Ben for London, the Statue of Liberty for New York, etc.). Pick cities in Settings → World clock. Two display styles:
  - **Classic row**: all cities side by side, scrollable if they don't fit — the scrollbar (here and on every other scrollable widget: News, Markets, the dial grid) is themed to match the dashboard instead of your OS's default white scrollbar.
  - **Rotating door**: shows exactly 2 cities at a time; scroll over the widget to "flip" to the next city, with a smooth 3D rotation rather than a plain slide. With 2 or fewer cities this behaves the same as Classic row.
  
  The clock math itself is pure client-side (`Intl` timezone APIs) — the only network cost is loading each city's photo once, and browsers cache images aggressively so that's a one-time cost, not a per-tab one.
- **Fonts** — 4 typography presets (Settings → Font): Default, a pixel-art **Retro** look, a serif **Elegant** look, and a clean **Modern** sans. Affects headings, body text, and most clock styles.
- **Command bar** — type a search term or a URL. Picks Brave Search, Google, DuckDuckGo, or Bing per your default (or per-search using the dropdown).
- **Speed dial grid** — click **Add** to create a shortcut (favicon is pulled automatically from the site, with a letter-tile fallback). Hover a tile and click the pencil to edit or delete it. Drag tiles to reorder within the grid.
- **News widget with thumbnails** — headlines from RSS feeds you choose (Settings → News feeds; BBC News and Hacker News are in by default), each shown with a thumbnail image when the feed provides one. Fetched through the free [rss2json.com](https://rss2json.com) proxy so feeds without CORS support still work in the browser. Click the ⟳ on the widget to refresh, or wait for the 30-minute auto-refresh.
- **Markets widget — Stocks, Currency, and Gold in one place**, switchable via tabs so the dashboard doesn't need three separate widgets:
  - **Stocks**: live quotes and a colored trend sparkline for tickers you pick. Choose between two independent, swappable sources in Settings → Markets → Stocks — **Finnhub** or **Twelve Data** — each has its own key field, and both are saved at once so switching sources never loses the other key. The sparkline is built from prices sampled locally over time (not a provider history endpoint), so it works identically on either source and starts filling in after a few refreshes. Refresh interval is adjustable (5–60 min, default 10) — free-tier plans cap daily/per-minute calls, and each ticker uses one call per refresh, so more tickers or a shorter interval burns through quota faster.
  - **Currency**: exchange rates for pairs you pick (e.g. USD → EUR), sourced from **Frankfurter** (European Central Bank reference rates, no key, stable for years) or **Open ER-API** as a no-key backup.
  - **Gold**: spot price per troy ounce in a currency you choose, off by default (toggle "Show gold price" in Settings → Markets → Gold).
  - All three refresh automatically (stocks every 5 min, currency/gold every 15 min) and can also be refreshed on demand via the ⟳ on the widget.
- **Notes drawer** — a persistent scratchpad (bottom-right dock icon).
- **To-do drawer** — a simple checklist (bottom-right dock icon).
- **Music player** — click **Add tracks** to build a playlist from audio files on your device (nothing is streamed from the web). Play/pause, skip, seek, volume, and a dedicated mute toggle. Playback stops if you close that tab — it's not a persistent background service.
- **Weather, with 3 widget styles and a full detail view** — Settings → Weather → Widget display picks how much shows up on the canvas itself:
  - **Simple**: just temperature and city (the original compact chip).
  - **Day recap**: current temp, condition, feels-like, a short plain-language recap, and mini stats (AQI, wind, humidity).
  - **Week recap**: a compact 7-day strip (day, icon, high/low), sized to stay readable without taking over the dashboard.
  
  Day and Week pull in extra detail (and a week-long forecast) on the same 30-minute schedule as the rest of the weather data — Simple mode never fetches that extra data, so it stays as network-light as before. Click any of the three to open a full **Weather** drawer with feels-like (on a color gradient with a position marker), cloud cover and precipitation (fill bars), wind (speed, gusts, and direction on a small compass), humidity (a bar-graph style readout) and dew point, a UV index gauge, an air-quality gauge (via Open-Meteo's separate Air Quality API), visibility and pressure (fill bars), and moon phase (computed locally — accurate for today regardless of API status). The detail data source is swappable at the bottom of that drawer (**Open-Meteo**, **wttr.in**, or best-effort **Met.no**) — different sources support different fields, so a card may show "–" depending on which you pick. **This detail view is lazy-loaded** for Simple mode: it only fetches when you open the drawer, not on every new tab.
- **Junk Cleaner** — clears cache, cookies, history, downloads, autofill data, service workers, and storage, scoped to a time window you pick (last hour up to everything). Also lists and closes "stale" tabs you haven't touched in a while, and can optionally auto-sweep (last hour only) each time Brave starts.
- **Resource Monitor** — live system-wide CPU/RAM gauges and an optional auto-suspend limiter that discards your least-recently-used background tabs (never the active, pinned, or audible ones) to keep the browser's footprint down, with a small activity log.
- **Live wallpapers** — under Settings → Background, choose **Image** or **Live video** and pick a file from your computer; a dim-overlay slider keeps everything readable.
- **Color schemes** — 6 accent presets (magenta, lime, sunset, violet, ice, toxic) plus a **custom** option with two color pickers for your own primary/secondary accent.
- **Full backup / restore** — Settings → Backup & restore exports everything (widget positions and sizes, accent/fonts/colors, background choice, clock style, weather/news/markets configuration, and your shortcuts) as one JSON file, and imports it back — the whole point being that setting this up on a second browser or account is "load one file," not "redo forty settings." A few deliberate exclusions, shown in the Settings hint too: notes, to-dos, and your music playlist's audio files stay device-local (not really "configuration," and the playlist could be large); a video wallpaper over 15MB is left out of the export (re-pick it after importing) so the backup file doesn't balloon; and since any API keys you've entered (Finnhub, Twelve Data) are part of your settings, they're included in the file in plain text — treat the exported file like you would any file with credentials in it.
- **Settings drawer** — accent theme, fonts, background style, clock style + text colors, widget layout controls, world clock, news feeds, markets (stocks/currency/gold sources), default search engine, your name, full backup/restore, JSON export/import for just shortcuts, and a full reset.

Everything is saved with `chrome.storage.local` or, for larger files (wallpaper video/images, playlist tracks), the browser's local IndexedDB — nothing leaves your machine except what's noted below.

Note: on narrow windows (under ~640px wide), the free-form drag/resize layout switches to a simple stacked column automatically, since dragging small widgets doesn't work well on small screens.

## Notes on permissions

This version needs considerably more than the original dial-and-notes build, because of the Cleaner/Monitor widgets:

- `storage` — saves your shortcuts, notes, to-dos, settings, and (via IndexedDB) wallpaper/playlist files, all locally.
- `system.cpu`, `system.memory` — read by the Resource Monitor to draw the CPU/RAM gauges. These are **system-wide** figures; Brave doesn't expose the browser's own process usage to extensions.
- `tabs` — lets the Resource Monitor list/discard background tabs, and lets the Junk Cleaner count and close stale tabs.
- `alarms`, `notifications` — the Resource Monitor's periodic background check, and the optional "tab suspended" notification.
- `browsingData` — what the Junk Cleaner actually uses to clear cache/cookies/history/downloads/etc. within the time range you choose.
- `history`, `downloads`, `cookies` — used only to show counts in the Junk Cleaner's stats row (how many history items, downloads, cookies you currently have) before you decide what to clear.
- `host_permissions: <all_urls>` — required by the `cookies` API to enumerate/count cookies across every site rather than one at a time.
- A background service worker (`js/background.js`) runs the Resource Monitor's periodic check and the optional auto-sweep on browser startup; it does no network requests of its own.

I read through every line of the Cleaner/Monitor code before merging it in: there's no `fetch`, no remote endpoints, no analytics — everything reads/writes only through the browser's own local extension APIs. That said, `<all_urls>` + `cookies` + `history` is real access, worth knowing about even though nothing here misuses it. If that trade-off isn't worth it for you, the safest fix is to remove the Cleaner/Monitor drawers, their dock buttons, and the `js/cleaner-widget.js` / `js/monitor-widget.js` / `js/resource-helpers.js` / `js/background.js` script tags from `newtab.html`, then trim `manifest.json` back down to just `"permissions": ["storage"]` with no `background` block or `host_permissions` — happy to do that split for you if you'd rather run two lighter extensions instead of one with broad access.

The weather (basic chip), weather detail, news, currency, and gold widgets make direct requests to their respective public APIs from the page — no key needed for Open-Meteo, wttr.in, Met.no, rss2json, Frankfurter, Open ER-API, or Goldprice.org. The Markets → Stocks tab sends your ticker requests to whichever provider you pick (Finnhub or Twelve Data) along with the API key you provide — that's between you and them, per their own terms. Only "Use my location" for weather asks your browser for location access, the same way any website would. The World clock widget's landmark photos are hotlinked directly from Pexels' image CDN (`images.pexels.com`) — free to use per [Pexels' license](https://www.pexels.com/license/), no attribution required. **I could not actually verify these load in a live browser** — my own sandbox's network is restricted to a small allowlist that doesn't include image CDNs, so both my test tooling and my test browser got blocked before ever reaching Pexels. If a city's photo doesn't show up for you, the card still works fine (time, city, and offset stay fully visible against a plain dark background) — please let me know which one and I'll swap in a different photo ID.

## Why sources are swappable, not hardcoded

Free data APIs come and go — rate limits change, services shut down, terms shift. Rather than hardcode one source per data type, most widgets here let you pick from a short list of providers (and the code is written so a new one is easy to add), so if one goes offline, you switch a setting instead of waiting for an update:

- **Weather detail**: Open-Meteo / wttr.in / Met.no
- **Stocks**: Finnhub / Twelve Data
- **Currency**: Frankfurter / Open ER-API
- **Gold**: Goldprice.org today; if it goes offline, tell me the replacement and I'll wire it into the same picker

The compact weather chip and the news reader are the exceptions — they're pinned to Open-Meteo and rss2json respectively, since those have been reliable enough that adding a picker wasn't worth the complexity. If either becomes a problem, they can get the same multi-source treatment.

## Auto-refresh intervals

- **Weather (chip)**: every 30 minutes (or click the chip to refresh on demand)
- **Weather (detail drawer)**: lazy-loaded — only fetched when you open the drawer, and only re-fetched if the cached data is more than 15 minutes old
- **News**: every 30 minutes (or click the ⟳ on the widget)
- **Markets → Stocks**: every 10 minutes by default, adjustable (5–60 min) in Settings → Markets → Stocks
- **Markets → Currency / Gold**: every 15 minutes
- All of the above also refresh immediately when you change a relevant setting (e.g. switching providers, adding a ticker)

## Customizing further

- Colors and type live at the top of `css/style.css` as CSS variables (`--void`, `--panel`, `--accent-a`, `--accent-b`, fonts) — tweak those, or add another entry to the `body[data-accent="..."]` block and to the `ACCENTS` array in `js/newtab.js` to add a new preset theme swatch.
- Font presets live in the `body[data-font="..."]` blocks near the top of `css/style.css`; add a new one there plus a matching chip in `newtab.html`'s Font section to add another typography preset.
- Clock styles live in the clock section of `js/newtab.js` (`applyClockStyle`, `tick`) and their matching CSS blocks (`.clock-nixie`, `.clock-flip`, `.clock-led`, `.clock-minimal`, etc.) — the pattern is easy to copy for a 7th style.
- Default widget positions/sizes live in `WIDGET_DEFAULTS` near the top of `js/newtab.js`.
- World clock cities/photos live in `WORLD_CLOCK_CITIES` in `js/newtab.js` — each entry is a timezone id, a display name, and a Pexels photo ID (turned into a full image URL by `pexelsUrl()`). To add a city: find a free photo on pexels.com, take the numeric ID from its URL (e.g. `.../photo/some-name-1530259/` → `1530259`), and add an entry following the existing pattern.
- Data source providers (weather detail, stocks, currency, gold) are each implemented as a small `fetchXxxFrom...()` function in `js/newtab.js` — adding a new source means writing one function that returns the same normalized shape the existing ones do, plus a chip in the matching Settings section.
- Default starter shortcuts are in `DEFAULT_DIALS` near the top of `js/newtab.js`.
- Icons were generated as simple PNGs in `icons/`; swap them for your own 16/48/128px art if you'd like a different toolbar icon.
