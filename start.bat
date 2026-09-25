@echo off
start "backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\activate && uvicorn api:app --reload --port 8000"
start "frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5
start http://localhost:5173