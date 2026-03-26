# Project Planner — Data Models

All data is stored as JSON. The primary storage unit is **one JSON file per project**, mirroring LearningApp's one-file-per-book pattern. Users are stored in a shared `users.json`.

---

## 1. User

Stored in: `data/users.json`

```json
[
  {
    "id": "usr_1711234567_abc",
    "name": "Alice",
    "pin": "1234",
    "created_at": "2026-03-26T10:00:00Z",
    "projects": ["proj_1711234567_xyz", "proj_1711234567_def"]
  }
]
```

### Field Definitions

| Field        | Type            | Required | Description                                            |
| ------------ | --------------- | -------- | ------------------------------------------------------ |
| `id`         | string          | Yes      | Unique ID — `uid()` format: `usr_{timestamp}_{random}` |
| `name`       | string          | Yes      | Display name (1–50 characters)                         |
| `pin`        | string          | No       | 4-digit PIN for profile lock; `null` if no PIN set     |
| `created_at` | ISO 8601 string | Yes      | Profile creation timestamp                             |
| `projects`   | string[]        | Yes      | Array of project IDs owned by this user                |

---

## 2. Project

Stored in: `data/projects/{project_id}.json`

```json
{
  "id": "proj_1711234567_xyz",
  "user_id": "usr_1711234567_abc",
  "name": "Website Redesign",
  "description": "Rebuild the company homepage and blog",
  "color": "#6366f1",
  "icon": "🌐",
  "status": "active",
  "created_at": "2026-03-26T10:00:00Z",
  "updated_at": "2026-03-26T14:30:00Z",
  "tasks": [{ "...": "see Task schema below" }],
  "notes": [{ "...": "see Note schema below" }],
  "config": {
    "default_view": "kanban",
    "show_completed": true,
    "sort_by": "priority"
  }
}
```

### Field Definitions

| Field         | Type          | Required | Description                                     |
| ------------- | ------------- | -------- | ----------------------------------------------- |
| `id`          | string        | Yes      | Unique project ID — `proj_{timestamp}_{random}` |
| `user_id`     | string        | Yes      | Owner user's ID                                 |
| `name`        | string        | Yes      | Project name (1–100 characters)                 |
| `description` | string        | No       | Short description of the project                |
| `color`       | string        | No       | Hex color for label; default `#6366f1`          |
| `icon`        | string        | No       | Emoji or icon code for visual identity          |
| `status`      | enum          | Yes      | `active` \| `archived` \| `deleted`             |
| `created_at`  | ISO 8601      | Yes      | Creation timestamp                              |
| `updated_at`  | ISO 8601      | Yes      | Last modification timestamp                     |
| `tasks`       | Task[]        | Yes      | Array of all tasks in the project               |
| `notes`       | Note[]        | Yes      | Array of all notes in the project               |
| `config`      | ProjectConfig | No       | Per-project UI preferences                      |

### ProjectConfig Object

| Field            | Type    | Default      | Description                                         |
| ---------------- | ------- | ------------ | --------------------------------------------------- |
| `default_view`   | enum    | `list`       | `list` \| `kanban`                                  |
| `show_completed` | boolean | `true`       | Whether to show completed tasks in the list         |
| `sort_by`        | enum    | `created_at` | `created_at` \| `due_date` \| `priority` \| `title` |

---

## 3. Task

Stored inside the parent project's JSON file as an element of `project.tasks[]`.

```json
{
  "id": "task_1711234600_abc",
  "project_id": "proj_1711234567_xyz",
  "title": "Design new hero section",
  "description": "Create wireframes and high-fidelity mockups for the homepage hero",
  "status": "in-progress",
  "priority": "high",
  "assignee_id": "usr_1711234567_abc",
  "tags": ["design", "frontend"],
  "due_date": "2026-04-10",
  "due_time": "17:00",
  "subtasks": [
    {
      "id": "sub_1711234650_abc",
      "title": "Research competitor hero sections",
      "completed": true
    },
    {
      "id": "sub_1711234660_abc",
      "title": "Create wireframe sketches",
      "completed": false
    }
  ],
  "comments": [
    {
      "id": "cmt_1711234700_abc",
      "text": "Added reference images to the notes section.",
      "author_id": "usr_1711234567_abc",
      "created_at": "2026-03-26T11:00:00Z"
    }
  ],
  "created_at": "2026-03-26T10:05:00Z",
  "updated_at": "2026-03-26T14:00:00Z",
  "completed_at": null,
  "deleted": false
}
```

### Field Definitions

