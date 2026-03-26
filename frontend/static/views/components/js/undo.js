// ============================================================
// undo.js — Undo / Redo stack for task mutations (per project)
// ============================================================
(function () {
  'use strict';

  const MAX_STACK = 50;

  // keyed by projectId → array of JSON snapshots of proj.tasks
  const _undoStack  = {};
  const _redoStack  = {};

  // ─── Snapshot helpers ─────────────────────────────────────
  function _snapshot(projectId) {
    const proj = window.getProject(projectId);
    return proj ? JSON.parse(JSON.stringify(proj.tasks || [])) : [];
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Call BEFORE any task mutation to save the current state.
   * Clears the redo stack for the project.
   */
  window.pushUndo = function (projectId) {
    if (!projectId) return;
    if (!_undoStack[projectId]) _undoStack[projectId] = [];
    if (!_redoStack[projectId]) _redoStack[projectId] = [];
    _undoStack[projectId].push(_snapshot(projectId));
    if (_undoStack[projectId].length > MAX_STACK) _undoStack[projectId].shift();
    _redoStack[projectId] = [];
    _refreshButtons();
  };

  window.undoAction = function (projectId) {
    projectId = projectId || window.currentProjectId;
    if (!projectId) return;
    const stack = _undoStack[projectId];
    if (!stack || stack.length === 0) return;
    const proj = window.getProject(projectId);
    if (!proj) return;
    if (!_redoStack[projectId]) _redoStack[projectId] = [];
    _redoStack[projectId].push(_snapshot(projectId));
    if (_redoStack[projectId].length > MAX_STACK) _redoStack[projectId].shift();
    proj.tasks = stack.pop();
    proj.updated_at = window.isoNow();
    window.saveData();
    window.renderTasks(projectId);
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    _refreshButtons();
  };

  window.redoAction = function (projectId) {
    projectId = projectId || window.currentProjectId;
    if (!projectId) return;
    const stack = _redoStack[projectId];
    if (!stack || stack.length === 0) return;
    const proj = window.getProject(projectId);
    if (!proj) return;
    if (!_undoStack[projectId]) _undoStack[projectId] = [];
    _undoStack[projectId].push(_snapshot(projectId));
    if (_undoStack[projectId].length > MAX_STACK) _undoStack[projectId].shift();
    proj.tasks = stack.pop();
    proj.updated_at = window.isoNow();
    window.saveData();
    window.renderTasks(projectId);
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    _refreshButtons();
  };

  window.canUndo = function (projectId) {
    return ((_undoStack[projectId] || []).length > 0);
  };
  window.canRedo = function (projectId) {
    return ((_redoStack[projectId] || []).length > 0);
  };

  function _refreshButtons() {
    const pid  = window.currentProjectId;
    const undo = document.getElementById('btn-undo');
    const redo = document.getElementById('btn-redo');
    if (undo) {
      undo.disabled = !window.canUndo(pid);
      undo.title    = window.canUndo(pid)
        ? `Undo (${(_undoStack[pid] || []).length} steps)`
        : 'Nothing to undo';
    }
    if (redo) {
      redo.disabled = !window.canRedo(pid);
      redo.title    = window.canRedo(pid)
        ? `Redo (${(_redoStack[pid] || []).length} steps)`
        : 'Nothing to redo';
    }
  }

  window.refreshUndoButtons = _refreshButtons;
})();
