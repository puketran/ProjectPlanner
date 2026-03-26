# Project Planner — Frontend Structure

The frontend is a **Single Page Application** built with Vanilla JavaScript, HTML5, and modular CSS. No framework, no bundler. All files are served directly by Flask from `frontend/`.

---

## Directory Layout

```
frontend/
├── index.html                       # Single HTML entry point for the SPA
└── static/
    └── views/
        └── components/
            ├── css/                 # Modular CSS — one file per component
            └── js/                 # Modular JS — one file per feature
```

---

## JavaScript Modules

### Load Order in `index.html`

Scripts must be loaded in this order due to shared global state (no module system):

```html
<!-- Core -->
<script src="/static/views/components/js/data.js"></script>
<script src="/static/views/components/js/users.js"></script>

<!-- Feature modules -->
<script src="/static/views/components/js/projects.js"></script>
<script src="/static/views/components/js/tasks.js"></script>
<script src="/static/views/components/js/subtasks.js"></script>
<script src="/static/views/components/js/notes.js"></script>
<script src="/static/views/components/js/calendar.js"></script>

<!-- AI & panels -->
<script src="/static/views/components/js/ai.js"></script>
<script src="/static/views/components/js/detail-panel.js"></script>

<!-- Navigation & layout -->
<script src="/static/views/components/js/toc.js"></script>
<script src="/static/views/components/js/dashboard.js"></script>

<!-- Settings & global -->
<script src="/static/views/components/js/settings.js"></script>
<script src="/static/views/components/js/events.js"></script>
```

---

## JavaScript Module Descriptions

### `data.js` — Core Data Engine

**Responsibilities:**

- Define the global `appData` object and all global state variables
- Load from and write to `localStorage` (key: `'project-planner-app'`)
- Debounced auto-sync to `POST /api/projects/save`
- `uid(prefix)` ID generator
- `saveData()` — the single entry point for all writes
- Sync status indicator management (`syncing` / `synced` / `error`)

**Key globals exposed:**

```javascript
window.appData; // { projects, currentUser, config }
window.currentProjectId; // active project ID
window.currentTaskId; // active task ID (detail panel)
window.currentView; // 'dashboard' | 'projects' | 'project-detail' | 'calendar' | 'settings'
window.saveData();
window.uid(prefix);
```

---

### `users.js` — User Profile Management

**Responsibilities:**

- Render the user selection screen on app load
- `GET /api/users` to fetch all profiles
- Create new user: `POST /api/users`
- Login with optional PIN: `POST /api/users/login`
- Delete user: `DELETE /api/users/<id>`
- Store `currentUser` in `appData` after successful login
- Switch profile from header button

**Key functions:**

```javascript
renderUserSelectionScreen();
loginUser(userId, pin);
createUser(name, pin);
deleteUser(userId);
switchUser();
```

---

### `projects.js` — Project List & CRUD

**Responsibilities:**

- Render the Project List view (`#view-projects`)
- Create, rename, archive, delete, duplicate projects
- Show project cards with: name, color, icon, progress bar, task count
- Filter/sort project list
- Trigger export (`GET /api/projects/export`)
- Trigger import (file picker → `POST /api/projects/import`)
- Navigate into a project (switch to Project Detail view)

**Key functions:**

```javascript
renderProjectList();
createProject(name, description, color, icon);
renameProject(projectId, newName);
archiveProject(projectId);
deleteProject(projectId);
duplicateProject(projectId);
exportProject(projectId);
importProject(file);
openProject(projectId);
getProjectProgress(projectId); // returns 0-100
```

---

### `tasks.js` — Task Board & List

**Responsibilities:**

- Render the Task List view and Kanban Board view inside Project Detail
- Create, update, soft-delete, restore tasks
- Toggle between `list` and `kanban` views
- Drag-and-drop in kanban (`DragEvent` API)
- Filter tasks by status, priority, tag, assignee, due date
- Search tasks by title
- Bulk status update
- Overdue detection and visual highlight
- Open task in Detail Panel

**Key functions:**

```javascript
renderTaskList(projectId);
renderKanbanBoard(projectId);
createTask(projectId, taskData);
updateTask(projectId, taskId, updates);
deleteTask(projectId, taskId); // soft delete
restoreTask(projectId, taskId);
moveTaskToStatus(projectId, taskId, newStatus);
filterTasks(projectId, filters);
openTaskDetail(taskId);
```

---

### `subtasks.js` — Subtask Checklist

**Responsibilities:**

- Render subtask checklist inside the Task Detail Panel
- Add, check/uncheck, delete individual subtasks
- Calculate and show subtask completion progress (e.g., "3 / 5 done")
- Update parent task's `updated_at` timestamp when subtask changes

**Key functions:**