| Field          | Type      | Required | Description                                       |
| -------------- | --------- | -------- | ------------------------------------------------- |
| `id`           | string    | Yes      | Unique task ID — `task_{timestamp}_{random}`      |
| `project_id`   | string    | Yes      | Parent project ID (for cross-reference)           |
| `title`        | string    | Yes      | Task title (1–200 characters)                     |
| `description`  | string    | No       | Longer description / acceptance criteria          |
| `status`       | enum      | Yes      | `todo` \| `in-progress` \| `blocked` \| `done`    |
| `priority`     | enum      | Yes      | `low` \| `medium` \| `high` \| `urgent`           |
| `assignee_id`  | string    | No       | User ID of assigned user; `null` = unassigned     |
| `tags`         | string[]  | No       | Array of free-form tag strings                    |
| `due_date`     | string    | No       | ISO date `YYYY-MM-DD`; `null` = no deadline       |
| `due_time`     | string    | No       | `HH:MM` (24h); `null` = no specific time          |
| `subtasks`     | Subtask[] | No       | Checklist items within this task                  |
| `comments`     | Comment[] | No       | Thread of comments attached to this task          |
| `created_at`   | ISO 8601  | Yes      | Creation timestamp                                |
| `updated_at`   | ISO 8601  | Yes      | Last modification timestamp                       |
| `completed_at` | ISO 8601  | No       | When the task was marked `done`; `null` otherwise |
| `deleted`      | boolean   | Yes      | Soft-delete flag; `true` = in project trash bin   |

### Subtask Object

| Field       | Type    | Required | Description                                    |
| ----------- | ------- | -------- | ---------------------------------------------- |
| `id`        | string  | Yes      | Unique subtask ID — `sub_{timestamp}_{random}` |
| `title`     | string  | Yes      | Subtask label                                  |
| `completed` | boolean | Yes      | Whether the subtask is checked off             |

### Comment Object

| Field        | Type     | Required | Description                                    |
| ------------ | -------- | -------- | ---------------------------------------------- |
| `id`         | string   | Yes      | Unique comment ID — `cmt_{timestamp}_{random}` |
| `text`       | string   | Yes      | Comment body (plain text)                      |
| `author_id`  | string   | Yes      | User ID of the author                          |
| `created_at` | ISO 8601 | Yes      | Comment creation timestamp                     |

---

## 4. Note

Stored inside the parent project's JSON file as an element of `project.notes[]`.

```json
{
  "id": "note_1711234800_abc",
  "project_id": "proj_1711234567_xyz",
  "title": "Tech Stack Decisions",
  "content": "## Decisions\n\n- Using **React** for the frontend\n- API will be built with FastAPI",
  "pinned": false,
  "created_at": "2026-03-26T10:10:00Z",
  "updated_at": "2026-03-26T15:00:00Z"
}
```

### Field Definitions

| Field        | Type     | Required | Description                                  |
| ------------ | -------- | -------- | -------------------------------------------- |
| `id`         | string   | Yes      | Unique note ID — `note_{timestamp}_{random}` |
| `project_id` | string   | Yes      | Parent project ID                            |
| `title`      | string   | Yes      | Note title                                   |
| `content`    | string   | Yes      | Note body — plain text with Markdown syntax  |
| `pinned`     | boolean  | Yes      | Whether note is pinned to top of list        |
| `created_at` | ISO 8601 | Yes      | Creation timestamp                           |
| `updated_at` | ISO 8601 | Yes      | Last modification timestamp                  |

---

## 5. App State (localStorage)

The client-side `appData` object loaded from/written to `localStorage` key `'project-planner-app'`.

```json
{
  "projects": {
    "proj_1711234567_xyz": {
      "...": "full Project object"
    }
  },
  "currentUser": {
    "id": "usr_1711234567_abc",
    "name": "Alice"
  },
  "config": {
    "theme": "dark",
    "defaultLanguage": "English",
    "lastOpenedProjectId": "proj_1711234567_xyz"
  }
}
```

| Field         | Type                | Description                                               |
| ------------- | ------------------- | --------------------------------------------------------- |
| `projects`    | `{ [id]: Project }` | Map of all projects for the current user                  |
| `currentUser` | User (partial)      | Logged-in user `{ id, name }` — no PIN stored client-side |
| `config`      | AppConfig           | Theme and preferences                                     |

---

## 6. Runtime Config (`app_config.json`)

Stored at: `{data_dir}/app_config.json`

```json
{
  "data_dir": "C:\\Users\\alice\\planner-data",
  "ai_response_language": "English",
  "theme": "dark"
}
```

| Field                  | Type   | Default     | Description                              |
| ---------------------- | ------ | ----------- | ---------------------------------------- |
| `data_dir`             | string | `"data"`    | Absolute or relative path to data folder |
| `ai_response_language` | string | `"English"` | Language for AI-generated text           |
| `theme`                | enum   | `"dark"`    | `"dark"` \| `"light"`                    |

---

## 7. ID Generation

All IDs are generated client-side using a `uid()` utility function:

```javascript
function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
```

**Examples:**

- `usr_1711234567890_a3bx9`
- `proj_1711234567901_k9mz2`
- `task_1711234567912_w4qp1`
- `note_1711234567923_r7cn8`

This matches LearningApp's ID pattern. IDs are collision-resistant for single-user and small-team use.

---

## 8. Data Relationships

```
User (users.json)
  └── has many Projects (via users.projects[] and each project's user_id)
        └── has many Tasks  (project.tasks[])
        │     └── has many Subtasks (task.subtasks[])
        │     └── has many Comments (task.comments[])
        └── has many Notes  (project.notes[])
```

- All relationships are embedded (no foreign-key joins)
- Project files are self-contained — a single JSON export contains all tasks and notes
- `user_id` on projects is the only cross-file reference (linking to `users.json`)
