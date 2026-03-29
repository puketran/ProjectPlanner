// ============================================================
// events.js — App initialization and all global event listeners
// ============================================================
(function () {
  'use strict';

  // ─── View switching ───────────────────────────────────────
  window.switchView = function (viewName) {
    window.currentView = viewName;

    // Show/hide views
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.remove('hidden');

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.view === viewName);
    });

    // Clear breadcrumb for top-level views
    if (['dashboard','projects','calendar','settings','user-selection'].includes(viewName)) {
      const bc = document.getElementById('header-breadcrumb');
      if (bc) bc.innerHTML = '';
    }

    // Show/hide sidebar (hide on user-selection)
    const sidebar = document.getElementById('sidebar');
    const shell   = document.getElementById('app-shell');
    if (viewName === 'user-selection') {
      if (sidebar) sidebar.style.display = 'none';
      document.getElementById('app-header') && (document.getElementById('app-header').style.display = 'none');
    } else {
      if (sidebar) sidebar.style.display = '';
      document.getElementById('app-header') && (document.getElementById('app-header').style.display = '');
    }

    // Close detail panel when switching away from project-detail
    if (viewName !== 'project-detail' && typeof window.closeDetailPanel === 'function') {
      window.closeDetailPanel();
    }

    // Refresh view-specific content
    if (viewName === 'dashboard'       && typeof window.renderDashboard       === 'function') window.renderDashboard();
    if (viewName === 'projects'        && typeof window.renderProjects        === 'function') window.renderProjects();
    if (viewName === 'calendar'        && typeof window.renderCalendar        === 'function') window.renderCalendar();
    if (viewName === 'settings'        && typeof window.renderSettings        === 'function') window.renderSettings();
    if (viewName === 'timeline'        && typeof window.renderTimeline        === 'function') window.renderTimeline();
    if (viewName === 'user-selection'  && typeof window.renderUserSelection   === 'function') window.renderUserSelection();

    // Update sidebar mini project list
    if (typeof window.renderSidebarProjects === 'function') window.renderSidebarProjects();
  };

  // ─── Modal system ─────────────────────────────────────────
  window.openModal = function (htmlContent) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) return;
    content.innerHTML = htmlContent;
    overlay.classList.remove('hidden');
    // Focus first focusable element
    const focusable = content.querySelector('input:not([type=hidden]),textarea,select,button:not(.modal-close)');
    if (focusable) setTimeout(() => focusable.focus(), 50);
  };

  window.closeModal = function () {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    const content = document.getElementById('modal-content');
    if (content) content.innerHTML = '';
  };

  // ─── Initialize ───────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // Restore data from localStorage
    window.loadData();

    // Restore theme
    if (typeof window.initTheme === 'function') window.initTheme();

    // Determine starting view
    if (window.appData.currentUser && window.appData.currentUser.id) {
      const el = document.getElementById('header-username');
      if (el) el.textContent = window.appData.currentUser.name;
      window.switchView('dashboard');
      // Sync with server in background
      window.loadProjectsFromServer(window.appData.currentUser.id);
    } else {
      window.switchView('user-selection');
    }

    // ── Header buttons ──────────────────────────────────────
    _on('btn-sidebar-toggle', 'click', function () {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;
      sidebar.classList.toggle('collapsed');
      sidebar.classList.toggle('mobile-open');
    });

    _on('btn-theme-toggle', 'click', function () {
      const isDark = document.body.classList.contains('theme-dark');
      if (typeof window.setTheme === 'function') window.setTheme(isDark ? 'light' : 'dark');
    });

    _on('btn-user-switch', 'click', function () {
      // Save state and go to user selection
      if (window.appData.currentUser) {
        window.appData.currentUser = null;
        window.saveData();
      }
      window.switchView('user-selection');
    });

    // ── Nav links ────────────────────────────────────────────
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const view = this.dataset.view;
        if (view) window.switchView(view);
        // Close mobile sidebar
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
          sidebar.classList.remove('mobile-open');
        }
      });
    });

    // ── User selection ───────────────────────────────────────
    _on('btn-create-user', 'click', () => {
      if (typeof window.showCreateUserModal === 'function') window.showCreateUserModal();
    });

    // ── Dashboard ────────────────────────────────────────────
    _on('btn-new-project-dash', 'click', () => {
      window.switchView('projects');
      if (typeof window.showCreateProjectModal === 'function') window.showCreateProjectModal();
    });

    // ── Projects view ────────────────────────────────────────
    _on('btn-import-project', 'click', () => {
      if (typeof window.importProject === 'function') window.importProject();
    });
    _on('btn-new-project', 'click', () => {
      if (typeof window.showCreateProjectModal === 'function') window.showCreateProjectModal();
    });
    _on('project-filter-status', 'change', function () {
      if (typeof window.renderProjects === 'function') window.renderProjects(this.value);
    });

    // ── Project detail header buttons ────────────────────────
    _on('btn-back-projects', 'click', () => {
      window.switchView('projects');
      window.currentProjectId = null;
    });
    _on('btn-export-project', 'click', () => {
      if (typeof window.exportCurrentProject === 'function') window.exportCurrentProject();
    });
    _on('btn-archive-project', 'click', () => {
      if (typeof window.archiveCurrentProject === 'function') window.archiveCurrentProject();
    });
    _on('btn-delete-project', 'click', () => {
      if (typeof window.deleteCurrentProject === 'function') window.deleteCurrentProject();
    });

    // ── Project tabs ─────────────────────────────────────────
    document.querySelectorAll('.project-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (typeof window.switchProjectTab === 'function') window.switchProjectTab(this.dataset.tab);
      });
    });

    // ── Task toolbar ─────────────────────────────────────────
    _on('btn-add-task', 'click', () => {
      if (typeof window.showQuickAdd === 'function') window.showQuickAdd();
    });
    _on('btn-view-list', 'click', () => {
      if (typeof window.setTaskView === 'function') window.setTaskView('list');
    });
    _on('btn-view-kanban', 'click', () => {
      if (typeof window.setTaskView === 'function') window.setTaskView('kanban');
    });
    _on('btn-toggle-completed', 'click', () => {
      if (typeof window.toggleShowCompleted === 'function') window.toggleShowCompleted();
    });
    _on('btn-undo', 'click', () => {
      if (typeof window.undoAction === 'function') window.undoAction(window.currentProjectId);
    });
    _on('btn-redo', 'click', () => {
      if (typeof window.redoAction === 'function') window.redoAction(window.currentProjectId);
    });
    _on('btn-ai-tasks', 'click', () => {
      if (typeof window.aiSuggestTasks === 'function') window.aiSuggestTasks();
    });

    // Kanban column "Add" buttons
    document.querySelectorAll('.kanban-add-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const title = prompt('New task title:');
        if (title && typeof window.createTask === 'function') {
          window.createTask(window.currentProjectId, title, this.dataset.status);
        }
      });
    });

    // ── Quick-add bar ────────────────────────────────────────
    _on('quick-task-input', 'keydown', function (e) {
      if (e.key === 'Enter') {
        const title = this.value.trim();
        if (title && typeof window.createTask === 'function') {
          window.createTask(window.currentProjectId, title, 'todo');
          if (typeof window.hideQuickAdd === 'function') window.hideQuickAdd();
        }
      } else if (e.key === 'Escape') {
        if (typeof window.hideQuickAdd === 'function') window.hideQuickAdd();
      }
    });

    // ── Task filters ─────────────────────────────────────────
    ['task-search','task-filter-status','task-filter-priority'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => {
        if (typeof window.renderTasks === 'function') window.renderTasks(window.currentProjectId);
      });
    });

    // ── Notes tab ────────────────────────────────────────────
    _on('btn-add-note', 'click', () => {
      if (typeof window.createNote === 'function') window.createNote(window.currentProjectId);
    });
    _on('btn-delete-note', 'click', () => {
      if (typeof window.deleteCurrentNote === 'function') window.deleteCurrentNote();
    });
    _on('btn-note-preview', 'click', () => {
      if (typeof window.toggleNotePreview === 'function') window.toggleNotePreview();
    });

    // ── Calendar navigation ──────────────────────────────────
    _on('btn-cal-prev',  'click', () => { if (typeof window.calPrev  === 'function') window.calPrev(); });
    _on('btn-cal-next',  'click', () => { if (typeof window.calNext  === 'function') window.calNext(); });
    _on('btn-cal-today', 'click', () => { if (typeof window.calToday === 'function') window.calToday(); });

    // ── Detail panel ─────────────────────────────────────────
    _on('btn-close-panel', 'click', () => {
      if (typeof window.closeDetailPanel === 'function') window.closeDetailPanel();
    });
    _on('panel-backdrop', 'click', () => {
      if (typeof window.closeDetailPanel === 'function') window.closeDetailPanel();
    });

    // Detail panel tabs
    document.querySelectorAll('.dp-tab').forEach(btn => {
      btn.addEventListener('click', function () {
        if (typeof window.switchDPTab === 'function') window.switchDPTab(this.dataset.dptab);
      });
    });

    // Subtasks
    _on('btn-add-subtask', 'click', () => {
      if (typeof window.addSubtask === 'function') window.addSubtask(window.currentProjectId, window.currentTaskId);
    });
    _on('dp-subtask-input', 'keydown', function (e) {
      if (e.key === 'Enter' && typeof window.addSubtask === 'function') {
        window.addSubtask(window.currentProjectId, window.currentTaskId);
      }
    });

    // Comment
    _on('btn-add-comment', 'click', () => {
      if (typeof window.addComment === 'function') window.addComment();
    });
    _on('dp-comment-input', 'keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && typeof window.addComment === 'function') {
        e.preventDefault();
        window.addComment();
      }
    });

    // AI panel
    _on('btn-ai-ask', 'click', () => {
      if (typeof window.aiAsk === 'function') window.aiAsk();
    });
    _on('ai-ask-input', 'keydown', function (e) {
      if (e.key === 'Enter' && typeof window.aiAsk === 'function') window.aiAsk();
    });

    document.querySelectorAll('.ai-action-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const action = this.dataset.action;
        if (action === 'ask-next'       && typeof window.aiWhatNext       === 'function') window.aiWhatNext();
        if (action === 'smart-deadline' && typeof window.aiSmartDeadline  === 'function') window.aiSmartDeadline();
      });
    });

    // ── Settings ─────────────────────────────────────────────
    _on('btn-save-settings', 'click', () => {
      if (typeof window.saveSettings === 'function') window.saveSettings();
    });
    _on('btn-theme-dark', 'click', () => {
      if (typeof window.setTheme === 'function') window.setTheme('dark');
    });
    _on('btn-theme-light', 'click', () => {
      if (typeof window.setTheme === 'function') window.setTheme('light');
    });

    // ── Modal overlay click-outside to close ─────────────────
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === this) window.closeModal();
      });
    }

    // ── Keyboard shortcuts ────────────────────────────────────
    document.addEventListener('keydown', function (e) {
      // Esc: close modal or detail panel
      if (e.key === 'Escape') {
        const overlay = document.getElementById('modal-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
          window.closeModal();
          return;
        }
        if (window.currentTaskId && typeof window.closeDetailPanel === 'function') {
          window.closeDetailPanel();
          return;
        }
        const quickAdd = document.getElementById('quick-add-task');
        if (quickAdd && !quickAdd.classList.contains('hidden')) {
          if (typeof window.hideQuickAdd === 'function') window.hideQuickAdd();
          return;
        }
      }

      // Ctrl/Cmd+Z: undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z' && window.currentView === 'project-detail') {
        e.preventDefault();
        if (typeof window.undoAction === 'function') window.undoAction(window.currentProjectId);
        return;
      }

      // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z: redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z')) && window.currentView === 'project-detail') {
        e.preventDefault();
        if (typeof window.redoAction === 'function') window.redoAction(window.currentProjectId);
        return;
      }

      // Ctrl/Cmd+N: new task (when in project detail)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && window.currentView === 'project-detail') {
        e.preventDefault();
        if (typeof window.showQuickAdd === 'function') window.showQuickAdd();
      }

      // Ctrl/Cmd+K: go to projects
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        window.switchView('projects');
      }

      // Alt+R: refresh milestone detail panels (without page reload)
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'r'
          && window.currentProjectId
          && typeof window.refreshOpenMilestoneDetails === 'function') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
        e.preventDefault();
        window.refreshOpenMilestoneDetails(window.currentProjectId);
      }
    });
  });

  // ─── Helper: attach event listener by ID ─────────────────
  function _on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }
})();
