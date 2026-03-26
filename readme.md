# ProjectPlanner

A general-purpose planning app: projects, tasks, notes, calendar, and AI-assisted planning.

## Stack

- **Backend**: Python 3.11+ / Flask
- **Frontend**: Vanilla JS SPA (no framework, no bundler)
- **AI**: Azure OpenAI (optional)
- **Storage**: JSON files on disk (no database)

## Setup

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
copy .env.example .env
# Edit .env with your Azure OpenAI credentials (optional)

# 4. Run
python run.py
```

Open http://localhost:5000

## Features

- Multi-user profiles with optional PIN
- Projects with color/icon labels
- Tasks: kanban board + list view, subtasks, comments, due dates, priorities
- Notes with Markdown preview
- Calendar view with task due dates
- AI: task suggestions, project summaries, smart deadlines, ask AI
- Offline-first (localStorage sync)
- Export/import projects as JSON

## Deployment (Render / Railway)

Push to git, set environment variables, deploy with `gunicorn run:app`.
