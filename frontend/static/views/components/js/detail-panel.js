// ============================================================
// detail-panel.js — Right-side task detail panel
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  let _autoSaveTimer = null;

  // ─── Open detail panel ────────────────────────────────────
  window.openDetailPanel = function (projectId, taskId) {
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;
    window.currentTaskId = taskId;

    const panel = document.getElementById('detail-panel');
    const main  = document.getElementById('main-content');
    if (panel) panel.classList.remove('hidden');
    if (panel) panel.classList.add('open');
    if (main)  main.classList.add('panel-open');

    const backdrop = document.getElementById('panel-backdrop');
    if (backdrop) backdrop.classList.remove('hidden');

    _renderPanelDetails(projectId, taskId);
    _showDPTab('details');
  };

  // ─── Close detail panel ───────────────────────────────────
  window.closeDetailPanel = function () {
    const panel = document.getElementById('detail-panel');
    const main  = document.getElementById('main-content');
    if (panel) { panel.classList.add('hidden'); panel.classList.remove('open'); }
    if (main)  main.classList.remove('panel-open');
    const backdrop = document.getElementById('panel-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
    window.currentTaskId = null;
    clearTimeout(_autoSaveTimer);
  };

  // ─── Refresh panel (called after data change) ─────────────
  window.refreshDetailPanel = function () {
    if (!window.currentTaskId || !window.currentProjectId) return;
    _renderPanelDetails(window.currentProjectId, window.currentTaskId);
  };

  // ─── Render panel content ─────────────────────────────────
  function _renderPanelDetails(projectId, taskId) {
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;

    // Title
    const titleEl = document.getElementById('dp-task-title');
    if (titleEl) titleEl.value = task.title || '';

    // Description
    const descEl = document.getElementById('dp-task-description');
    if (descEl) descEl.value = task.description || '';

    // Status
    const statusEl = document.getElementById('dp-status');
    if (statusEl) statusEl.value = task.status || 'todo';

    // Priority
    const prioEl = document.getElementById('dp-priority');
    if (prioEl) prioEl.value = task.priority || 'medium';

    // Due date
    const dueEl = document.getElementById('dp-due-date');
    if (dueEl) dueEl.value = task.due_date || '';

    // Workdays needed
    const wdEl   = document.getElementById('dp-workdays');
    const wdUnit = document.getElementById('dp-workdays-unit');
    if (wdEl && wdUnit) {
      const wd = task.workdays_needed;
      if (wd != null && wd.unit === 'weeks') {
        wdUnit.value = 'weeks';
        wdEl.value   = wd.value != null ? wd.value : '';
      } else {
        wdUnit.value = 'days';
        wdEl.value   = (wd != null && wd.value != null) ? wd.value : '';
      }
    }

    // Assignee — populate with all known users
    const assigneeEl = document.getElementById('dp-assignee');
    if (assigneeEl) {
      _populateAssigneeSelect(assigneeEl, task.assignee);
    }

    // Milestone — populate from project
    const msEl = document.getElementById('dp-milestone');
    if (msEl) {
      const proj = window.getProject ? window.getProject(projectId) : null;
      const milestones = (proj && proj.milestones) ? proj.milestones : [];
      msEl.innerHTML = '<option value="">None</option>' +
        milestones.map(ms => `<option value="${ms.id}"${task.milestone_id === ms.id ? ' selected' : ''}>${ms.title}</option>`).join('');
    }

    // Discipline — populate from project disciplines
    const discEl = document.getElementById('dp-discipline');
    if (discEl) {
      const proj = window.getProject ? window.getProject(projectId) : null;
      const DEFAULT_DISCS = (typeof window.DEFAULT_DISCIPLINES !== 'undefined') ? window.DEFAULT_DISCIPLINES : ['GD','Art','Dev','QA','Production'];
      const disciplines = (proj && proj.disciplines && proj.disciplines.length) ? proj.disciplines : DEFAULT_DISCS;
      discEl.innerHTML = '<option value="">Unassigned</option>' +
        disciplines.map(d => `<option value="${d}"${task.discipline === d ? ' selected' : ''}>${d}</option>`).join('');
    }

    // Tags
    _renderTags(task);

    // Dependencies
    _renderDeps(projectId, taskId);

    // Subtasks
    if (typeof window.renderSubtasks === 'function')
      window.renderSubtasks(projectId, taskId);

    // Comments
    _renderComments(task);

    // Bind auto-save
    _bindAutoSave(projectId, taskId);

    // Delete task button (bottom of panel)
    const delBtn = document.getElementById('btn-dp-delete-task');
    if (delBtn) {
      const newDelBtn = delBtn.cloneNode(true);
      delBtn.parentNode.replaceChild(newDelBtn, delBtn);
      newDelBtn.addEventListener('click', function () {
        if (typeof window.softDeleteTask === 'function')
          window.softDeleteTask(projectId, taskId);
      });
    }
  }

  // ─── Tags ─────────────────────────────────────────────────
  function _renderTags(task) {
    const container = document.getElementById('dp-tags');
    if (!container) return;
    const tags = task.tags || [];
    container.innerHTML = tags.map(g => `
      <span class="tag-chip tag-chip-editable">
        ${esc(g)}
        <button class="tag-remove" data-tag="${esc(g)}" title="Remove tag">×</button>
      </span>
    `).join('') + `
      <input id="dp-tag-input" type="text" class="input-tag-inline" placeholder="Add tag…" />`;

    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', function () {
        const projectId = window.currentProjectId;
        const taskId    = window.currentTaskId;
        const t = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
        if (!t) return;
        t.tags = (t.tags || []).filter(g => g !== this.dataset.tag);
        t.updated_at = window.isoNow();
        window.touchProject(projectId);
        _renderTags(t);
      });
    });

    const tagInput = document.getElementById('dp-tag-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const val = this.value.trim().replace(',','');
          if (!val) return;
          const projectId = window.currentProjectId;
          const taskId    = window.currentTaskId;
          const t = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
          if (!t) return;
          t.tags = t.tags || [];
          if (!t.tags.includes(val)) t.tags.push(val);
          t.updated_at = window.isoNow();
          window.touchProject(projectId);
          _renderTags(t);
          window.renderTasks(projectId);
        }
      });
    }
  }

  // ─── Comments ─────────────────────────────────────────────
  function _renderComments(task) {
    const container = document.getElementById('dp-comments');
    if (!container) return;
    const comments = task.comments || [];
    if (comments.length === 0) {
      container.innerHTML = '<p style="font-size:var(--font-size-xs);color:var(--text-muted)">No comments yet.</p>';
      return;
    }
    container.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-author">${esc(c.author || 'Me')}</div>
        <div class="comment-text">${esc(c.text)}</div>
        <div class="comment-time">${_fmtTime(c.created_at)}</div>
      </div>`).join('');
  }

  window.addComment = function () {
    const inp       = document.getElementById('dp-comment-input');
    const projectId = window.currentProjectId;
    const taskId    = window.currentTaskId;
    if (!inp || !projectId || !taskId) return;
    const text = inp.value.trim();
    if (!text) return;
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;
    task.comments = task.comments || [];
    task.comments.push({
      id: window.uid('cmt'),
      text,
      author: window.appData.currentUser ? window.appData.currentUser.name : 'Me',
      created_at: window.isoNow()
    });
    task.updated_at = window.isoNow();
    window.touchProject(projectId);
    inp.value = '';
    _renderComments(task);
  };

  // ─── Auto-save on field change ────────────────────────────
  function _bindAutoSave(projectId, taskId) {
    const fields = ['dp-task-title','dp-task-description','dp-status','dp-priority','dp-due-date','dp-workdays','dp-workdays-unit','dp-assignee','dp-milestone','dp-discipline'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      // Remove previous listener by cloning
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      const newEl = document.getElementById(id);
      const event = newEl.tagName === 'SELECT' ? 'change' : 'input';
      newEl.addEventListener(event, function () {
        clearTimeout(_autoSaveTimer);
        _autoSaveTimer = setTimeout(() => _saveFields(projectId, taskId), 400);
      });
    });
  }

  function _saveFields(projectId, taskId) {
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;
    const get = id => { const el = document.getElementById(id); return el ? el.value : null; };
    task.title       = get('dp-task-title')       || task.title;
    task.description = get('dp-task-description') || '';
    task.status      = get('dp-status')           || task.status;
    task.priority    = get('dp-priority')         || task.priority;
    task.due_date    = get('dp-due-date')         || null;
    const wdVal  = parseFloat(get('dp-workdays'));
    const wdUnit = get('dp-workdays-unit') || 'days';
    task.workdays_needed = (!isNaN(wdVal) && wdVal > 0) ? { value: wdVal, unit: wdUnit } : null;
    const assignee   = get('dp-assignee');
    task.assignee    = assignee || null;
    const msVal      = get('dp-milestone');
    task.milestone_id = msVal || null;
    const discVal    = get('dp-discipline');
    task.discipline  = discVal || null;
    task.updated_at  = window.isoNow();
    window.touchProject(projectId);
    window.renderTasks(projectId);
    if (typeof window.refreshOpenMilestoneDetails === 'function')
      window.refreshOpenMilestoneDetails(projectId);
  }

  // ─── Tab switching ────────────────────────────────────────
  window.switchDPTab = _showDPTab;
  function _showDPTab(tab) {
    document.querySelectorAll('.dp-tab').forEach(b => b.classList.toggle('active', b.dataset.dptab === tab));
    document.querySelectorAll('.dp-tab-content').forEach(c => c.classList.add('hidden'));
    const pane = document.getElementById('dp-tab-' + tab);
    if (pane) pane.classList.remove('hidden');
    if (tab === 'ai') {
      const answerEl = document.getElementById('ai-panel-answer');
      if (answerEl && !answerEl.innerHTML) {
        answerEl.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">Use the buttons below to get AI assistance.</p>';
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────
  let _cachedUsers = null;

  function _populateAssigneeSelect(selectEl, currentAssigneeId) {
    const buildOptions = (users) => {
      selectEl.innerHTML = '<option value="">Unassigned</option>' +
        users.map(u => `<option value="${u.id}"${u.id === currentAssigneeId ? ' selected' : ''}>${u.name}</option>`).join('');
    };
    if (_cachedUsers) {
      buildOptions(_cachedUsers);
      return;
    }
    // Seed with current user immediately, then fetch all
    const cur = window.appData.currentUser;
    if (cur) {
      buildOptions([cur]);
      if (cur.id === currentAssigneeId) selectEl.value = cur.id;
    }
    fetch('/api/users')
      .then(r => r.json())
      .then(data => {
        _cachedUsers = Array.isArray(data) ? data : (data.users || []);
        if (typeof window.tlSetUsersCache === 'function') window.tlSetUsersCache(_cachedUsers);
        // Re-build if the select is still in the DOM
        if (document.body.contains(selectEl)) buildOptions(_cachedUsers);
      })
      .catch(() => {});
  }

  function _fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  // ─── Dependencies ─────────────────────────────────────────
  function _renderDeps(projectId, taskId) {
    const container = document.getElementById('dp-deps');
    if (!container) return;
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;
    const deps = task.dependencies || [];

    // Build search datalist from all active tasks in this project
    const allTasks = window.getActiveTasks ? window.getActiveTasks(projectId) : [];
    const otherTasks = allTasks.filter(t => t.id !== taskId);

    container.innerHTML = `
      <div class="dep-chips">
        ${deps.length === 0
          ? '<span style="color:var(--text-muted);font-size:var(--font-size-xs);font-style:italic">None</span>'
          : deps.map(dep => {
              const linked = dep.taskId ? otherTasks.find(t => t.id === dep.taskId) : null;
              const label  = linked ? esc(linked.title) : esc(dep.title);
              const isLinked = !!linked;
              return `<span class="dep-chip${isLinked ? '' : ' dep-chip-text'}" data-dep-id="${dep.id}">
                ${isLinked ? '<i class="fa fa-link"></i>' : '<i class="fa fa-minus"></i>'}
                ${label}
                <button class="dep-chip-rm" data-dep-id="${dep.id}" title="Remove">×</button>
              </span>`;
            }).join('')
        }
      </div>
      <div class="dep-add-row">
        <input id="dp-dep-input" list="dep-task-list" class="input-sm" placeholder="Search task or type description…" />
        <datalist id="dep-task-list">
          ${otherTasks.map(t => `<option value="${esc(t.title)}" data-id="${t.id}"></option>`).join('')}
        </datalist>
        <button id="btn-add-dep" class="btn btn-ghost btn-sm"><i class="fa fa-plus"></i></button>
      </div>`;

    // Remove dep buttons
    container.querySelectorAll('.dep-chip-rm').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.removeDependency(projectId, taskId, this.dataset.depId);
      });
    });

    // Add dep button
    const addBtn = document.getElementById('btn-add-dep');
    if (addBtn) {
      const _doAdd = () => {
        const inp  = document.getElementById('dp-dep-input');
        if (!inp || !inp.value.trim()) return;
        const text = inp.value.trim();
        // Try to match an existing task by title
        const matched = otherTasks.find(t => t.title.toLowerCase() === text.toLowerCase());
        window.addDependency(projectId, taskId, text, matched ? matched.id : null);
        inp.value = '';
      };
      addBtn.addEventListener('click', _doAdd);
      const inp = document.getElementById('dp-dep-input');
      if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _doAdd(); } });
    }
  }

  window.addDependency = function (projectId, taskId, title, linkedTaskId) {
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task || !title) return;
    task.dependencies = task.dependencies || [];
    // Prevent duplicate task links
    if (linkedTaskId && task.dependencies.some(d => d.taskId === linkedTaskId)) return;
    task.dependencies.push({
      id: window.uid('dep'), title, taskId: linkedTaskId || null, projectId
    });
    task.updated_at = window.isoNow();
    window.touchProject(projectId);
    _renderDeps(projectId, taskId);
  };

  window.removeDependency = function (projectId, taskId, depId) {
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;
    task.dependencies = (task.dependencies || []).filter(d => d.id !== depId);
    task.updated_at = window.isoNow();
    window.touchProject(projectId);
    _renderDeps(projectId, taskId);
  };
})();
