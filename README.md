# Schedule Organiser

Smart self-hosted task organiser. Write or speak your tasks in plain text — the AI parses them into structured tickets with subtasks, dates, and descriptions. Syncs with Google Calendar and sends notifications to Slack/Discord.

---

## Quick Start

### 1. Clone and set up

```bash
git clone <repo>
cd schedule_organiser
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cp .env.example .env
# Edit .env — set SECRET_KEY to a random 32-character string
```

### 2. Build the frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Run

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000

### 4. Configure

Go to **Settings** in the app to:
- Set your AI provider (OpenAI, Claude, or custom) and API key
- Add Slack and/or Discord webhook URLs for notifications
- Connect Google Calendar via OAuth

---

## Development

Run backend and frontend separately with hot reload:

```bash
# Terminal 1 — backend
source .venv/bin/activate
uvicorn backend.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

Frontend dev server (`http://localhost:5173`) proxies `/api` to the backend at `localhost:8000`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./schedule.db` | SQLite database path |
| `SECRET_KEY` | *(required)* | Random string for encrypting stored secrets |
| `GOOGLE_CLIENT_ID` | | Google OAuth client ID (for Calendar integration) |
| `GOOGLE_CLIENT_SECRET` | | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | `http://localhost:8000/api/integrations/calendar/callback` | OAuth callback URL |

Copy `.env.example` to `.env` and fill in values. All other configuration (AI API keys, webhook URLs, calendar settings) is managed through the in-app Settings page.

---

## Running Tests

```bash
source .venv/bin/activate
pytest tests/ -v
```

---

## How It Works

1. **Input** — Type a narrative description of your tasks (or use voice input)
2. **Parse** — Click "Suggest tasks →"; the AI extracts structured tasks with subtasks, dates, and auto-generated descriptions
3. **Review** — Preview and edit the suggested tasks before saving
4. **Sync** — Tasks with dates are automatically synced to Google Calendar
5. **Notify** — New tasks and completions are sent to Slack and/or Discord

---

## For Developers / AI Agents

The implementation plan lives at:
`docs/superpowers/plans/2026-08-03-schedule-organiser.md`

The design spec is at:
`docs/superpowers/specs/2026-08-03-schedule-organiser-design.md`

To execute the plan task-by-task using subagent-driven development:
1. Read the plan file to extract all tasks
2. Dispatch a fresh subagent per task with the full task text as context
3. After each task: run spec compliance review, then code quality review
4. Fix any issues found before moving to the next task

Each task in the plan is self-contained with exact file paths, complete code blocks, test commands, and expected output.
