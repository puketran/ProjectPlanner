// ============================================================
// projects.js — Project list, CRUD, open project
// ============================================================
(function () {
  'use strict';

  const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#ef4444',
                  '#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];
  const ICONS  = ['📁','🚀','💡','🎯','📊','🔧','🎨','💼','🌿','⚡','🔬','📝'];

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Render project list ──────────────────────────────────
  window.renderProjects = function (statusFilter) {
    statusFilter = statusFilter ||
      (document.getElementById('project-filter-status') || {}).value || 'active';
    const container = document.getElementById('project-list');
    if (!container) return;

    const projects = window.getUserProjects(statusFilter)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.updated_at || '') > (a.updated_at || '') ? 1 : -1;
      });

    if (projects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa fa-folder-open"></i>
          <p>No ${statusFilter === 'archived' ? 'archived' : 'active'} projects.</p>
          ${statusFilter === 'active'
            ? '<button class="btn btn-primary" onclick="window.showCreateProjectModal()"><i class="fa fa-plus"></i> New Project</button>'
            : ''}
        </div>`;
      return;
    }

    container.innerHTML = `<div class="projects-grid">${projects.map(p => {
      const tasks  = (p.tasks || []).filter(t => !t.deleted);
      const done   = tasks.filter(t => t.status === 'done').length;
      const total  = tasks.length;
      const pct    = total > 0 ? Math.round(done / total * 100) : 0;
      const pinned = tasks.filter(t => t.pinned && t.status !== 'done');
      return `
        <div class="project-card-group">
          <div class="project-card" data-project-id="${p.id}" style="--project-color:${esc(p.color||'#6366f1')}">
            <div class="project-card-stripe"></div>
            <div class="project-card-body">
              <div class="project-card-top">
                <span class="project-icon">${p.icon || '📁'}</span>
                <div class="project-card-actions">
                  <button class="icon-btn project-pin-btn ${p.pinned ? 'pinned' : ''}" data-project-id="${p.id}" title="${p.pinned ? 'Unpin project' : 'Pin project'}">
                    <i class="fa fa-thumbtack"></i>
                  </button>
                  <button class="icon-btn project-menu-btn" data-project-id="${p.id}">
                    <i class="fa fa-ellipsis-vertical"></i>
                  </button>
                </div>
              </div>
              <h3 class="project-card-name">${esc(p.name)}</h3>
              <p class="project-card-desc">${esc(p.description || '')}</p>
              <div class="project-progress-track">
                <div class="project-progress-fill" style="width:${pct}%"></div>
              </div>
              <div class="project-card-meta">
                <span><i class="fa fa-check-square"></i> ${done}/${total}</span>
                <span class="badge badge-${p.status||'active'}">${p.status||'active'}</span>
              </div>
            </div>
          </div>
          ${pinned.length ? `
            <div class="project-pinned-tasks" data-project-id="${p.id}" style="--project-color:${esc(p.color||'#6366f1')}">
              <div class="project-pinned-header"><i class="fa fa-thumbtack"></i> Pinned</div>
              ${pinned.slice(0, 3).map(t => `
                <div class="project-pinned-task-row" data-task-id="${t.id}" data-project-id="${p.id}">
                  <span class="badge badge-status-${t.status}"></span>
                  <span class="project-pinned-task-name">${esc(t.title)}</span>
                </div>`).join('')}
            </div>` : ''}
        </div>`;
    }).join('')}</div>`;

    container.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.project-menu-btn')) return;
        window.openProject(this.dataset.projectId);
      });
    });
    container.querySelectorAll('.project-menu-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        _showProjectMenu(this.dataset.projectId, this);
      });
    });
    container.querySelectorAll('.project-pin-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const p = window.getProject(this.dataset.projectId);
        if (!p) return;
        p.pinned = !p.pinned;
        p.updated_at = window.isoNow();
        window.saveData();
        window.renderProjects();
        if (typeof window.renderDashboard === 'function') window.renderDashboard();
        if (typeof window.renderSidebarProjects === 'function') window.renderSidebarProjects();
      });
    });
    container.querySelectorAll('.project-pinned-task-row').forEach(row => {
      row.addEventListener('click', e => {
        e.stopPropagation();
        const pid = row.dataset.projectId;
        const tid = row.dataset.taskId;
        window.openProject(pid);
        setTimeout(() => {
          if (typeof window.openDetailPanel === 'function') window.openDetailPanel(pid, tid);
        }, 50);
      });
    });
  };

  // ─── Project context menu ─────────────────────────────────
  function _showProjectMenu(projectId, anchor) {
    document.querySelectorAll('.project-dropdown').forEach(el => el.remove());
    const proj = window.getProject(projectId);
    if (!proj) return;
    const isArchived = proj.status === 'archived';
    const menu = document.createElement('div');
    menu.className = 'project-dropdown';
    menu.innerHTML = `
      <button class="dropdown-item" data-a="rename"><i class="fa fa-pen"></i> Rename</button>
      <button class="dropdown-item" data-a="editinfo"><i class="fa fa-calendar-days"></i> Edit Dates &amp; Info</button>
      <button class="dropdown-item" data-a="duplicate"><i class="fa fa-copy"></i> Duplicate</button>
      <button class="dropdown-item" data-a="export"><i class="fa fa-download"></i> Export JSON</button>
      <button class="dropdown-item" data-a="${isArchived ? 'unarchive' : 'archive'}">
        <i class="fa fa-box-archive"></i> ${isArchived ? 'Unarchive' : 'Archive'}
      </button>
      <button class="dropdown-item text-danger" data-a="delete"><i class="fa fa-trash"></i> Delete</button>`;
    const rect = anchor.getBoundingClientRect();
    Object.assign(menu.style, { position:'fixed', top: rect.bottom+4+'px',
      left: Math.min(rect.left, window.innerWidth-180)+'px', zIndex:'300' });
    document.body.appendChild(menu);

    menu.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-a]');
      if (!btn) return;
      menu.remove();
      const a = btn.dataset.a;
      if (a === 'rename')    _renameProject(projectId);
      else if (a === 'editinfo')  _editProjectInfo(projectId);
      else if (a === 'duplicate') _duplicateProject(projectId);
      else if (a === 'export')    _exportProject(projectId);
      else if (a === 'archive')   _setStatus(projectId, 'archived');
      else if (a === 'unarchive') _setStatus(projectId, 'active');
      else if (a === 'delete')    _confirmDelete(projectId);
    });
    const close = e => {
      if (!menu.contains(e.target) && !anchor.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', close, true);
      }
    };
    setTimeout(() => document.addEventListener('click', close, true), 10);
  }

  // ─── Create project modal ─────────────────────────────────
  window.showCreateProjectModal = function () {
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-folder-plus"></i> New Project</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input id="cp-name" type="text" class="form-input" placeholder="My Awesome Project" />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="cp-desc" class="form-textarea" placeholder="What is this project about?"></textarea>
        </div>
        <div class="form-group-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input id="cp-start" type="date" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input id="cp-end" type="date" class="form-input" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-picker-row" id="cp-colors">
            ${COLORS.map((c,i) => `<div class="color-swatch${i===0?' selected':''}" data-c="${c}" style="background:${c}" tabindex="0"></div>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Icon</label>
          <div class="icon-picker-row" id="cp-icons">
            ${ICONS.map((ic,i) => `<div class="icon-option${i===0?' selected':''}" data-ic="${ic}">${ic}</div>`).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="cp-confirm-btn">Create</button>
      </div>
    `);

    let selColor = COLORS[0], selIcon = ICONS[0];
    document.querySelectorAll('#cp-colors .color-swatch').forEach(sw => {
      sw.addEventListener('click', function () {
        document.querySelectorAll('#cp-colors .color-swatch').forEach(s => s.classList.remove('selected'));
        this.classList.add('selected');
        selColor = this.dataset.c;
      });
    });
    document.querySelectorAll('#cp-icons .icon-option').forEach(opt => {
      opt.addEventListener('click', function () {
        document.querySelectorAll('#cp-icons .icon-option').forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        selIcon = this.dataset.ic;
      });
    });

    const nameInput = document.getElementById('cp-name');
    nameInput.focus();
    const doCreate = () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.style.borderColor = 'var(--color-danger)'; return; }
      const desc  = document.getElementById('cp-desc').value.trim();
      const start = document.getElementById('cp-start').value || null;
      const end   = document.getElementById('cp-end').value   || null;
      _createProject(name, desc, selColor, selIcon, start, end);
      window.closeModal();
    };
    document.getElementById('cp-confirm-btn').onclick = doCreate;
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doCreate(); });
  };

  function _createProject(name, description, color, icon, startDate, endDate) {
    const id = window.uid('proj');
    const now = window.isoNow();
    const proj = {
      id, name, description: description || '',
      color: color || '#6366f1', icon: icon || '📁',
      start_date: startDate || null, end_date: endDate || null,
      milestones: [],
      disciplines: ['GD', 'Art', 'Dev', 'QA', 'Production'],
      user_id: window.appData.currentUser.id,
      status: 'active', created_at: now, updated_at: now,
      tasks: [], notes: []
    };
    window.appData.projects[id] = proj;
    window.saveData();
    window.openProject(id);
    if (typeof window.renderSidebarProjects === 'function') window.renderSidebarProjects();
  }

  // ─── Open project detail ──────────────────────────────────
  window.openProject = function (projectId) {
    const proj = window.getProject(projectId);
    if (!proj) return;
    window.currentProjectId = projectId;

    const nameEl = document.getElementById('project-detail-name');
    const iconEl = document.getElementById('project-detail-icon');
    if (nameEl) nameEl.textContent = proj.name;
    if (iconEl) { iconEl.textContent = proj.icon || '📁'; iconEl.style.color = proj.color || ''; }

    const bc = document.getElementById('header-breadcrumb');
    if (bc) bc.innerHTML = `<span>/</span><span>${esc(proj.name)}</span>`;

    window.switchView('project-detail');
    _switchProjectTab('team-board');
    if (typeof window.resetDisciplineFilter === 'function') window.resetDisciplineFilter();
    if (typeof window.refreshUndoButtons === 'function') window.refreshUndoButtons();
  };

  // ─── Project tab switching ────────────────────────────────
  window.switchProjectTab = _switchProjectTab;
  function _switchProjectTab(tab) {
    document.querySelectorAll('.project-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.project-tab-pane').forEach(p => p.classList.add('hidden'));
    const pane = document.getElementById('project-tab-' + tab);
    if (pane) pane.classList.remove('hidden');
    if (tab === 'tasks' && typeof window.renderTasks === 'function')
      window.renderTasks(window.currentProjectId);
    if (tab === 'notes' && typeof window.renderNotes === 'function')
      window.renderNotes(window.currentProjectId);
    if (tab === 'trash' && typeof window.renderTrash === 'function')
      window.renderTrash(window.currentProjectId);
    if (tab === 'milestones' && typeof window.renderMilestones === 'function')
      window.renderMilestones(window.currentProjectId);
    if (tab === 'team-board' && typeof window.renderTeamBoard === 'function')
      window.renderTeamBoard(window.currentProjectId);
  }

  // ─── Helpers ─────────────────────────────────────────────
  function _setStatus(projectId, status) {
    const p = window.getProject(projectId);
    if (!p) return;
    p.status = status;
    p.updated_at = window.isoNow();
    window.saveData();
    window.renderProjects();
    if (typeof window.renderSidebarProjects === 'function') window.renderSidebarProjects();
  }

  function _renameProject(projectId) {
    const p = window.getProject(projectId);
    if (!p) return;
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title">Rename Project</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Project Name</label>
          <input id="rn-input" type="text" class="form-input" value="${esc(p.name)}" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="rn-confirm-btn">Rename</button>
      </div>
    `);
    const inp = document.getElementById('rn-input');
    inp.select();
    const doRename = () => {
      const name = inp.value.trim();
      if (!name) return;
      p.name = name;
      p.updated_at = window.isoNow();
      window.saveData();
      window.closeModal();
      window.renderProjects();
      if (typeof window.renderSidebarProjects === 'function') window.renderSidebarProjects();
    };
    document.getElementById('rn-confirm-btn').onclick = doRename;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doRename(); });
  }

  function _editProjectInfo(projectId) {
    const p = window.getProject(projectId);
    if (!p) return;
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-calendar-days"></i> Edit Project Info</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="ei-desc" class="form-textarea" rows="2">${esc(p.description || '')}</textarea>
        </div>
        <div class="form-group-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input id="ei-start" type="date" class="form-input" value="${p.start_date || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input id="ei-end" type="date" class="form-input" value="${p.end_date || ''}" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="ei-save-btn">Save</button>
      </div>
    `);
    document.getElementById('ei-save-btn').onclick = () => {
      p.description = document.getElementById('ei-desc').value.trim();
      p.start_date  = document.getElementById('ei-start').value || null;
      p.end_date    = document.getElementById('ei-end').value   || null;
      p.updated_at  = window.isoNow();
      window.saveData();
      window.closeModal();
      window.renderProjects();
    };
  }


  function _duplicateProject(projectId) {
    const p = window.getProject(projectId);
    if (!p) return;
    const newId = window.uid('proj');
    const now = window.isoNow();
    const copy = JSON.parse(JSON.stringify(p));
    copy.id = newId;
    copy.name = p.name + ' (copy)';
    copy.created_at = now;
    copy.updated_at = now;
    copy.tasks = (copy.tasks || []).map(t => ({ ...t, id: window.uid('task') }));
    copy.notes = (copy.notes || []).map(n => ({ ...n, id: window.uid('note') }));
    window.appData.projects[newId] = copy;
    window.saveData();
    window.renderProjects();
    if (typeof window.renderSidebarProjects === 'function') window.renderSidebarProjects();
  }

  function _exportProject(projectId) {
    const p = window.getProject(projectId);
    if (!p) return;
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: (p.name || 'project') + '.json' });
    a.click();
    URL.revokeObjectURL(url);
  }

  function _confirmDelete(projectId) {
    const p = window.getProject(projectId);
    if (!p) return;
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title">Delete Project</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="confirm-modal-icon"><i class="fa fa-triangle-exclamation"></i></div>
        <p class="confirm-modal-text">Delete "<strong>${esc(p.name)}</strong>"? All tasks and notes will be lost permanently.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="del-proj-ok">Delete</button>
      </div>
    `);
    document.getElementById('del-proj-ok').onclick = function () {
      delete window.appData.projects[projectId];
      window.saveData();
      window.closeModal();
      window.switchView('projects');
      window.renderProjects();
      if (typeof window.renderSidebarProjects === 'function') window.renderSidebarProjects();
    };
  }

  // Exposed for header buttons
  window.archiveCurrentProject = () => _setStatus(window.currentProjectId, 'archived');
  window.deleteCurrentProject   = () => _confirmDelete(window.currentProjectId);
  window.exportCurrentProject   = () => _exportProject(window.currentProjectId);

  // Import project from JSON file
  window.importProject = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        let data;
        try {
          data = JSON.parse(e.target.result);
        } catch (_) {
          _importError('Could not parse the file. Make sure it is a valid JSON project export.');
          return;
        }
        if (!data || typeof data !== 'object' || !data.id || !data.name) {
          _importError('This file does not appear to be a valid project export (missing id or name).');
          return;
        }
        _showImportPreview(data);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  function _importError(msg) {
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-triangle-exclamation"></i> Import Failed</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--color-danger)">${esc(msg)}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="window.closeModal()">OK</button>
      </div>
    `);
  }

  function _showImportPreview(data) {
    const tasks      = (data.tasks || []).filter(t => !t.deleted);
    const milestones = (data.milestones || []);
    const notes      = (data.notes || []);
    const duplicate  = !!window.appData.projects[data.id];

    const dupWarning = duplicate ? `
      <div class="import-preview-warning">
        <i class="fa fa-triangle-exclamation"></i>
        A project with this ID already exists in your workspace.
        Choose how to handle it below.
      </div>` : '';

    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-file-import"></i> Import Project</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        ${dupWarning}
        <div class="import-preview-card">
          <div class="import-preview-icon">${data.icon || '📁'}</div>
          <div class="import-preview-info">
            <div class="import-preview-name">${esc(data.name)}</div>
            ${data.description ? `<div class="import-preview-desc">${esc(data.description)}</div>` : ''}
            <div class="import-preview-meta">
              <span><i class="fa fa-check-square"></i> ${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
              <span><i class="fa fa-flag"></i> ${milestones.length} milestone${milestones.length !== 1 ? 's' : ''}</span>
              <span><i class="fa fa-note-sticky"></i> ${notes.length} note${notes.length !== 1 ? 's' : ''}</span>
            </div>
            ${data.start_date || data.end_date ? `
              <div class="import-preview-dates">
                ${data.start_date ? `<span><i class="fa fa-calendar"></i> ${data.start_date}</span>` : ''}
                ${data.end_date   ? `<span>→ ${data.end_date}</span>` : ''}
              </div>` : ''}
          </div>
        </div>
        ${duplicate ? `
          <div class="form-group" style="margin-top:1rem">
            <label class="form-label">Import as</label>
            <div class="import-mode-options">
              <label class="import-mode-option">
                <input type="radio" name="import-mode" value="copy" checked />
                <span><strong>New copy</strong> — import with a new ID (keeps existing project)</span>
              </label>
              <label class="import-mode-option">
                <input type="radio" name="import-mode" value="overwrite" />
                <span><strong>Overwrite</strong> — replace the existing project</span>
              </label>
            </div>
          </div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="import-confirm-btn"><i class="fa fa-file-import"></i> Import</button>
      </div>
    `);

    document.getElementById('import-confirm-btn').onclick = function () {
      const mode = duplicate
        ? document.querySelector('input[name="import-mode"]:checked').value
        : 'overwrite';
      _doImport(data, mode);
    };
  }

  function _doImport(data, mode) {
    const uid = window.appData.currentUser.id;
    const importData = JSON.parse(JSON.stringify(data));

    if (mode === 'copy') {
      const newId = window.uid('proj');
      importData.id   = newId;
      importData.name = importData.name + ' (imported)';
    }

    // Save to local state
    window.appData.projects[importData.id] = importData;

    // Persist to backend
    const blob = new Blob([JSON.stringify(importData)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', blob, importData.id + '.json');
    formData.append('user_id', uid);
    fetch('/api/projects/import', { method: 'POST', body: formData })
      .catch(() => { /* non-fatal — local state is already updated */ });

    window.saveData();
    window.closeModal();
    window.renderProjects();
    if (typeof window.renderSidebarProjects === 'function') window.renderSidebarProjects();

    if (typeof window.showToast === 'function') {
      window.showToast('"' + importData.name + '" imported successfully.');
    }
  }
})();
