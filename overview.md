# Project Planner — App Overview

## Purpose

ProjectPlanner is a general-purpose planning application that enables individuals and small teams to organize projects, manage tasks, write notes, and track deadlines in one place. It is designed to feel lightweight and fast while being backed by AI-assisted features for smart planning.

The app is inspired by the architectural patterns of **LearningApp** and reuses its proven stack (Flask REST API + Vanilla JS SPA), its offline-first sync model, and its multi-user profile system.

---

## Goals

| Goal                       | Description                                                                       |
| -------------------------- | --------------------------------------------------------------------------------- |
| **Organize**               | Create projects, break them into tasks, attach notes and deadlines                |
| **Track**                  | Visualize progress with status tracking (todo → in-progress → done)               |
| **Plan smartly**           | Use AI to suggest tasks, summarize progress, and flag blockers                    |
| **Support multiple users** | Each user has isolated projects with PIN-based profile selection                  |
| **Work offline-first**     | Core functionality works without server; data syncs automatically when connected  |
| **Stay simple**            | No heavy framework, no complex build pipeline — plain HTML/CSS/JS served by Flask |

---

## Scope

### In Scope

- **Projects** — Create, rename, archive, delete projects with color/icon labels
- **Tasks** — Full task lifecycle: title, description, status, priority, due date, assignee
- **Subtasks** — Nested task breakdown within a parent task
- **Notes** — Rich-text-like notes attached to projects or tasks
- **Calendar view** — Date-filtered view of tasks with upcoming deadlines
- **AI features** — Task suggestion, project summary, smart deadline estimation, blocker detection
- **Multi-user profiles** — PIN-based user selection, isolated data per user
- **Settings** — Data folder, theme, default language for AI responses
- **Data export/import** — JSON export and re-import per project

### Out of Scope (v1)

- Real-time collaboration (WebSockets)
- Email / push notifications
- File upload attachments
- Gantt chart
- OAuth / JWT-based authentication

---

## Core Design Principles

### 1. Offline-First

App state lives in `localStorage`. Changes are auto-synced to the server with a 1-second debounce. The app remains fully functional if the server is unreachable.

### 2. Modular Frontend

Each feature is its own JavaScript module and CSS file. No framework dependencies. Direct DOM manipulation with event-driven updates.

### 3. Flat JSON Storage

Each project is stored as a single `.json` file on disk. Human-readable, git-friendly, no database required.

### 4. Flask Blueprint Architecture

Backend routes are organized into feature blueprints (`projects`, `tasks`, `notes`, `ai`, `users`, `settings`, `calendar`). Adding new features does not require touching existing code.

### 5. AI as a Layer, Not a Requirement

AI features (Azure OpenAI) enhance the experience but are non-blocking. If the API key is missing or the service is unavailable, the app degrades gracefully.

### 6. Multi-User Without Full Auth

User profiles with optional PIN provide lightweight data separation. No session management or token storage required.

---

## Key Screens / Views

| Screen                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| **User Selection**    | Choose or create a user profile (with optional PIN lock)         |
| **Dashboard**         | Summary of active projects, upcoming tasks, quick-add            |
| **Project List**      | All projects for the current user with filter/sort               |
| **Project Detail**    | Kanban-style task board + task list + notes for a single project |
| **Task Detail Panel** | Slide-in panel with full task info, subtasks, AI assistant       |
| **Calendar**          | Monthly/weekly view of tasks filtered by due date                |
| **Notes**             | Standalone note editor attached to a project                     |
| **Settings**          | Data folder path, default user, AI model settings                |

---

## Reference: LearningApp Patterns Reused

| LearningApp Pattern                    | ProjectPlanner Equivalent       |
| -------------------------------------- | ------------------------------- |
| Book = JSON file per book              | Project = JSON file per project |
| `data.js` localStorage + debounce sync | `data.js` same pattern          |
| `users.py` PIN-based profiles          | `users.py` same pattern         |
| Azure OpenAI `ai.py` blueprint         | `ai.py` blueprint for task AI   |
| `config.py` multi-layer config         | `config.py` same pattern        |
| `create_app()` factory + blueprints    | `create_app()` same factory     |
| Modular CSS per component              | Modular CSS per component       |
