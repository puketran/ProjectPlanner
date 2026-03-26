# Project Planner — Requirements

## 1. Functional Requirements

### 1.1 User Management

| ID   | Requirement                                                                 |
| ---- | --------------------------------------------------------------------------- |
| U-01 | User can create a named profile with an optional 4-digit PIN                |
| U-02 | User can select their profile from the user selection screen on app load    |
| U-03 | User can delete their profile (with confirmation)                           |
| U-04 | All projects, tasks, and notes are scoped to the logged-in user             |
| U-05 | User session is stored in `localStorage`; persists across browser refreshes |
| U-06 | User can switch profiles from the settings or header                        |

---

### 1.2 Projects

| ID   | Requirement                                                                            |
| ---- | -------------------------------------------------------------------------------------- |
| P-01 | User can create a new project with a name, optional description, color label, and icon |
| P-02 | User can rename a project                                                              |
| P-03 | User can archive a project (hides from active list, retains data)                      |
| P-04 | User can delete a project (with confirmation; moves to trash / permanent delete)       |
| P-05 | User can export a project as a JSON file                                               |
| P-06 | User can import a project from a JSON file                                             |
| P-07 | Project list is sortable by: name, creation date, last modified, task count            |
| P-08 | Project list is filterable by: status (active/archived), label/color                   |
| P-09 | Each project shows a progress bar (% of tasks completed)                               |
| P-10 | User can duplicate a project                                                           |

---

### 1.3 Tasks

| ID   | Requirement                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------- |
| T-01 | User can create a task within a project with: title, description, status, priority, due date            |
| T-02 | Task statuses: `todo`, `in-progress`, `blocked`, `done`                                                 |
| T-03 | Task priorities: `low`, `medium`, `high`, `urgent`                                                      |
| T-04 | User can move tasks between statuses via drag-and-drop (kanban board)                                   |
| T-05 | User can assign a task to a user profile                                                                |
| T-06 | User can add subtasks (checklist) within a task; subtask completion contributes to parent task progress |
| T-07 | User can set a due date with optional time                                                              |
| T-08 | User can add tags/labels to a task                                                                      |
| T-09 | User can add comments/notes directly on a task                                                          |
| T-10 | Tasks can be viewed in a list view or kanban board view                                                 |
| T-11 | User can bulk-update task status                                                                        |
| T-12 | Completed tasks can be hidden/shown via toggle                                                          |
| T-13 | User can soft-delete tasks (moves to project trash bin for recovery)                                    |
| T-14 | Task list supports search/filter by title, status, priority, tag, assignee, due date                    |
| T-15 | Tasks have a creation timestamp and last-modified timestamp                                             |

---

### 1.4 Notes

| ID   | Requirement                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------- |
| N-01 | User can create a note attached to a project                                                       |
| N-02 | Note editor supports plain text with basic markdown rendering (bold, italic, headers, lists, code) |
| N-03 | Notes are auto-saved locally as the user types                                                     |
| N-04 | User can rename and delete notes                                                                   |
| N-05 | Notes list inside a project is sortable by title or last modified                                  |
| N-06 | Notes can be pinned to the top of the list                                                         |

---

### 1.5 Calendar

| ID   | Requirement                                                                       |
| ---- | --------------------------------------------------------------------------------- |
| C-01 | Calendar view shows tasks with due dates across all projects for the current user |
| C-02 | User can switch between monthly and weekly view                                   |
| C-03 | Clicking a date shows all tasks due on that date                                  |
| C-04 | Tasks are color-coded by project label                                            |
| C-05 | Overdue tasks are highlighted in the calendar                                     |
| C-06 | User can create a task directly from the calendar by clicking a date              |

---

### 1.6 AI Features

