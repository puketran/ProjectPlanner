// ============================================================
// data.js — Core state management, localStorage & server sync
// ============================================================
(function () {
  'use strict';

  // ─── Global state ─────────────────────────────────────────
  window.appData = {
    projects: {},    // { projectId: projectObject }
    currentUser: null,
    config: {}
  };
  window.currentProjectId = null;
  window.currentTaskId    = null;
  window.currentNoteId    = null;
  window.currentView      = 'user-selection';

  const LOCAL_KEY = 'project-planner-app';
  let _syncTimer  = null;

  // ─── Unique ID generator ──────────────────────────────────
  window.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  };

  window.isoNow = function () { return new Date().toISOString(); };

  // ─── LocalStorage persistence ─────────────────────────────
  window.saveData = function () {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({
        projects:    window.appData.projects,
        currentUser: window.appData.currentUser,
        config:      window.appData.config
      }));
      _setSyncStatus('modified');
      clearTimeout(_syncTimer);
      _syncTimer = setTimeout(_syncToServer, 1500);
    } catch (e) {
      console.warn('saveData error:', e);
    }
  };

  window.loadData = function () {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.projects)    window.appData.projects    = d.projects;
      if (d.currentUser) window.appData.currentUser = d.currentUser;
      if (d.config)      window.appData.config      = d.config;
    } catch (e) {
      console.warn('loadData error:', e);
    }
  };

  // ─── Server sync (non-blocking, fire-and-forget) ──────────
  async function _syncToServer() {
    if (!window.appData.currentUser) return;
    _setSyncStatus('saving');
    try {
      const r = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:  window.appData.currentUser.id,
          projects: window.appData.projects
        })
      });
      _setSyncStatus(r.ok ? 'saved' : 'error');
    } catch (_) {
      _setSyncStatus('error');
    }
  }

  function _setSyncStatus(s) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const map = {
      modified: ['fa-circle-dot',          'Unsaved',  'sync-modified'],
      saving:   ['fa-cloud-arrow-up fa-spin','Saving…', 'sync-saving'],
      saved:    ['fa-cloud-check',          'Saved',    'sync-saved'],
      error:    ['fa-triangle-exclamation', 'Sync error','sync-error']
    };
    const info = map[s];
    if (info) {
      el.className = 'sync-status ' + info[2];
      el.innerHTML = `<i class="fa ${info[0]}"></i> ${info[1]}`;
    } else {
      el.className = 'sync-status';
      el.innerHTML = '';
    }
  }

  // ─── Load projects from server on startup ─────────────────
  window.loadProjectsFromServer = async function (userId) {
    try {
      const r = await fetch('/api/projects?user_id=' + userId);
      if (!r.ok) return;
      const data = await r.json();
      for (const meta of data.projects || []) {
        if (window.appData.projects[meta.id]) continue; // already have locally
        const fr = await fetch('/api/projects/export?project_id=' + meta.id);
        if (fr.ok) {
          const full = await fr.json();
          window.appData.projects[full.id] = full;
        }
      }
      window.saveData();
    } catch (_) { /* offline – use localStorage */ }
  };

  // ─── Convenience getters ──────────────────────────────────
  window.getProject = function (id) { return window.appData.projects[id] || null; };

  window.getActiveTasks = function (projectId) {
    const p = window.getProject(projectId);
    return p ? (p.tasks || []).filter(t => !t.deleted) : [];
  };

  window.getDeletedTasks = function (projectId) {
    const p = window.getProject(projectId);
    return p ? (p.tasks || []).filter(t => t.deleted) : [];
  };

  window.getUserProjects = function (statusFilter) {
    if (!window.appData.currentUser) return [];
    const uid = window.appData.currentUser.id;
    return Object.values(window.appData.projects).filter(p => {
      if (p.user_id !== uid) return false;
      if (p.status === 'deleted') return false;
      if (statusFilter === 'active')   return p.status !== 'archived';
      if (statusFilter === 'archived') return p.status === 'archived';
      return true;
    });
  };
})();
