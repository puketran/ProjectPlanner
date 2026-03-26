// ============================================================
// disciplines.js — Team Board view (tasks grouped by discipline)
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const DEFAULT_DISCIPLINES = ['GD', 'Art', 'Dev', 'QA', 'Production'];

  // Distinct color per discipline
  const DISC_COLORS = {
    'GD':         '#6366f1',
    'Art':        '#ec4899',
    'Dev':        '#22c55e',
    'QA':         '#f97316',
    'Production': '#06b6d4',
  };

  // Expose defaults so other modules can reference them
  window.DEFAULT_DISCIPLINES = DEFAULT_DISCIPLINES;

  function _getDiscColor(disc) {
    return DISC_COLORS[disc] || '#8b5cf6';
  }
  window.getDiscColor = _getDiscColor;

  // ─── Manage disciplines modal ─────────────────────────────
  window.manageDisciplines = function (projectId) {
    const proj = window.getProject(projectId);
    if (!proj) return;
    const disciplines = (proj.disciplines && proj.disciplines.length)
      ? [...proj.disciplines]
      : [...DEFAULT_DISCIPLINES];

    const _rebuildList = () => disciplines.map((d, i) => `
      <div class="disc-manage-row" data-idx="${i}">
        <span class="disc-manage-dot" style="background:${_getDiscColor(d)}"></span>
        <span class="disc-manage-name">${esc(d)}</span>
        <button class="icon-btn text-danger disc-rm-btn" data-idx="${i}" title="Remove"><i class="fa fa-times"></i></button>
      </div>`).join('');

    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-users"></i> Manage Disciplines</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-muted);font-size:var(--font-size-sm);margin-bottom:10px">Disciplines appear in the Team Board and task filters.</p>
        <div id="disc-manage-list">${_rebuildList()}</div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <input id="disc-new-input" type="text" class="form-input" placeholder="New discipline name…" style="flex:1" />
          <button class="btn btn-primary btn-sm" id="disc-add-btn"><i class="fa fa-plus"></i> Add</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="disc-save-btn">Save</button>
      </div>
    `);

    const _refresh = () => {
      const list = document.getElementById('disc-manage-list');
      if (list) list.innerHTML = _rebuildList();
      list.querySelectorAll('.disc-rm-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          disciplines.splice(parseInt(this.dataset.idx), 1);
          _refresh();
        });
      });
    };

    _refresh();

    document.getElementById('disc-add-btn').addEventListener('click', () => {
      const inp = document.getElementById('disc-new-input');
      const val = inp.value.trim();
      if (!val) return;
      if (!disciplines.includes(val)) disciplines.push(val);
      inp.value = '';
      _refresh();
    });
    document.getElementById('disc-new-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('disc-add-btn').click();
    });

    document.getElementById('disc-save-btn').addEventListener('click', () => {
      proj.disciplines = [...disciplines];
      proj.updated_at  = window.isoNow();
      window.saveData();
      window.closeModal();
      window.renderTeamBoard(projectId);
    });
  };

  // ─── Main render ─────────────────────────────────────────
  window.renderTeamBoard = function (projectId) {
    const container = document.getElementById('project-tab-team-board');
    if (!container) return;
    projectId = projectId || window.currentProjectId;
    if (!projectId) return;

    const proj        = window.getProject ? window.getProject(projectId) : null;
    const disciplines = (proj && proj.disciplines && proj.disciplines.length)
      ? proj.disciplines
      : DEFAULT_DISCIPLINES;
    const allTasks    = (proj && proj.tasks) ? proj.tasks.filter(t => !t.deleted) : [];

    // Group tasks by discipline
    const byDisc = {};
    disciplines.forEach(d => { byDisc[d] = []; });
    byDisc['Unassigned'] = [];
    allTasks.forEach(t => {
      const d = t.discipline;
      if (d && byDisc[d] !== undefined) byDisc[d].push(t);
      else byDisc['Unassigned'].push(t);
    });

    // Build visible columns — always show all disciplines; add Unassigned only if non-empty
    const visibleDiscs = [...disciplines];
    if (byDisc['Unassigned'].length > 0) visibleDiscs.push('Unassigned');

    const colsHtml = visibleDiscs.map(disc => {
      const tasks   = byDisc[disc] || [];
      const color   = _getDiscColor(disc);
      const cardsHtml = tasks.length
        ? tasks.map(t => _taskCardHtml(t, projectId, color)).join('')
        : `<div class="disc-col-empty">No tasks</div>`;
      return `
        <div class="disc-col" style="--disc-color:${color}">
          <div class="disc-col-header">
            ${esc(disc)}
            <span class="disc-col-count">${tasks.length}</span>
          </div>
          <div class="disc-col-tasks">${cardsHtml}</div>
        </div>`;
    }).join('');

    const totalTasks = allTasks.length;
    const assigned   = allTasks.filter(t => t.discipline).length;

    container.innerHTML = `
      <div class="team-board-header">
        <span class="team-board-intro">
          <i class="fa fa-users"></i>
          Tasks grouped by discipline &nbsp;·&nbsp;
          ${assigned} / ${totalTasks} assigned
        </span>
        <button class="btn btn-ghost btn-sm" id="btn-manage-disc" title="Manage disciplines">
          <i class="fa fa-gear"></i> Manage
        </button>
      </div>
      <div class="team-board-scroll">
        <div class="team-board">${colsHtml || '<p style="color:var(--text-muted);padding:20px">No tasks yet.</p>'}</div>
      </div>`;

    const manageBtn = document.getElementById('btn-manage-disc');
    if (manageBtn) manageBtn.addEventListener('click', () => window.manageDisciplines(projectId));

    // Click task → open detail panel
    container.querySelectorAll('.disc-task-card[data-task-id]').forEach(card => {
      card.addEventListener('click', function () {
        if (typeof window.openDetailPanel === 'function')
          window.openDetailPanel(projectId, this.dataset.taskId);
      });
    });
  };

  // ─── Task card HTML ──────────────────────────────────────
  function _taskCardHtml(t, projectId, colColor) {
    const statusIcons  = {
      'todo':        'fa-circle',
      'in-progress': 'fa-spinner',
      'blocked':     'fa-lock',
      'done':        'fa-circle-check',
    };
    const statusColors = {
      'todo':        'var(--text-muted)',
      'in-progress': '#3b82f6',
      'blocked':     '#ef4444',
      'done':        '#22c55e',
    };
    const prioIcons = { urgent:'fa-fire', high:'fa-arrow-up', medium:'fa-minus', low:'fa-arrow-down' };
    const prioIcon  = prioIcons[t.priority] || 'fa-minus';

    // Milestone chip
    const proj   = window.getProject ? window.getProject(projectId) : null;
    const ms     = (proj && t.milestone_id) ? (proj.milestones || []).find(m => m.id === t.milestone_id) : null;
    const msChip = ms
      ? `<span class="disc-chip" style="background:${ms.color || '#6366f1'}22;color:${ms.color || '#6366f1'}">${esc(ms.title)}</span>`
      : '';

    const isDone = t.status === 'done';

    return `
      <div class="disc-task-card${isDone ? ' disc-task-done' : ''}" data-task-id="${t.id}">
        <div class="disc-task-title">${esc(t.title)}</div>
        <div class="disc-task-meta">
          <i class="fa ${statusIcons[t.status] || 'fa-circle'}" style="color:${statusColors[t.status] || 'var(--text-muted)'}" title="${esc(t.status || '')}"></i>
          <i class="fa ${prioIcon}" title="${esc(t.priority || '')}"></i>
          ${t.due_date ? `<span><i class="fa fa-calendar-days"></i> ${t.due_date.slice(5)}</span>` : ''}
          ${msChip}
        </div>
      </div>`;
  }
})();