| ID    | Requirement                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------ |
| AI-01 | **Task Suggestion**: Given a project title/description, AI suggests a list of tasks to add                   |
| AI-02 | **Project Summary**: AI generates a short progress summary for a project based on current task states        |
| AI-03 | **Smart Deadline**: AI estimates a reasonable due date for a task based on similar tasks and project context |
| AI-04 | **Blocker Detection**: AI identifies incomplete blockers or dependencies from task descriptions              |
| AI-05 | **Ask AI**: Free-form question about the current project/task (e.g., "What should I do next?")               |
| AI-06 | AI responses are streamed or displayed in a dedicated chat panel                                             |
| AI-07 | AI features degrade gracefully if `AZURE_OPENAI_API_KEY` is not set (hide AI buttons, show setup message)    |

---

### 1.7 Settings

| ID   | Requirement                                                                |
| ---- | -------------------------------------------------------------------------- |
| S-01 | User can change the data folder path (where project JSON files are stored) |
| S-02 | User can view disk usage summary per data folder                           |
| S-03 | User can select a default AI response language                             |
| S-04 | User can toggle dark/light theme                                           |
| S-05 | User can view app version and environment status                           |

---

### 1.8 Dashboard

| ID   | Requirement                                                                            |
| ---- | -------------------------------------------------------------------------------------- |
| D-01 | Dashboard shows count of: active projects, total tasks, tasks due today, overdue tasks |
| D-02 | Dashboard shows "Recently Modified" projects (up to 5)                                 |
| D-03 | Dashboard shows upcoming tasks (next 7 days) sorted by due date                        |
| D-04 | Quick-create task input is available from the dashboard                                |

---

## 2. Non-Functional Requirements

| Category            | Requirement                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Performance**     | App loads within 2 seconds on localhost; API responses under 500ms for non-AI endpoints      |
| **Offline**         | Core features (view, create, edit tasks/notes) work with no server connection (localStorage) |
| **Sync**            | Auto-sync to server within 1 second of a data change (debounced)                             |
| **Storage**         | JSON files per project; no relational database required                                      |
| **Security**        | No sensitive data in client-side code; PIN auth (not exposed in URL); `.env` for secrets     |
| **Scalability**     | Designed for single-user or small team use (< 20 users, < 500 tasks per project)             |
| **Portability**     | Runs on any OS (Windows, macOS, Linux); no OS-specific dependencies in core logic            |
| **Deployability**   | Deployable to Render, Railway, or any platform supporting Python + gunicorn                  |
| **Accessibility**   | Keyboard navigable; uses semantic HTML; supports screen reader labels on key controls        |
| **Maintainability** | Each feature isolated in its own blueprint (backend) and JS/CSS module (frontend)            |

---

## 3. User Stories

### Epic: User Setup

- As a new user, I want to create a profile so that my projects are separate from others using the same device.
- As a returning user, I want to select my profile at launch so the app loads my personal data automatically.
- As a security-conscious user, I want to set a PIN on my profile so others can't access my data.

### Epic: Project Management

- As a user, I want to create a project with a name and color so I can visually distinguish it from others.
- As a user, I want to see all my projects on one screen with a progress indicator so I know which ones need attention.
- As a user, I want to archive completed projects so they don't clutter my active list.
- As a user, I want to export a project as JSON so I can back it up or share it.

### Epic: Task Management

- As a user, I want to create tasks with a due date and priority so I can manage my workload.
- As a user, I want to drag tasks between kanban columns so I can update their status intuitively.
- As a user, I want to add subtasks to a task so I can break work into smaller steps.
- As a user, I want to filter tasks by status and priority so I find what to work on next.
- As a user, I want to recover deleted tasks from the trash so I don't permanently lose data by accident.

### Epic: Notes

- As a user, I want to write project notes that auto-save so I never lose my thoughts.
- As a user, I want to use markdown formatting in notes so I can structure information clearly.

### Epic: Calendar

- As a user, I want to see all upcoming deadlines in one calendar view so I don't miss due dates.
- As a user, I want overdue tasks highlighted so I can immediately see what I'm behind on.

### Epic: AI Assistance

- As a user, I want to describe a project and get a list of suggested tasks so I can start faster.
- As a user, I want to ask AI what I should work on next based on my current task list.
- As a user, I want AI to summarize my project status so I can share a quick update with others.
