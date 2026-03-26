// ============================================================
// subtasks.js — Subtask checklist inside detail panel
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const PRIO_COLORS = { high:'#ef4444', medium:'#f97316', low:'#22c55e' };

  function _fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  }

  // ─── Render subtasks in detail panel ─────────────────────
  window.renderSubtasks = function (projectId, taskId) {
    const container = document.getElementById('dp-subtasks');
    const progress  = document.getElementById('dp-subtask-progress');
    if (!container) return;

    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    const subtasks = task ? (task.subtasks || []) : [];

    const done  = subtasks.filter(s => s.done).length;
    const total = subtasks.length;

    if (progress) progress.textContent = total ? `${done}/${total}` : '';

    if (subtasks.length === 0) {
      container.innerHTML = '<p class="empty-state" style="font-size:var(--font-size-xs)">No subtasks yet.</p>';
      return;
    }

    container.innerHTML = subtasks.map(s => {
      const hasMeta = s.due_date || s.priority || s.assignee;
      return `
        <div class="subtask-item ${s.done ? 'subtask-done' : ''}" data-subtask-id="${s.id}">
          <label class="subtask-check-label">
            <input type="checkbox" class="subtask-checkbox" data-subtask-id="${s.id}" ${s.done ? 'checked' : ''} />
          </label>
          <div class="subtask-body" data-action="edit-subtask" data-subtask-id="${s.id}" title="Click to edit">
            <span class="subtask-title">${esc(s.title)}</span>
            ${s.notes ? `<span class="subtask-notes-preview">${esc(s.notes)}</span>` : ''}
            ${hasMeta ? `<div class="subtask-meta-row">
              ${s.due_date  ? `<span class="subtask-chip subtask-chip-due"><i class="fa fa-calendar-days"></i> ${_fmtDate(s.due_date)}</span>` : ''}
              ${s.priority  ? `<span class="subtask-chip subtask-chip-prio" style="background:${PRIO_COLORS[s.priority]||'#6366f1'}1a;color:${PRIO_COLORS[s.priority]||'#6366f1'}">${s.priority}</span>` : ''}
              ${s.assignee  ? `<span class="subtask-chip"><i class="fa fa-user"></i> ${esc(s.assignee)}</span>` : ''}
            </div>` : ''}
          </div>
          <button class="subtask-delete-btn" data-subtask-id="${s.id}" title="Remove">
            <i class="fa fa-xmark"></i>
          </button>
        </div>`;
    }).join('');

    container.querySelectorAll('.subtask-checkbox').forEach(cb => {
      cb.addEventListener('change', function () {
        _toggleSubtask(projectId, taskId, this.dataset.subtaskId, this.checked);
      });
    });
    container.querySelectorAll('[data-action="edit-subtask"]').forEach(el => {
      el.addEventListener('click', function () {
        window.openSubtaskModal(projectId, taskId, this.dataset.subtaskId);
      });
    });
    container.querySelectorAll('.subtask-delete-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        _deleteSubtask(projectId, taskId, this.dataset.subtaskId);
      });
    });
  };

  // ─── Subtask edit modal ───────────────────────────────────
  window.openSubtaskModal = function (projectId, taskId, subtaskId) {
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;
    const s = (task.subtasks || []).find(st => st.id === subtaskId);
    if (!s) return;

    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-list-check"></i> Edit Subtask</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Title *</label>
          <input id="sm-title" type="text" class="form-input" value="${esc(s.title)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea id="sm-notes" class="form-textarea" rows="3" placeholder="Additional details…">${esc(s.notes || '')}</textarea>
        </div>
        <div class="form-group-row">
          <div class="form-group" style="flex:1">
            <label class="form-label">Due Date</label>
            <input id="sm-due" type="date" class="form-input" value="${s.due_date || ''}" />
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Priority</label>
            <select id="sm-priority" class="form-input">
              <option value="" ${!s.priority ? 'selected' : ''}>None</option>
              <option value="low"    ${s.priority==='low'    ? 'selected' : ''}>Low</option>
              <option value="medium" ${s.priority==='medium' ? 'selected' : ''}>Medium</option>
              <option value="high"   ${s.priority==='high'   ? 'selected' : ''}>High</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Assignee</label>
          <input id="sm-assignee" type="text" class="form-input" value="${esc(s.assignee || '')}" placeholder="@person" />
        </div>
        <div class="form-group subtask-done-toggle">
          <label class="form-label" style="margin:0">Mark as completed</label>
          <input type="checkbox" id="sm-done" class="subtask-modal-done-cb" ${s.done ? 'checked' : ''} />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="sm-save-btn">Save</button>
      </div>
    `);

    const inp = document.getElementById('sm-title');
    inp.focus(); inp.select();
    const doSave = () => {
      const title = inp.value.trim();
      if (!title) { inp.style.borderColor = 'var(--color-danger)'; return; }
      s.title    = title;
      s.notes    = document.getElementById('sm-notes').value.trim() || null;
      s.due_date = document.getElementById('sm-due').value || null;
      s.priority = document.getElementById('sm-priority').value || null;
      s.assignee = document.getElementById('sm-assignee').value.trim() || null;
      s.done     = document.getElementById('sm-done').checked;
      task.updated_at = window.isoNow();
      window.touchProject(projectId);
      window.closeModal();
      window.renderSubtasks(projectId, taskId);
      window.renderTasks(projectId);
    };
    document.getElementById('sm-save-btn').onclick = doSave;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
  };

  // ─── Add subtask ──────────────────────────────────────────
  window.addSubtask = function (projectId, taskId) {
    const inp = document.getElementById('dp-subtask-input');
    if (!inp) return;
    const title = inp.value.trim();
    if (!title) return;
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;
    task.subtasks = task.subtasks || [];
    task.subtasks.push({ id: window.uid('st'), title, done: false, created_at: window.isoNow() });
    task.updated_at = window.isoNow();
    window.touchProject(projectId);
    inp.value = '';
    window.renderSubtasks(projectId, taskId);
    window.renderTasks(projectId);
  };

  // ─── Toggle subtask ───────────────────────────────────────
  function _toggleSubtask(projectId, taskId, subtaskId, done) {
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;
    const sub = (task.subtasks || []).find(s => s.id === subtaskId);
    if (!sub) return;
    sub.done = done;
    task.updated_at = window.isoNow();
    window.touchProject(projectId);
    window.renderSubtasks(projectId, taskId);
    window.renderTasks(projectId);
  }

  // ─── Delete subtask ───────────────────────────────────────
  function _deleteSubtask(projectId, taskId, subtaskId) {
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;
    task.subtasks = (task.subtasks || []).filter(s => s.id !== subtaskId);
    task.updated_at = window.isoNow();
    window.touchProject(projectId);
    window.renderSubtasks(projectId, taskId);
    window.renderTasks(projectId);
  }
})();
