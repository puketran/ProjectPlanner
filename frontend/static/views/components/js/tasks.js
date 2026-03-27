// ============================================================
// tasks.js — Task list, kanban board, CRUD, filters
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const PRIORITY_ICONS = { urgent:'fa-fire text-danger', high:'fa-arrow-up text-warning', medium:'fa-minus', low:'fa-arrow-down text-muted' };
  const STATUS_LABELS  = { 'todo':'Todo','in-progress':'In Progress','blocked':'Blocked','done':'Done' };

  let _showCompleted = true;
  let _dragTaskId    = null;
  let _dragProjId    = null;
  let _disciplineFilter = null;

  // Tracks which task rows have their inline subtask panel open
  const _openSubtaskPanels = new Set();

  // ─── Render tasks (list + kanban refreshed together) ─────
  window.renderTasks = function (projectId) {
    projectId = projectId || window.currentProjectId;
    if (!projectId) return;
    _renderListView(projectId);
    _renderKanban(projectId);
    window.renderTrash(projectId);
  };

  // ─── List view ────────────────────────────────────────────
  function _renderListView(projectId) {
    const container = document.getElementById('task-list');
    if (!container) return;
    _renderDisciplinePills(projectId);
    const tasks = _filteredTasks(projectId);
    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa fa-check-circle"></i>
          <p>No tasks yet. Add one above!</p>
        </div>`;
      return;
    }

    // Group by milestone if project has milestones
    const proj       = window.getProject ? window.getProject(projectId) : null;
    const milestones = (proj && proj.milestones && proj.milestones.length) ? proj.milestones : null;
    let html = '';
    if (milestones) {
      milestones.forEach(ms => {
        const msTasks = tasks.filter(t => t.milestone_id === ms.id);
        if (msTasks.length === 0) return;
        html += `<div class="task-milestone-header" style="--ms-color:${ms.color || '#6366f1'}">
          <span class="task-ms-dot" style="background:${ms.color || '#6366f1'}"></span>
          <span class="task-ms-label">${esc(ms.title)}</span>
          <span class="task-ms-count">${msTasks.length}</span>
        </div>`;
        html += msTasks.map(t => _taskRowHtml(t, projectId)).join('');
      });
      const unassigned = tasks.filter(t => !t.milestone_id);
      if (unassigned.length) {
        html += `<div class="task-milestone-header task-ms-unassigned">
          <span class="task-ms-dot" style="background:var(--text-muted)"></span>
          <span class="task-ms-label">No Milestone</span>
          <span class="task-ms-count">${unassigned.length}</span>
        </div>`;
        html += unassigned.map(t => _taskRowHtml(t, projectId)).join('');
      }
    } else {
      html = tasks.map(t => _taskRowHtml(t, projectId)).join('');
    }

    container.innerHTML = html;
    _bindTaskRowEvents(container, projectId);
  }

  function _taskRowHtml(t, projectId) {
    const pIcon    = PRIORITY_ICONS[t.priority] || PRIORITY_ICONS.medium;
    const isDone   = t.status === 'done';
    const subtasks = t.subtasks || [];
    const subDone  = subtasks.filter(s => s.done).length;
    const panelOpen = _openSubtaskPanels.has(t.id);

    return `
      <div class="task-item-wrap ${panelOpen ? 'subtasks-open' : ''}" data-task-id="${t.id}">
        <div class="task-row ${isDone ? 'task-done' : ''}" draggable="true" data-task-id="${t.id}">
          <button class="task-subtask-toggle" data-action="toggle-subtasks" data-task-id="${t.id}" title="Show / hide subtasks">
            <i class="fa fa-chevron-right task-subtask-arrow ${panelOpen ? 'open' : ''}"></i>
          </button>
          <button class="task-check-btn ${isDone ? 'checked' : ''}" data-action="toggle-done" data-task-id="${t.id}">
            <i class="fa ${isDone ? 'fa-circle-check' : 'fa-circle'}"></i>
          </button>
          <div class="task-row-body" data-action="open-detail" data-task-id="${t.id}">
            <span class="task-title">${t.discipline ? `<span class="task-disc-pfx" style="color:${(typeof window.getDiscColor==='function'?window.getDiscColor(t.discipline):'#8b5cf6')}">[${esc(_discAbbrev(t.discipline))}]</span> ` : ''}${esc(t.title)}</span>
            <div class="task-row-meta">
              <span class="badge badge-status-${t.status}">${STATUS_LABELS[t.status] || t.status}</span>
              <i class="fa ${pIcon} task-priority-icon" title="${t.priority}"></i>
              ${t.due_date ? `<span class="task-due ${_isOverdue(t) ? 'overdue' : ''}"><i class="fa fa-calendar-days"></i> ${_fmtDate(t.due_date)}</span>` : ''}
              <span class="task-subtask-progress ${subtasks.length ? '' : 'subtask-progress-empty'}" data-task-id="${t.id}">
                <i class="fa fa-list-check"></i> ${subDone}/${subtasks.length}
              </span>
              ${_getMilestoneChip(t, projectId)}
              ${_getDisciplineChip(t)}
              ${(t.tags||[]).map(g => `<span class="tag-chip">${esc(g)}</span>`).join('')}
              ${_getDependentChips(t, projectId)}
            </div>
          </div>
          <button class="task-pin-btn ${t.pinned ? 'pinned' : ''}" data-action="toggle-pin" data-task-id="${t.id}" title="${t.pinned ? 'Unpin task' : 'Pin task'}">
            <i class="fa fa-thumbtack"></i>
          </button>
        </div>
        <div class="task-inline-subtasks ${panelOpen ? 'open' : ''}" data-task-id="${t.id}">
          <div class="task-inline-subtask-list">
            ${_inlineSubtaskListHtml(subtasks)}
          </div>
          <div class="task-inline-subtask-add">
            <input class="inline-subtask-input" type="text" placeholder="Add a subtask…"
              data-task-id="${t.id}" data-project-id="${projectId}" />
            <button class="btn btn-ghost btn-sm inline-subtask-add-btn"
              data-action="inline-add-subtask" data-task-id="${t.id}" data-project-id="${projectId}"
              title="Add subtask">
              <i class="fa fa-plus"></i>
            </button>
          </div>
        </div>
      </div>`;
  }

  // ─── Milestone badge chip on task row ─────────────────────
  function _getMilestoneChip(task, projectId) {
    if (!task.milestone_id) return '';
    const proj = window.getProject ? window.getProject(projectId) : null;
    if (!proj || !proj.milestones) return '';
    const ms = proj.milestones.find(m => m.id === task.milestone_id);
    if (!ms) return '';
    return `<span class="task-milestone-chip" style="background:${esc(ms.color || '#6366f1')}20;color:${esc(ms.color || '#6366f1')};border-color:${esc(ms.color || '#6366f1')}40" title="Milestone: ${esc(ms.title)}">
      <i class="fa fa-flag"></i> ${esc(ms.title.length > 20 ? ms.title.slice(0, 20) + '…' : ms.title)}
    </span>`;
  }

  // ─── Discipline badge chip on task row ────────────────────
  function _getDisciplineChip(task) {
    if (!task.discipline) return '';
    const color = (typeof window.getDiscColor === 'function') ? window.getDiscColor(task.discipline) : '#8b5cf6';
    return `<span class="disc-chip" style="background:${color}18;color:${color};border:1px solid ${color}35" title="Discipline: ${esc(task.discipline)}">${esc(task.discipline)}</span>`;
  }

  // ─── Dependent task chips (tasks that depend on THIS task) ─
  function _getDependentChips(task, projectId) {
    const proj = window.getProject ? window.getProject(projectId) : null;
    if (!proj) return '';
    const dependents = (proj.tasks || []).filter(tt =>
      !tt.deleted && (tt.dependencies || []).some(d => d.taskId === task.id)
    );
    if (!dependents.length) return '';
    return dependents.map(dt =>
      `<button class="task-dep-out-chip" data-action="open-dep-task" data-dep-task-id="${dt.id}" data-proj-id="${projectId}" title="This task is required by: ${esc(dt.title)}">
        <i class="fa fa-arrow-right-long"></i> ${esc(dt.title.length > 18 ? dt.title.slice(0, 18) + '…' : dt.title)}
      </button>`
    ).join('');
  }

  // ─── Short discipline abbreviation for inline prefix ─────
  function _discAbbrev(disc) {
    if (!disc) return '';
    const d = disc.toLowerCase();
    if (d === 'gd' || d.includes('game') || d.includes('designer')) return 'GD';
    if (d === 'art' || d.includes('artist')) return 'Art';
    if (d === 'dev' || d.includes('devel')) return 'Dev';
    if (d === 'qa'  || d.includes('quality') || d.includes('test')) return 'QA';
    if (d.includes('prod')) return 'Prod';
    return disc.length > 5 ? disc.slice(0, 3).toUpperCase() : disc;
  }

  // ─── Discipline filter pills ──────────────────────────────
  function _renderDisciplinePills(projectId) {
    const container = document.getElementById('task-discipline-pills');
    if (!container) return;
    const allTasks = window.getActiveTasks ? window.getActiveTasks(projectId) : [];
    const used = [...new Set(allTasks.map(t => t.discipline).filter(Boolean))];
    if (used.length === 0) { container.innerHTML = ''; return; }
    const discColors = typeof window.getDiscColor === 'function' ? window.getDiscColor : () => '#6366f1';
    const pills = ['All', ...used].map(d => {
      const isAll    = d === 'All';
      const active   = isAll ? !_disciplineFilter : _disciplineFilter === d;
      const color    = isAll ? '#6366f1' : (typeof window.getDiscColor === 'function' ? window.getDiscColor(d) : '#6366f1');
      const bg       = active ? color : 'transparent';
      const col      = active ? '#fff' : 'var(--text-secondary)';
      return `<button class="dp-pill${active ? ' active' : ''}" data-disc="${d}" style="${active ? `background:${color};` : ''}">${d}</button>`;
    }).join('');
    container.innerHTML = pills;
    container.querySelectorAll('.dp-pill').forEach(btn => {
      btn.addEventListener('click', function () {
        _disciplineFilter = this.dataset.disc === 'All' ? null : this.dataset.disc;
        window.renderTasks(projectId);
      });
    });
  }

  function _inlineSubtaskListHtml(subtasks) {
    const PRIO_COLORS = { high:'#ef4444', medium:'#f97316', low:'#22c55e' };
    if (!subtasks || subtasks.length === 0) {
      return '<p class="inline-subtask-empty">No subtasks yet.</p>';
    }
    return subtasks.map(s => {
      const hasMeta = s.due_date || s.priority || s.assignee;
      return `
        <div class="inline-subtask-item ${s.done ? 'inline-subtask-done' : ''}" data-subtask-id="${s.id}" draggable="true">
          <span class="inline-subtask-drag-handle" title="Drag to reorder"><i class="fa fa-grip-vertical"></i></span>
          <input type="checkbox" class="inline-subtask-checkbox" data-subtask-id="${s.id}" ${s.done ? 'checked' : ''} />
          <div class="inline-subtask-body" data-action="edit-inline-subtask" data-subtask-id="${s.id}" title="Click to edit">
            <span class="inline-subtask-title">${esc(s.title)}</span>
            ${hasMeta ? `<div class="inline-st-meta">
              ${s.due_date ? `<span class="inline-st-chip"><i class="fa fa-calendar-days"></i> ${_fmtDate(s.due_date)}</span>` : ''}
              ${s.priority ? `<span class="inline-st-chip" style="color:${PRIO_COLORS[s.priority]||''}"><i class="fa fa-flag"></i> ${s.priority}</span>` : ''}
              ${s.assignee ? `<span class="inline-st-chip"><i class="fa fa-user"></i> ${esc(s.assignee)}</span>` : ''}
            </div>` : ''}
          </div>
          <button class="inline-subtask-delete-btn" data-action="inline-delete-subtask" data-subtask-id="${s.id}" title="Remove">
            <i class="fa fa-xmark"></i>
          </button>
        </div>`;
    }).join('');
  }

  // ─── Reorder subtasks (drag within inline list) ─────────
  function _reorderSubtasks(projId, taskId, fromId, toId) {
    const t = _getTask(projId, taskId);
    if (!t || fromId === toId) return;
    const subs = t.subtasks || [];
    const fromIdx = subs.findIndex(s => s.id === fromId);
    const toIdx   = subs.findIndex(s => s.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = subs.splice(fromIdx, 1);
    subs.splice(toIdx, 0, moved);
    t.subtasks = subs;
    t.updated_at = window.isoNow();
    _openSubtaskPanels.add(taskId);
    _touch(projId);
    window.renderTasks(projId);
  }

  // ─── Inline add-subtask helper ───────────────────────────
  function _addInlineSubtask(projId, taskId, inp) {
    if (!inp) return;
    const title = inp.value.trim();
    if (!title) return;
    const t = _getTask(projId, taskId);
    if (!t) return;
    t.subtasks = t.subtasks || [];
    t.subtasks.push({ id: window.uid('st'), title, done: false, created_at: window.isoNow() });
    t.updated_at = window.isoNow();
    _openSubtaskPanels.add(taskId);
    _touch(projId);
    window.renderTasks(projId);
  }

  function _bindTaskRowEvents(container, projectId) {
    // ── Toggle-subtasks arrow ──────────────────────────────
    container.querySelectorAll('[data-action="toggle-subtasks"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const tid = btn.dataset.taskId;
        if (_openSubtaskPanels.has(tid)) {
          _openSubtaskPanels.delete(tid);
        } else {
          _openSubtaskPanels.add(tid);
        }
        const wrap  = container.querySelector(`.task-item-wrap[data-task-id="${tid}"]`);
        const panel = container.querySelector(`.task-inline-subtasks[data-task-id="${tid}"]`);
        const arrow = btn.querySelector('.task-subtask-arrow');
        if (wrap)  wrap.classList.toggle('subtasks-open', _openSubtaskPanels.has(tid));
        if (panel) panel.classList.toggle('open', _openSubtaskPanels.has(tid));
        if (arrow) arrow.classList.toggle('open', _openSubtaskPanels.has(tid));
      });
    });

    // ── Inline add-subtask button ─────────────────────────
    container.querySelectorAll('[data-action="inline-add-subtask"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const inp = container.querySelector(`.inline-subtask-input[data-task-id="${btn.dataset.taskId}"]`);
        _addInlineSubtask(btn.dataset.projectId, btn.dataset.taskId, inp);
      });
    });

    // ── Inline subtask input: click (no bubble) + Enter ───
    container.querySelectorAll('.inline-subtask-input').forEach(inp => {
      inp.addEventListener('click', e => e.stopPropagation());
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          _addInlineSubtask(inp.dataset.projectId, inp.dataset.taskId, inp);
        }
      });
    });

    // ── Inline subtask checkbox ───────────────────────────
    container.querySelectorAll('.inline-subtask-checkbox').forEach(cb => {
      cb.addEventListener('change', e => {
        e.stopPropagation();
        const wrap = cb.closest('.task-item-wrap');
        const tid  = wrap ? wrap.dataset.taskId : null;
        if (!tid) return;
        const t   = _getTask(projectId, tid);
        if (!t) return;
        const sub = (t.subtasks || []).find(s => s.id === cb.dataset.subtaskId);
        if (!sub) return;
        sub.done = cb.checked;
        t.updated_at = window.isoNow();
        _openSubtaskPanels.add(tid);
        _touch(projectId);
        window.renderTasks(projectId);
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
      });
    });

    // ── Inline subtask drag-to-reorder ────────────────────
    let _stDragId = null;
    let _stTaskId = null;
    container.querySelectorAll('.inline-subtask-item').forEach(item => {
      item.addEventListener('dragstart', function (e) {
        e.stopPropagation();
        _stDragId = this.dataset.subtaskId;
        _stTaskId = this.closest('.task-item-wrap')?.dataset.taskId || null;
        this.classList.add('st-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', function () {
        this.classList.remove('st-dragging');
        container.querySelectorAll('.inline-subtask-item').forEach(el => el.classList.remove('st-drag-over'));
      });
      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (_stDragId && this.dataset.subtaskId !== _stDragId) {
          this.classList.add('st-drag-over');
        }
      });
      item.addEventListener('dragleave', function () {
        this.classList.remove('st-drag-over');
      });
      item.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('st-drag-over');
        const toId = this.dataset.subtaskId;
        const tid  = this.closest('.task-item-wrap')?.dataset.taskId || null;
        if (_stDragId && tid && _stTaskId === tid) {
          _reorderSubtasks(projectId, tid, _stDragId, toId);
        }
      });
    });

    // ── Inline subtask: click to edit ─────────────────────
    container.querySelectorAll('[data-action="edit-inline-subtask"]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const wrap = el.closest('.task-item-wrap');
        const tid  = wrap ? wrap.dataset.taskId : null;
        if (!tid || typeof window.openSubtaskModal !== 'function') return;
        window.openSubtaskModal(projectId, tid, el.dataset.subtaskId);
      });
    });

    // ── Inline subtask delete ─────────────────────────────
    container.querySelectorAll('[data-action="inline-delete-subtask"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const wrap = btn.closest('.task-item-wrap');
        const tid  = wrap ? wrap.dataset.taskId : null;
        if (!tid) return;
        const t = _getTask(projectId, tid);
        if (!t) return;
        t.subtasks = (t.subtasks || []).filter(s => s.id !== btn.dataset.subtaskId);
        t.updated_at = window.isoNow();
        _openSubtaskPanels.add(tid);
        _touch(projectId);
        window.renderTasks(projectId);
      });
    });

    // ── Toggle task pin ───────────────────────────────────
    container.querySelectorAll('[data-action="toggle-pin"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const t = _getTask(projectId, btn.dataset.taskId);
        if (!t) return;
        t.pinned = !t.pinned;
        t.updated_at = window.isoNow();
        _touch(projectId);
        window.renderTasks(projectId);
        if (typeof window.renderProjects  === 'function') window.renderProjects();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
      });
    });

    // ── Toggle task done ──────────────────────────────────
    container.querySelectorAll('[data-action="toggle-done"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const t = _getTask(projectId, btn.dataset.taskId);
        if (!t) return;
        if (typeof window.pushUndo === 'function') window.pushUndo(projectId);
        t.status = t.status === 'done' ? 'todo' : 'done';
        if (t.status === 'done') t.completed_at = window.isoNow();
        t.updated_at = window.isoNow();
        _touch(projectId);
        window.renderTasks(projectId);
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
        if (typeof window.refreshOpenMilestoneDetails === 'function') window.refreshOpenMilestoneDetails(projectId);
      });
    });

    // ── Open detail panel (content area click) ───────────
    container.querySelectorAll('[data-action="open-detail"]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation(); // prevent bubbling to .task-row empty-area handler
        if (typeof window.openDetailPanel === 'function')
          window.openDetailPanel(projectId, el.dataset.taskId);
      });
    });

    // ── Open dependent task chip ──────────────────────────
    container.querySelectorAll('[data-action="open-dep-task"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (typeof window.openDetailPanel === 'function')
          window.openDetailPanel(btn.dataset.projId, btn.dataset.depTaskId);
      });
    });

    // ── Delete task (soft) ────────────────────────────────
    container.querySelectorAll('[data-action="delete-task"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (typeof window.pushUndo === 'function') window.pushUndo(projectId);
        _softDelete(projectId, btn.dataset.taskId);
      });
    });

    // ── Empty area of task row → toggle subtasks ──────────
    // All interactive children call stopPropagation, so a click
    // that reaches .task-row means the user tapped the empty padding.
    container.querySelectorAll('.task-row').forEach(row => {
      row.addEventListener('click', function () {
        const tid = this.dataset.taskId;
        if (!tid) return;
        if (_openSubtaskPanels.has(tid)) {
          _openSubtaskPanels.delete(tid);
        } else {
          _openSubtaskPanels.add(tid);
        }
        const wrap  = this.closest('.task-item-wrap');
        const panel = wrap && wrap.querySelector(`.task-inline-subtasks[data-task-id="${tid}"]`);
        const arrow = this.querySelector('.task-subtask-arrow');
        if (wrap)  wrap.classList.toggle('subtasks-open', _openSubtaskPanels.has(tid));
        if (panel) panel.classList.toggle('open', _openSubtaskPanels.has(tid));
        if (arrow) arrow.classList.toggle('open', _openSubtaskPanels.has(tid));
      });
    });

    // ── Drag & drop for list reorder ──────────────────────
    container.querySelectorAll('.task-row').forEach(row => {
      row.addEventListener('dragstart', function () {
        _dragTaskId = this.dataset.taskId;
        _dragProjId = projectId;
        this.classList.add('dragging');
      });
      row.addEventListener('dragend', function () { this.classList.remove('dragging'); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); this.classList.add('drag-over'); });
      row.addEventListener('dragleave', function () { this.classList.remove('drag-over'); });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        if (_dragTaskId && _dragProjId === projectId) {
          _reorderTasks(projectId, _dragTaskId, this.dataset.taskId);
        }
      });
    });
  }

  // ─── Kanban board ─────────────────────────────────────────
  function _renderKanban(projectId) {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    const tasks = window.getActiveTasks(projectId);
    ['todo','in-progress','blocked','done'].forEach(status => {
      const cards = board.querySelector(`.kanban-cards[data-status="${status}"]`);
      const count = board.querySelector(`.kanban-col[data-status="${status}"] .kanban-col-count`);
      if (!cards) return;
      const filtered = tasks.filter(t => t.status === status);
      if (count) count.textContent = filtered.length;
      cards.innerHTML = filtered.map(t => {
        const overdue = _isOverdue(t);
        const abbr    = t.discipline ? _discAbbrev(t.discipline) : '';
        const dc      = t.discipline && typeof window.getDiscColor === 'function' ? window.getDiscColor(t.discipline) : '#8b5cf6';
        return `
          <div class="kanban-card ${overdue ? 'overdue' : ''}" data-task-id="${t.id}" draggable="true">
            <div class="kanban-card-title">${abbr ? `<span class="task-disc-pfx" style="color:${dc}">[${esc(abbr)}]</span> ` : ''}${esc(t.title)}</div>
            ${t.due_date ? `<div class="kanban-card-due ${overdue?'overdue':''}"><i class="fa fa-calendar-days"></i> ${_fmtDate(t.due_date)}</div>` : ''}
            <div class="kanban-card-footer">
              <i class="fa ${PRIORITY_ICONS[t.priority]||''}" title="${t.priority||''}"></i>
              ${(t.tags||[]).slice(0,2).map(g=>`<span class="tag-chip">${esc(g)}</span>`).join('')}
            </div>
          </div>`;
      }).join('');

      cards.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('click', () => {
          if (typeof window.openDetailPanel === 'function')
            window.openDetailPanel(projectId, card.dataset.taskId);
        });
        card.addEventListener('dragstart', function () {
          _dragTaskId = this.dataset.taskId;
          _dragProjId = projectId;
          this.classList.add('card-dragging');
        });
        card.addEventListener('dragend', function () { this.classList.remove('card-dragging'); });
      });

      // Drop zone for columns
      cards.addEventListener('dragover', e => { e.preventDefault(); cards.classList.add('kanban-drop-target'); });
      cards.addEventListener('dragleave', () => cards.classList.remove('kanban-drop-target'));
      cards.addEventListener('drop', function (e) {
        e.preventDefault();
        cards.classList.remove('kanban-drop-target');
        if (!_dragTaskId || _dragProjId !== projectId) return;
        const task = _getTask(projectId, _dragTaskId);
        if (task) {
          if (typeof window.pushUndo === 'function') window.pushUndo(projectId);
          task.status = status;
          task.updated_at = window.isoNow();
          if (status === 'done') task.completed_at = window.isoNow();
          _touch(projectId);
          _renderKanban(projectId);
          _renderListView(projectId);
          // Update detail panel if open
          if (window.currentTaskId === _dragTaskId && typeof window.refreshDetailPanel === 'function')
            window.refreshDetailPanel();
          if (typeof window.refreshOpenMilestoneDetails === 'function')
            window.refreshOpenMilestoneDetails(projectId);
        }
      });
    });
  }

  // ─── Trash tab ────────────────────────────────────────────
  window.renderTrash = function (projectId) {
    projectId = projectId || window.currentProjectId;
    const container = document.getElementById('trash-list');
    if (!container) return;
    const deleted = window.getDeletedTasks(projectId);
    if (deleted.length === 0) {
      container.innerHTML = '<p class="empty-state">Trash is empty.</p>';
      return;
    }
    container.innerHTML = deleted.map(t => `
      <div class="task-row trash-row" data-task-id="${t.id}">
        <span class="task-title text-muted">${esc(t.title)}</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" data-action="restore" data-task-id="${t.id}">
            <i class="fa fa-arrow-rotate-left"></i> Restore
          </button>
          <button class="btn btn-danger btn-sm" data-action="hard-delete" data-task-id="${t.id}">
            <i class="fa fa-trash"></i> Remove
          </button>
        </div>
      </div>`).join('');

    container.querySelectorAll('[data-action="restore"]').forEach(btn => {
      btn.addEventListener('click', () => _restoreTask(projectId, btn.dataset.taskId));
    });
    container.querySelectorAll('[data-action="hard-delete"]').forEach(btn => {
      btn.addEventListener('click', () => _hardDelete(projectId, btn.dataset.taskId));
    });
  };

  // Expose alias
  window.renderTrash = window.renderTrash;

  // ─── Quick-add task ───────────────────────────────────────
  window.showQuickAdd = function () {
    const bar = document.getElementById('quick-add-task');
    const inp = document.getElementById('quick-task-input');
    if (!bar || !inp) return;
    bar.classList.remove('hidden');
    inp.value = '';
    inp.focus();
  };

  window.hideQuickAdd = function () {
    const bar = document.getElementById('quick-add-task');
    if (bar) bar.classList.add('hidden');
  };

  // ─── Create task ──────────────────────────────────────────
  window.createTask = function (projectId, title, status) {
    projectId = projectId || window.currentProjectId;
    title = (title || '').trim();
    if (!title) return null;
    const proj = window.getProject(projectId);
    if (!proj) return null;
    const id = window.uid('task');
    const now = window.isoNow();
    const task = {
      id, title, description: '',
      status: status || 'todo',
      priority: 'medium',
      due_date: null,
      tags: [], subtasks: [], comments: [],
      assignee: null,
      created_at: now, updated_at: now,
      deleted: false
    };
    proj.tasks = proj.tasks || [];
    if (typeof window.pushUndo === 'function') window.pushUndo(projectId);
    proj.tasks.push(task);
    _touch(projectId);
    window.renderTasks(projectId);
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    return id;
  };

  // ─── Soft delete ──────────────────────────────────────────
  function _softDelete(projectId, taskId) {
    const t = _getTask(projectId, taskId);
    if (!t) return;
    t.deleted = true;
    t.updated_at = window.isoNow();
    _touch(projectId);
    window.renderTasks(projectId);
    if (window.currentTaskId === taskId && typeof window.closeDetailPanel === 'function')
      window.closeDetailPanel();
  }

  // Expose for detail panel delete button
  window.softDeleteTask = function (projectId, taskId) {
    if (typeof window.pushUndo === 'function') window.pushUndo(projectId);
    _softDelete(projectId, taskId);
  };

  function _restoreTask(projectId, taskId) {
    const t = _getTask(projectId, taskId);
    if (!t) return;
    if (typeof window.pushUndo === 'function') window.pushUndo(projectId);
    t.deleted = false;
    t.updated_at = window.isoNow();
    _touch(projectId);
    window.renderTrash(projectId);
    window.renderTasks(projectId);
  }

  function _hardDelete(projectId, taskId) {
    const proj = window.getProject(projectId);
    if (!proj) return;
    if (typeof window.pushUndo === 'function') window.pushUndo(projectId);
    proj.tasks = (proj.tasks || []).filter(t => t.id !== taskId);
    _touch(projectId);
    window.renderTrash(projectId);
  }

  // ─── Reorder tasks (drag in list view) ───────────────────
  function _reorderTasks(projectId, fromId, toId) {
    const proj = window.getProject(projectId);
    if (!proj || fromId === toId) return;
    const tasks = proj.tasks || [];
    const fromIdx = tasks.findIndex(t => t.id === fromId);
    const toIdx   = tasks.findIndex(t => t.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = tasks.splice(fromIdx, 1);
    tasks.splice(toIdx, 0, moved);
    proj.tasks = tasks;
    _touch(projectId);
    _renderListView(projectId);
  }

  // ─── Filtering ────────────────────────────────────────────
  function _filteredTasks(projectId) {
    let tasks = window.getActiveTasks(projectId);
    const search = (document.getElementById('task-search') || {}).value || '';
    const status = (document.getElementById('task-filter-status') || {}).value || 'all';
    const prio   = (document.getElementById('task-filter-priority') || {}).value || 'all';
    if (search)              tasks = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    if (status !== 'all')    tasks = tasks.filter(t => t.status === status);
    if (prio   !== 'all')    tasks = tasks.filter(t => t.priority === prio);
    if (!_showCompleted)     tasks = tasks.filter(t => t.status !== 'done');
    if (_disciplineFilter)   tasks = tasks.filter(t => t.discipline === _disciplineFilter);
    return tasks;
  }

  window.toggleShowCompleted = function () {
    _showCompleted = !_showCompleted;
    const btn = document.getElementById('btn-toggle-completed');
    if (btn) btn.classList.toggle('active-view-btn', _showCompleted);
    window.renderTasks(window.currentProjectId);
  };

  // ─── View toggle ──────────────────────────────────────────
  window.setTaskView = function (view) {
    const listView   = document.getElementById('task-list-view');
    const kanbanView = document.getElementById('task-kanban-view');
    const btnList    = document.getElementById('btn-view-list');
    const btnKanban  = document.getElementById('btn-view-kanban');
    if (!listView || !kanbanView) return;
    if (view === 'kanban') {
      listView.classList.add('hidden');
      kanbanView.classList.remove('hidden');
      if (btnList)   btnList.classList.remove('active-view-btn');
      if (btnKanban) btnKanban.classList.add('active-view-btn');
    } else {
      kanbanView.classList.add('hidden');
      listView.classList.remove('hidden');
      if (btnKanban) btnKanban.classList.remove('active-view-btn');
      if (btnList)   btnList.classList.add('active-view-btn');
    }
  };

  // ─── Helpers ─────────────────────────────────────────────
  function _getTask(projectId, taskId) {
    const proj = window.getProject(projectId);
    return proj ? (proj.tasks || []).find(t => t.id === taskId) || null : null;
  }

  function _touch(projectId) {
    const proj = window.getProject(projectId);
    if (proj) { proj.updated_at = window.isoNow(); window.saveData(); }
  }

  function _isOverdue(t) {
    if (!t.due_date || t.status === 'done') return false;
    return new Date(t.due_date) < new Date();
  }

  function _fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  }

  // Reset discipline filter when switching projects
  window.resetDisciplineFilter = function () {
    _disciplineFilter = null;
    if (typeof window.refreshUndoButtons === 'function') window.refreshUndoButtons();
  };

  // Exposed for other modules
  window.getTaskById  = function (projectId, taskId) { return _getTask(projectId, taskId); };
  window.touchProject = _touch;
  window.isOverdue    = _isOverdue;
  window.fmtDate      = _fmtDate;
})();
