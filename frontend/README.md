# Bantay — Frontend

The administrator dashboard for Bantay: React 19, TypeScript, Vite, Tailwind CSS,
React Router, Recharts.

> **Status:** layout and behaviour only — no visual design yet (neutral greys,
> system font). Not connected to the backend: every page runs on sample data
> from `src/mocks/`. There is no login yet.

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

## Connecting the backend (later)

1. In each `src/api/*.ts`, replace the mock body with a `client` call to the
   endpoint named in the comment above the function, e.g.
   `return (await client.get('/labs', { params })).data`. Signatures stay the same,
   so no page changes.
2. Set `MOCK_MODE = false` in `src/config.ts` — this switches the live view and
   snapshots to the real MJPEG stream and media URLs.
3. Proxy `/api` and `/media` to FastAPI: in development add a `server.proxy`
   entry in `vite.config.ts`; in production nginx does it.

All times are shown in `Asia/Manila`.
