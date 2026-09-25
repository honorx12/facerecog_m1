# Sentry — Face Recognition Access System

Website wrapper around the `face_recogagentv2` recognition engine: enroll faces,
verify anyone against the roster from a webcam or photo, and get an automatic
access log. No changes were made to the core matching logic in `face_model.py`.

```
webapp/
  backend/     FastAPI service (registration, recognition, attendance)
  frontend/    React + Vite website (the part you look at)
```

## 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

`face-recognition` depends on `dlib`, which needs CMake + a C++ compiler to
build. On Windows the easiest path is `pip install cmake` first, or install
via `conda install -c conda-forge dlib`.

The backend already ships with the four faces from the original project
(`backend/known_faces/`) and the existing attendance history
(`backend/attendance.db`), so the site has real data the moment it's running.

Endpoints:
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | roster size / liveness |
| GET | `/faces` | roster gallery (name + photo) |
| POST | `/register` | add a face (`name`, `file`) |
| POST | `/recognize` | match a face, optionally logging attendance |
| GET | `/attendance` | history, optional `?date=YYYY-MM-DD` |
| GET | `/attendance/dates` | dates that have entries |
| POST | `/reload` | re-scan `known_faces/` after a manual copy |

## 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed `localhost` URL. In dev, Vite proxies `/api/*` to
`http://127.0.0.1:8000`, so start the backend first.

For a production build: `npm run build`, then serve `frontend/dist` with any
static host and point it at the deployed backend (edit `src/lib/api.js`'s
`BASE` constant, or put a reverse proxy in front of both).

## Pages

- **/** — landing page, the animated line-wave hero
- **/enroll** — add a new face to the roster
- **/verify** — check a face against the roster; a match is logged automatically
- **/roster** — gallery of everyone enrolled
- **/log** — access log, filterable by date
