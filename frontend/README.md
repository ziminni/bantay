# Bantay — Frontend

The administrator dashboard for Bantay: React 19, TypeScript, Vite, Tailwind CSS,
React Router, Recharts, Lucide icons.

> **Status:** connected to the backend via Vite dev proxy (`/api` and `/media`
> -> `http://127.0.0.1:8000`). Styled with the Bantay brand (see Design below).
> There is no login yet.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript
npm run lint       # oxlint
npm run build      # typecheck + production build into dist/
```

## Pages

| Route | Page | Backend endpoints it mirrors |
|---|---|---|
| `/` | Dashboard — today's counters, entries per hour, per-lab totals, latest entries | `GET /stats/today` |
| `/live` | Live View — camera grid, click to enlarge | `GET /cameras`, `GET /cameras/{id}/stream.mjpeg` |
| `/enroll` | Enroll — choose person → upload 3–5 photos → result | `POST /persons`, `POST /persons/{id}/faces` |
| `/logs` | Entry Logs — search, filters, details panel, manual entry, CSV export | `GET/POST/DELETE /entries`, `GET /entries/export.csv` |
| `/users`, `/users/:id` | Users — list, details, face data, edit, deactivate, delete | `/persons`, `/persons/{id}/faces` |
| `/labs`, `/labs/:id` | Labs — settings and the lab's cameras (add, edit, test, restart) | `/labs`, `/cameras` |
| `/tools/recognition` | Test Recognition — match a photo, optionally record an entry | `POST /recognize`, `POST /recognize/log` |

## Design

The look comes from the Bantay brand assets (in `src/assets/brand/`):

| Token | Colour | Used for |
|---|---|---|
| navy | `#0E2A47` | sidebar, headings, primary buttons |
| marigold | `#F2A93B` | the accent — active nav, focus rings, highlights. Used sparingly |
| cream | `#F7F5F0` | page background |
| sand | `#E9E5DC` | borders and quiet surfaces |

- Tokens live in `src/index.css`. Tailwind's `gray-*` scale is remapped to
  brand neutrals, so plain `gray` classes already follow the brand.
- Fonts are Outfit (headings) and Inter (text), bundled through npm rather than
  a CDN, because the system runs on the department's local network.
- The logo's scan brackets reappear as a motif: camera feeds, the featured stat
  card, empty and loading states (`components/brand/BrandMark.tsx`).
- Status colours always come with words: green fine, red a problem, marigold
  needs attention.

## Folder structure

```
src/
├── api/            The only place pages get data from. One file per backend router.
│   ├── types.ts    Mirrors backend/src/bantay_backend/schemas.py
│   └── client.ts   axios instance for when the backend is connected
├── mocks/          In-memory sample database used while MOCK_MODE is on
├── components/
│   ├── layout/     AppLayout, Sidebar, Topbar, PageHeader
│   ├── ui/         Generic building blocks (Button, Modal, DataTable, …)
│   └── common/     Bantay-specific pieces shared by several pages
├── features/       One folder per page, with its own components/
├── hooks/          useAsync, useUrlFilters, useSearchBox, …
└── lib/            constants (same defaults as the backend) and formatting
```

Rules of thumb: pages import from `api/`, never from `mocks/`; a component used
by one page lives in that page's `features/<page>/components/`; filters on list
pages live in the URL, so a filtered view survives a reload and can be shared.

## Backend connection

The frontend communicates with the backend via relative URLs (`/api/v1` and `/media`):
- In development, Vite forwards requests via `server.proxy` configured in `vite.config.ts` (default `http://127.0.0.1:8000`, overridable via `VITE_BACKEND_URL`).
- In production, nginx forwards these paths to the FastAPI application.
- `MOCK_MODE` is disabled (`false`) in `src/config.ts`.
- The sample data in `src/mocks/` is retained for reference.

All times are shown in `Asia/Manila`.
