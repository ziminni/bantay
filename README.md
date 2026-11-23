<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/lockup-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/images/primary-lockup.png">
    <img alt="Bantay Logo" src="docs/images/primary-lockup-transparent.png" width="460">
  </picture>
</p>

<p align="center">
  <strong>High-performance, real-time facial recognition access monitoring system for computer laboratories.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-16_+_pgvector-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL pgvector">
  <img src="https://img.shields.io/badge/InsightFace-Buffalo__L-FF6F00?style=flat-square" alt="InsightFace">
  <img src="https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
</p>

---

## ⚡ Overview

**Bantay** (*"Guardian"* in Tagalog) is an automated laboratory entry tracking platform. It ingests live video feeds from standard RTSP CCTV or mobile phone cameras, detects and embeds faces using InsightFace ArcFace models (512-d), and matches identities in sub-milliseconds via PostgreSQL with `pgvector` cosine similarity.

Designed to replace manual logbooks with instant, touchless, and accurate lab attendance.

---

## ✨ Key Capabilities

- **Sub-Millisecond Vector Search** — 512-dimensional face embeddings indexed with `pgvector` HNSW cosine distance.
- **RTSP & Mobile CCTV Ingestion** — Plug in IP cameras, RTSP streams, or smartphones (e.g. via IP Webcam) with asynchronous multi-threaded frame grabbers.
- **Strict Privacy & Threshold Guards** — Unrecognized individuals or matches below confidence threshold safely fall back to `Unknown` to prevent misattribution.
- **Anti-Spam Cooldown Logic** — Prevents duplicate log spamming when attendees loiter within camera field-of-view.
- **Real-Time Live Overlays** — MJPEG streaming with dynamic bounding boxes, match percentage tags, and entry state overlays.
- **Test Recognition Playground** — In-browser testing suite to test photos, adjust similarity thresholds, and inspect face bounding coordinates.

---

## 🖥️ Live Recognition in Action

Dual-face detection showing confidence thresholding, identity matching, and safe fallback for unknown subjects:

<p align="center">
  <img src="docs/images/sample-recognition.jpg" alt="Bantay Test Recognition" width="920" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
</p>

---

## 🏗️ Architecture Pipeline

```mermaid
flowchart LR
    A[RTSP / Phone Camera] --> B[OpenCV Async Worker]
    B --> C[InsightFace Buffalo_L]
    C -->|512-d ArcFace Vector| D[(PostgreSQL + pgvector)]
    D -->|Cosine Similarity| E{Similarity >= Threshold?}
    E -->|Yes| F[Match Identified]
    E -->|No| G[Tag as Unknown]
    F --> H[Check Cooldown]
    H -->|Expired| I[Log Laboratory Entry]
    H -->|Active| J[Skip Duplicate Entry]
    F --> K[Live Stream Overlay]
    G --> K
```

---

## 🚀 Quickstart

### Prerequisites

- **Docker & Docker Compose** (for PostgreSQL + `pgvector`)
- **Python 3.12+** and [uv](https://github.com/astral-sh/uv)
- **Node.js 20+** and `npm`

---

### 1. Start the Database

Spin up the PostgreSQL database pre-configured with the `pgvector` extension:

```bash
docker compose up -d db
```

---

### 2. Launch the Backend

```bash
cd backend

# Create virtual environment and sync dependencies
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv sync

# Run database migrations
alembic upgrade head

# Start API server
uv run uvicorn bantay_backend.main:app --reload --port 8000
```

> **API Documentation:** Interactive Swagger docs are available at `http://localhost:8000/docs`.

---

### 3. Launch the Frontend

```bash
cd frontend

# Install dependencies and start Vite dev server
npm install
npm run dev
```

> **Dashboard:** Access the user interface at `http://localhost:5173`.

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service and camera worker status |
| `GET` | `/api/cameras` | List configured RTSP / IP cameras |
| `GET` | `/api/cameras/{id}/stream` | MJPEG live video feed with bounding overlays |
| `GET` | `/api/entries` | Laboratory entry logs with query filters |
| `POST` | `/api/persons` | Register a new person and generate face embedding |
| `POST` | `/api/recognition/test` | Test face detection and matching on an uploaded image |
| `GET` | `/api/stats/dashboard` | Real-time laboratory occupancy and activity analytics |

---

## ⚙️ Configuration

Key environment variables configurable in `.env`:

```env
# Database
DATABASE_URL=postgresql+psycopg://bantay:bantay@localhost:5432/bantay

# Recognition & Tracking
RECOGNITION_ENGINE=auto                         # 'auto', 'insightface', or 'mock'
RECOGNITION_SIMILARITY_THRESHOLD=0.35           # Cosine similarity cutoff
ENTRY_COOLDOWN_SECONDS=120                      # Minimum delay between logs for same person

# Storage
MEDIA_ROOT=./media
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, React Router |
| **Backend** | FastAPI, Python 3.12, InsightFace (`buffalo_l`), ONNX Runtime, OpenCV |
| **Database** | PostgreSQL 16, `pgvector` (512-dim ArcFace embeddings) |
| **ORM / Migration** | SQLAlchemy 2.0, Alembic |
| **Tooling** | Docker, uv, oxlint |

---

## 📄 License

This project is licensed under the MIT License.