```javascript
renderSubtasks(taskId);
addSubtask(taskId, title);
toggleSubtask(taskId, subtaskId);
deleteSubtask(taskId, subtaskId);
getSubtaskProgress(taskId); // returns { done, total }
```

---

### `notes.js` — Project Notes

**Responsibilities:**

- Render the Notes tab within Project Detail
- Note list with pin-to-top support
- Note editor: auto-save on input (debounced 500ms)
- Markdown preview mode (toggle between edit/preview)
- Create, rename, delete notes
- Sort notes by title or last modified

**Key functions:**

```javascript
renderNotesList(projectId);
renderNoteEditor(noteId);
createNote(projectId, title);
updateNote(projectId, noteId, content);
deleteNote(projectId, noteId);
pinNote(projectId, noteId);
renderMarkdownPreview(content); // lightweight markdown → HTML
```

**Markdown support (minimal renderer):**

- `# Heading 1`, `## Heading 2`
- `**bold**`, `*italic*`
- `- unordered list`, `1. ordered list`
- `` `inline code` ``, ` ```code block``` `
- `---` horizontal rule

---

### `calendar.js` — Calendar View

**Responsibilities:**

- Render Calendar view (`#view-calendar`)
- Monthly and weekly grid
- `GET /api/calendar/tasks` to load tasks with due dates
- Click on date → show tasks due that day
- Color-code tasks by project color
- Highlight overdue dates (past + incomplete tasks)
- Quick create task from calendar date click

**Key functions:**

```javascript
renderCalendar(year, month);
renderWeekView(weekStartDate);
loadCalendarTasks(year, month);
renderDayTaskList(date);
quickCreateTaskFromDate(date);
navigateCalendar(direction); // 'prev' | 'next'
```

---

### `ai.js` — AI Feature Helpers

**Responsibilities:**

- Fetch functions for all `/api/ai/*` endpoints
- Render AI suggestion chips (clickable task suggestions)
- Render AI answer panel / chat area
- Show/hide AI loading spinner
- Graceful degradation: hide AI UI elements if `ai_available = false`
- Error display for AI failures

**Key functions:**

```javascript
suggestTasks(projectTitle, description, existingTasks);
summarizeProject(projectId);
getSmartDeadline(taskTitle, description);
detectBlockers(projectId);
askAI(question, context);
renderAISuggestions(suggestions, onAccept);
renderAIAnswer(answer);
checkAIAvailability();
```

---

### `detail-panel.js` — Task Detail Slide-In Panel

**Responsibilities:**

- Control the right-side slide-in panel for task details
- Show full task info: title, description, status, priority, due date, assignee, tags
- Inline editing of all task fields
- Embed subtask checklist (uses `subtasks.js`)
- Embed comments section
- Embed AI assistant tab (uses `ai.js`)
- Add/remove tags
- Close panel on backdrop click or Escape key

**Key functions:**

```javascript
openDetailPanel(taskId);
closeDetailPanel();
renderDetailPanelContent(taskId);
renderCommentsSection(taskId);
addComment(taskId, text);
renderTagEditor(taskId);
```

---

### `toc.js` — Project Sidebar / Navigation

**Responsibilities:**

- Render the left sidebar project list (mini nav)
- Show active project highlight
- Show active task group / section highlight
- Navigate between views via sidebar links
- Collapse/expand sidebar on mobile

**Key functions:**

```javascript
renderSidebar();
setSidebarActiveProject(projectId);
collapseSidebar();
expandSidebar();
```

---

### `dashboard.js` — Dashboard View

**Responsibilities:**

- Render Dashboard (`#view-dashboard`)
- Fetch and display stats: active projects count, total tasks, tasks due today, overdue count
- Render "Recently Modified" projects (up to 5)
- Render "Upcoming Tasks" (next 7 days, sorted by due date)
- Quick-create task input on the dashboard

**Key functions:**

```javascript
renderDashboard();
loadDashboardStats();
renderRecentProjects();
renderUpcomingTasks();
```

---

### `settings.js` — Settings UI

**Responsibilities:**

- Render Settings view (`#view-settings`)
- `GET /api/settings` → show current config values
- `POST /api/settings` → save updated config
- Theme toggle (dark/light) — applies CSS class to `<body>`
- Show disk usage and file listing from `/api/settings/status`

**Key functions:**

```javascript
renderSettings();
saveSettings(updates);
toggleTheme();
loadDiskStatus();
```

---

### `events.js` — Global Event Listeners

**Responsibilities:**

- Initialize all event listeners after DOM load
- Top-level navigation (sidebar links, header buttons)
- Global keyboard shortcuts:
  - `Escape` → close modals / detail panel
  - `Ctrl+N` → quick create task
  - `Ctrl+/` → focus search
