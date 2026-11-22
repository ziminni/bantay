# Bantay — Backend

Face recognition-based **entry logging** for computer laboratories.
FastAPI · PostgreSQL + pgvector · OpenCV · InsightFace (ArcFace).

Bantay records **entries only**. There is no exit, duration, attendance or
behaviour-flagging concept in this API.

## How one entry is recorded

```
IP camera ──RTSP──▶ camera worker ──▶ detect face ──▶ ArcFace embedding (512-d)
                                                          │
                              pgvector cosine search ◀─────┘
                                      │
                      similarity ≥ lab threshold?  ──no──▶ UNKNOWN entry + snapshot
                                      │ yes
                      person logged here within cooldown? ──yes──▶ ignored
                                      │ no
                                 write entry_log
```

## Running it

```bash
# 1. Database (from the project root)
docker compose up -d db

# 2. Configuration
cp .env.example .env          # edit DATABASE_URL if your host port differs

# 3. Schema
uv run alembic upgrade head

# 4. Server
uv run uvicorn bantay_backend.main:app --reload
```

Then open **http://localhost:8000/docs**.

> On this machine port 5432 was already taken, so `docker-compose.yml` reads
> `BANTAY_DB_PORT` (set to `5433` in the project-root `.env`) and the backend's
> `DATABASE_URL` points at `localhost:5433`.

## API documentation

| URL | What it is |
|---|---|
| `/docs` | Swagger UI — browse and call every endpoint |
| `/redoc` | ReDoc — reading view |
| `/openapi.json` | The OpenAPI 3.1 schema |
| `/` | Redirects to `/docs` |

All endpoints live under `/api/v1`.

| Group | Endpoints |
|---|---|
| System | `GET /health` |
| Dashboard | `GET /stats/today` |
| Persons & Enrollment | `GET POST /persons`, `GET PATCH DELETE /persons/{id}`, `GET POST /persons/{id}/faces`, `DELETE /persons/{id}/faces/{embedding_id}` |
| Laboratories | `GET POST /labs`, `GET PATCH DELETE /labs/{id}` |
| Cameras & Live View | `GET POST /cameras`, `GET PATCH DELETE /cameras/{id}`, `POST /cameras/{id}/test`, `POST /cameras/{id}/restart`, `GET /cameras/{id}/stream.mjpeg`, `GET /cameras/{id}/snapshot.jpg` |
| Entry Logs | `GET POST /entries`, `GET DELETE /entries/{id}`, `GET /entries/export.csv` |
| Recognition | `POST /recognize`, `POST /recognize/log` |

## Trying it without cameras

1. `POST /api/v1/labs` → `{"name": "Lab 1"}`
2. `POST /api/v1/persons` → `{"id_number": "2021-12345", "full_name": "Juan Dela Cruz", "consent_given": true}`
3. `POST /api/v1/entries` → `{"person_id": 1, "lab_id": 1}` — writes an entry
4. Repeat step 3 — returns `{"logged": false, "reason": "cooldown"}`
5. `GET /api/v1/entries` and `GET /api/v1/stats/today`

`POST /recognize` matches a face in an uploaded image without writing anything;
`POST /recognize/log` runs the full camera path on an uploaded image.

## The recognition engine

Nothing outside `services/recognition.py` imports InsightFace. The engine is
chosen by `RECOGNITION_ENGINE`:

| Value | Behaviour |
|---|---|
| `auto` (default) | Use InsightFace if installed, otherwise the null engine |
| `insightface` | Require InsightFace; fail loudly if it is missing |
| `null` | Never recognize — the API, database and dashboard still work |

The **null engine** is why the backend runs on a laptop with no NVIDIA GPU: every
endpoint works except the two that need embeddings, which answer `503`.

To enable real recognition (needs the GPU server):

```bash
uv add insightface onnxruntime      # or onnxruntime-gpu
# then set in .env:
RECOGNITION_ENGINE=insightface
INSIGHTFACE_CTX_ID=0                # -1 = CPU, 0 = first GPU
```

The fine-tuned **LabAdapter** is an optional ONNX model applied to raw ArcFace
embeddings; point `ADAPTER_PATH` at it once Phase 4 has produced one.

## Configuration

Every setting in `.env.example` maps to a field in `config.py`. The ones that
matter most:

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `...@localhost:5432/bantay` | PostgreSQL, psycopg v3 driver |
| `RECOGNITION_ENGINE` | `auto` | Which engine to load |
| `DEFAULT_MATCH_THRESHOLD` | `0.45` | Cosine similarity to accept a match |
| `DEFAULT_COOLDOWN_SECONDS` | `120` | One visit, one entry |
| `CAMERA_WORKERS_ENABLED` | `true` | Start RTSP workers on boot |
| `CAMERA_SAMPLE_FPS` | `10` | Frames per second sampled per camera |

Threshold and cooldown are stored **per laboratory** and are editable through
`PATCH /api/v1/labs/{id}`; the settings above are only the defaults for new rows.

## Schema

Five tables. `face_embedding.embedding` is `vector(512)` with an HNSW index on
cosine distance.

```
person ──1:N──▶ face_embedding
lab    ──1:N──▶ camera
entry_log ──▶ person (nullable: null means UNKNOWN)
          ──▶ lab    (RESTRICT)
          ──▶ camera (nullable)
```

Enrollment photos are **never written to disk**: they are decoded in memory,
converted to an embedding and discarded. Only unknown-face snapshots are stored,
under `MEDIA_ROOT`.

## Tests

```bash
docker compose up -d db     # the tests need a real pgvector database
uv run pytest
```

33 tests cover the entry rules (threshold, cooldown, per-lab scoping, unknown
capture, inactive persons and labs) and the HTTP API (validation, conflicts,
pagination, filtering, CSV export, statistics, password masking).

## Not implemented

Deliberately, because they are outside the project specification:

- **Authentication and roles.** Every endpoint is open. The spec lists seven
  modules and no auth module. Add this before the system is reachable by anyone
  other than the developers.
- **Exit logging, duration, attendance, behaviour flagging.** Not in scope.
- **Liveness detection.** Listed in the spec as a later improvement.