- Modal open/close logic (shared modal container)
- View switching: `switchView(viewName)`
- Click-outside detection for dropdowns and panels

**Key functions:**

```javascript
initEvents();
switchView(viewName);
openModal(content);
closeModal();
```

---

## CSS Modules

All CSS files are loaded in `index.html`. Each file styles exactly one component.

| File               | Scope                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `base.css`         | CSS reset, `:root` variables (colors, spacing, typography), global typography, utility classes |
| `layout.css`       | App shell: top header bar, sidebar, main content area, responsive grid                         |
| `sidebar.css`      | Left navigation sidebar (project list, view links, collapse behavior)                          |
| `dashboard.css`    | Dashboard stats cards, recent projects grid, upcoming task list                                |
| `projects.css`     | Project list cards, progress bar, color label dot, archive/delete actions                      |
| `tasks.css`        | Task rows in list view, status badges, priority badges, due date chips                         |
| `kanban.css`       | Kanban board columns, task card drag states, column headers                                    |
| `detail-panel.css` | Slide-in right panel, overlay backdrop, panel header/tabs                                      |
| `subtasks.css`     | Subtask checklist items, progress bar inside detail panel                                      |
| `notes.css`        | Notes list, note editor textarea, markdown preview rendering                                   |
| `calendar.css`     | Monthly grid, day cells, task dots, weekly view rows, overdue highlights                       |
| `users.css`        | User selection screen, profile avatars, PIN input                                              |
| `modals.css`       | Modal overlay, dialog box, confirm dialogs, form modals                                        |
| `ai.css`           | AI panel, suggestion chips, chat bubbles, loading spinner                                      |
| `responsive.css`   | All `@media` queries (mobile breakpoints for all components)                                   |

### CSS Variables (defined in `base.css` `:root`)

```css
:root {
  --color-primary: #6366f1; /* Indigo — brand accent */
  --color-success: #22c55e; /* Green — done status */
  --color-warning: #f59e0b; /* Amber — in-progress / high priority */
  --color-danger: #ef4444; /* Red — blocked / urgent / overdue */
  --color-muted: #6b7280; /* Gray — secondary text */

  /* Dark theme defaults */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border-color: #334155;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --sidebar-width: 240px;
  --detail-panel-width: 400px;
  --header-height: 56px;
  --z-modal: 1000;
  --z-panel: 900;
  --z-dropdown: 800;
}
```

---

## HTML Structure (`index.html`)

```html
<body class="theme-dark">
  <!-- Header bar -->
  <header id="app-header">
    <!-- Logo, user avatar/switch, sync status indicator -->
  </header>

  <!-- App shell -->
  <div id="app-shell">
    <!-- Left navigation sidebar -->
    <nav id="sidebar">
      <!-- View links: Dashboard, Projects, Calendar, Settings -->
      <!-- Mini project list -->
    </nav>

    <!-- Main content area — only one view visible at a time -->
    <main id="main-content">
      <div id="view-user-selection" class="view hidden">...</div>
      <div id="view-dashboard" class="view hidden">...</div>
      <div id="view-projects" class="view hidden">...</div>
      <div id="view-project-detail" class="view hidden">...</div>
      <div id="view-calendar" class="view hidden">...</div>
      <div id="view-settings" class="view hidden">...</div>
    </main>

    <!-- Slide-in task detail panel (right side) -->
    <aside id="detail-panel" class="hidden">
      <!-- Task info, subtasks, comments, AI tab -->
    </aside>
  </div>

  <!-- Shared modal container -->
  <div id="modal-overlay" class="hidden">
    <div id="modal-box">...</div>
  </div>

  <!-- All script tags in order -->
  <script src="..."></script>
</body>
```

---

## View Navigation Flow

```
App Load
  │
  ├─ No user in localStorage → show #view-user-selection
  └─ User logged in → show #view-dashboard
        │
        ├─ Sidebar "Projects" → show #view-projects
        │       └─ Click project card → show #view-project-detail
        │               └─ Click task row → slide in #detail-panel
        │
        ├─ Sidebar "Calendar" → show #view-calendar
        │       └─ Click date → show task list for that date
        │
        └─ Sidebar "Settings" → show #view-settings
```

Only one `.view` div is visible at a time. `switchView(name)` removes `hidden` from the target and adds it to all others.

---

## State Flow Example — Creating a Task

```
User types task title + clicks "Add Task"
  │
  events.js → createTask(projectId, { title, status: 'todo', priority: 'medium' })
  │
  tasks.js → creates Task object with uid()
           → appData.projects[projectId].tasks.push(newTask)
           → saveData()                    ← data.js
           │     → localStorage.setItem(...)
           │     → scheduleSync()
           │           → autoSaveToServer()  POST /api/projects/save
           │
           → renderTaskList(projectId)      ← immediate DOM update
```
