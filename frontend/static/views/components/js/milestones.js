// ============================================================
// milestones.js — Project milestone management
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const MS_COLORS = ['#6366f1','#8b5cf6','#ec4899','#22c55e','#f97316','#06b6d4','#eab308','#ef4444','#14b8a6','#3b82f6'];

  function _fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** Count business days from today to endDate (0 = due today, negative = overdue). */
  function _workingDaysLeft(endDate) {
    if (!endDate) return null;
    const end   = new Date(endDate + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff  = Math.round((end - today) / 86400000);
    if (diff < 0) return diff; // negative = overdue
    let count = 0;
    const d = new Date(today);
    while (d <= end) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  // ─── Render milestone list ────────────────────────────────
  window.renderMilestones = function (projectId) {
    projectId = projectId || window.currentProjectId;
    const container = document.getElementById('project-tab-milestones');
    if (!container) return;
    const proj = window.getProject(projectId);
    if (!proj) return;

    const milestones = proj.milestones || [];
    const tasks      = (proj.tasks || []).filter(t => !t.deleted);

    let _dragMsId = null;

    const toolbar = `
      <div class="ms-toolbar">
        <span class="ms-toolbar-title"><i class="fa fa-flag"></i> Milestones</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-ghost btn-sm" id="btn-collapse-all" title="Collapse all" style="display:none"><i class="fa fa-chevrons-up"></i> Collapse all</button>
          <button class="btn btn-primary btn-sm" id="btn-new-milestone"><i class="fa fa-plus"></i> New Milestone</button>
        </div>
      </div>`;

    if (milestones.length === 0) {
      container.innerHTML = toolbar + `
        <div class="empty-state ms-empty">
          <i class="fa fa-flag"></i>
          <p>No milestones yet.<br>Create one to organise your project into phases.</p>
        </div>`;
      document.getElementById('btn-new-milestone').onclick = () => window.showCreateMilestoneModal(projectId);
      return;
    }

    const unassigned = tasks.filter(t => !t.milestone_id);

    container.innerHTML = toolbar + `
      <div class="ms-list">
        ${milestones.map(ms => {
          const msTasks = tasks.filter(t => t.milestone_id === ms.id);
          const done    = msTasks.filter(t => t.status === 'done').length;
          const blocked = msTasks.filter(t => t.status === 'blocked').length;
          const pct     = msTasks.length > 0 ? Math.round(done / msTasks.length * 100) : 0;
          const color   = ms.color || '#6366f1';
          const wdLeft  = _workingDaysLeft(ms.end_date);
          const wdBadge = wdLeft === null ? '' :
            wdLeft < 0  ? `<span class="ms-wdl-badge ms-wdl-overdue"><i class="fa fa-clock"></i> Overdue ${Math.abs(wdLeft)}d</span>` :
            wdLeft === 0 ? `<span class="ms-wdl-badge ms-wdl-today"><i class="fa fa-clock"></i> Due Today</span>` :
            `<span class="ms-wdl-badge"><i class="fa fa-clock"></i> ${wdLeft}wd left</span>`;

          // Bottleneck detection (pairs of dependent tasks whose dates overlap)
          let bottleneckCount = 0;
          if (ms.start_date && ms.end_date && typeof window._msdDetectBottlenecks === 'function') {
            const msS = new Date(ms.start_date + 'T00:00:00');
            const msE = new Date(ms.end_date   + 'T00:00:00');
            if (msE > msS) bottleneckCount = window._msdDetectBottlenecks(msTasks, msS, msE).length;
          }

          // Orphan deliverables: deliverables with no linked tasks (no one owns them)
          const deliverables = ms.deliverables || [];
          const orphanDl = deliverables.filter(d => !d.task_ids || d.task_ids.length === 0).length;
          return `
            <div class="ms-card-item" data-ms-id="${ms.id}">
              <div class="ms-card" data-ms-id="${ms.id}" draggable="true">
                <div class="ms-drag-handle" title="Drag to reorder"><i class="fa fa-grip-vertical"></i></div>
                <div class="ms-card-stripe" style="background:${esc(color)}"></div>
                <div class="ms-card-body">
                  <div class="ms-card-top">
                    <div class="ms-card-title-row">
                      <span class="ms-color-dot" style="background:${esc(color)}"></span>
                      <h4 class="ms-card-title">${esc(ms.title)}</h4>
                      <span class="ms-task-count">${msTasks.length} task${msTasks.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="ms-card-actions">
                      <button class="icon-btn ms-expand-btn" title="Expand detail"><i class="fa fa-chevron-down ms-expand-icon"></i></button>
                      <button class="icon-btn ms-edit-btn" data-ms-id="${ms.id}" title="Edit milestone"><i class="fa fa-pen"></i></button>
                      <button class="icon-btn ms-delete-btn text-danger" data-ms-id="${ms.id}" title="Delete milestone"><i class="fa fa-trash"></i></button>
                    </div>
                  </div>
                  <div class="ms-date-range">
                    <i class="fa fa-calendar-range"></i>
                    <span>${_fmtDate(ms.start_date)}</span>
                    <i class="fa fa-arrow-right" style="font-size:10px;opacity:.4"></i>
                    <span>${_fmtDate(ms.end_date)}</span>
                  </div>
                  ${ms.description ? `<p class="ms-desc">${esc(ms.description)}</p>` : ''}
                  <div class="ms-card-meta-row">
                    ${wdBadge}
                    ${blocked > 0 ? `<span class="ms-blocked-badge"><i class="fa fa-circle-xmark"></i> ${blocked} blocked</span>` : ''}
                    ${bottleneckCount > 0 ? `<span class="ms-bottleneck-badge"><i class="fa fa-code-branch"></i> ${bottleneckCount} bottleneck${bottleneckCount>1?'s':''}</span>` : ''}
                    ${orphanDl > 0 ? `<span class="ms-orphan-badge"><i class="fa fa-box-archive"></i> ${orphanDl} unowned deliverable${orphanDl>1?'s':''}</span>` : ''}
                    <span class="ms-click-hint"><i class="fa fa-chevron-down"></i> View details</span>
                  </div>
                  ${msTasks.length > 0 ? (() => {
                    const inProgress = msTasks.filter(t => t.status === 'in-progress');
                    if (!inProgress.length) return '';
                    return `
                    <div class="ms-task-chips">
                      <span class="ms-task-chips-label"><i class="fa fa-spinner"></i> In Progress:</span>
                      ${inProgress.slice(0, 5).map(t => `
                        <span class="ms-task-chip ms-chip-status-in-progress" title="${esc(t.title)}">${esc(t.title)}</span>
                      `).join('')}
                      ${inProgress.length > 5 ? `<span class="ms-task-chip-more">+${inProgress.length - 5} more</span>` : ''}
                    </div>`;
                  })() : ''}
                </div>
              </div>
              <div class="ms-inline-detail" id="msd-inner-${ms.id}"></div>
            </div>`;
        }).join('')}
        ${unassigned.length > 0 ? `
          <div class="ms-unassigned">
            <span class="ms-unassigned-label">
              <i class="fa fa-inbox"></i>
              ${unassigned.length} task${unassigned.length !== 1 ? 's' : ''} not assigned to a milestone
            </span>
          </div>` : ''}
      </div>`;

    document.getElementById('btn-new-milestone').onclick = () => window.showCreateMilestoneModal(projectId);
    const collapseAllBtn = document.getElementById('btn-collapse-all');
    if (collapseAllBtn) {
      collapseAllBtn.onclick = () => {
        container.querySelectorAll('.ms-inline-detail.msd-open').forEach(p => p.classList.remove('msd-open'));
        container.querySelectorAll('.ms-card-item.ms-expanded').forEach(c => {
          c.classList.remove('ms-expanded');
          c.querySelectorAll('.ms-expand-icon').forEach(i => i.classList.remove('rotated'));
        });
        collapseAllBtn.style.display = 'none';
      };
    }

    // ─ Toggle inline detail (multiple can be open simultaneously) ──
    function _toggleInlineDetail(cnt, pid, card) {
      const msId  = card.dataset.msId;
      const item  = card.closest('.ms-card-item');
      const panel = item ? item.querySelector('.ms-inline-detail') : null;
      if (!panel) return;
      const wasOpen = panel.classList.contains('msd-open');
      if (wasOpen) {
        panel.classList.remove('msd-open');
        item.classList.remove('ms-expanded');
        card.querySelectorAll('.ms-expand-icon').forEach(i => i.classList.remove('rotated'));
      } else {
        panel.classList.add('msd-open');
        item.classList.add('ms-expanded');
        card.querySelectorAll('.ms-expand-icon').forEach(i => i.classList.add('rotated'));
        if (typeof window.openMilestoneDetail === 'function')
          window.openMilestoneDetail(pid, msId, panel);
        setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
      }
      // Show/hide collapse-all button
      const collapseBtn = cnt.querySelector('#btn-collapse-all');
      if (collapseBtn) collapseBtn.style.display = cnt.querySelectorAll('.ms-inline-detail.msd-open').length > 0 ? '' : 'none';
    }

    // ─ Drag to reorder ───────────────────────────────────
    container.querySelectorAll('.ms-card').forEach(card => {
      card.addEventListener('dragstart', function (e) {
        _dragMsId = this.dataset.msId;
        this.classList.add('ms-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function () {
        this.classList.remove('ms-dragging');
        container.querySelectorAll('.ms-card').forEach(c => c.classList.remove('ms-drag-over'));
      });
      card.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (this.dataset.msId !== _dragMsId) this.classList.add('ms-drag-over');
      });
      card.addEventListener('dragleave', function () { this.classList.remove('ms-drag-over'); });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        this.classList.remove('ms-drag-over');
        const targetId = this.dataset.msId;
        if (!_dragMsId || _dragMsId === targetId) return;
        const fromIdx = proj.milestones.findIndex(m => m.id === _dragMsId);
        const toIdx   = proj.milestones.findIndex(m => m.id === targetId);
        if (fromIdx < 0 || toIdx < 0) return;
        const [moved] = proj.milestones.splice(fromIdx, 1);
        proj.milestones.splice(toIdx, 0, moved);
        proj.updated_at = window.isoNow();
        window.saveData();
        window.renderMilestones(projectId);
      });
      // Click on card body → toggle inline sub-view
      card.querySelector('.ms-card-body').addEventListener('click', function (e) {
        if (e.target.closest('.ms-edit-btn') || e.target.closest('.ms-delete-btn') || e.target.closest('.ms-expand-btn')) return;
        _toggleInlineDetail(container, projectId, card);
      });
      const expandBtn = card.querySelector('.ms-expand-btn');
      if (expandBtn) expandBtn.addEventListener('click', e => { e.stopPropagation(); _toggleInlineDetail(container, projectId, card); });
      // Cursor hint
      const body = card.querySelector('.ms-card-body');
      if (body) body.style.cursor = 'pointer';
    });

    container.querySelectorAll('.ms-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); _openMilestoneModal(projectId, btn.dataset.msId); });
    });
    container.querySelectorAll('.ms-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); _confirmDeleteMilestone(projectId, btn.dataset.msId); });
    });
  };

  // ─── Create milestone modal ───────────────────────────────
  window.showCreateMilestoneModal = function (projectId) {
    _openMilestoneModal(projectId, null);
  };

  // ─── Create / Edit modal ──────────────────────────────────
  function _openMilestoneModal(projectId, msId) {
    const proj = window.getProject(projectId);
    if (!proj) return;
    const ms     = msId ? (proj.milestones || []).find(m => m.id === msId) : null;
    const isEdit = !!ms;
    let selColor = (ms && ms.color) ? ms.color : MS_COLORS[0];

    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-flag"></i> ${isEdit ? 'Edit' : 'New'} Milestone</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Title *</label>
          <input id="ms-title" type="text" class="form-input" placeholder="Phase 1 – Research" value="${ms ? esc(ms.title) : ''}" />
        </div>
        <div class="form-group-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input id="ms-start" type="date" class="form-input" value="${ms && ms.start_date ? ms.start_date : ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input id="ms-end" type="date" class="form-input" value="${ms && ms.end_date ? ms.end_date : ''}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="ms-color-picker" id="ms-colors">
            ${MS_COLORS.map(c => `<div class="ms-color-swatch${c === selColor ? ' selected' : ''}" data-c="${c}" style="background:${c}" tabindex="0"></div>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="ms-desc" class="form-textarea" placeholder="What happens in this phase?" rows="2">${ms ? esc(ms.description || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Deliverables</label>
          <div id="ms-dl-list" style="margin-bottom:6px"></div>
          <div style="display:flex;gap:6px">
            <input id="ms-dl-input" type="text" class="form-input" placeholder="Add deliverable…" style="flex:1">
            <button type="button" id="ms-dl-add-btn" class="btn btn-secondary btn-sm"><i class="fa fa-plus"></i></button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="ms-save-btn">${isEdit ? 'Save Changes' : 'Create'}</button>
      </div>
    `);

    document.querySelectorAll('#ms-colors .ms-color-swatch').forEach(sw => {
      sw.addEventListener('click', function () {
        document.querySelectorAll('#ms-colors .ms-color-swatch').forEach(s => s.classList.remove('selected'));
        this.classList.add('selected');
        selColor = this.dataset.c;
      });
    });

    // Deliverables list
    let dlList = ms ? JSON.parse(JSON.stringify(ms.deliverables || [])) : [];
    function _refreshDlList() {
      const listEl = document.getElementById('ms-dl-list');
      if (!listEl) return;
      listEl.innerHTML = dlList.length
        ? dlList.map((d, i) => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0"><span style="flex:1;font-size:13px">${esc(d.text)}</span><button type="button" class="icon-btn text-danger ms-dl-rm" data-idx="${i}"><i class="fa fa-xmark"></i></button></div>`).join('')
        : '<p style="font-size:12px;color:var(--text-muted);margin:2px 0">No deliverables yet</p>';
      listEl.querySelectorAll('.ms-dl-rm').forEach(btn => {
        btn.onclick = () => { dlList.splice(parseInt(btn.dataset.idx, 10), 1); _refreshDlList(); };
      });
    }
    _refreshDlList();
    const dlInput   = document.getElementById('ms-dl-input');
    const _doAddDl  = () => {
      const text = dlInput?.value.trim();
      if (!text) return;
      dlList.push({ id: 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2), text, done: false });
      if (dlInput) dlInput.value = '';
      _refreshDlList();
    };
    document.getElementById('ms-dl-add-btn')?.addEventListener('click', _doAddDl);
    dlInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _doAddDl(); } });

    const titleInput = document.getElementById('ms-title');
    const doSave = () => {
      const title = titleInput.value.trim();
      if (!title) { titleInput.style.borderColor = 'var(--color-danger)'; titleInput.focus(); return; }
      const start = document.getElementById('ms-start').value || null;
      const end   = document.getElementById('ms-end').value   || null;
      const desc  = document.getElementById('ms-desc').value.trim();
      const now   = window.isoNow();
      if (isEdit) {
        ms.title        = title;
        ms.start_date   = start;
        ms.end_date     = end;
        ms.color        = selColor;
        ms.description  = desc;
        ms.deliverables = dlList;
        ms.updated_at   = now;
      } else {
        proj.milestones = proj.milestones || [];
        proj.milestones.push({
          id: window.uid('ms'), title, start_date: start, end_date: end,
          color: selColor, description: desc, deliverables: dlList, created_at: now, updated_at: now
        });
      }
      proj.updated_at = now;
      window.saveData();
      window.closeModal();
      window.renderMilestones(projectId);
      // Refresh detail panel milestone dropdown if open
      if (window.currentTaskId && typeof window.refreshDetailPanel === 'function') window.refreshDetailPanel();
    };

    document.getElementById('ms-save-btn').onclick = doSave;
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
    titleInput.focus();
  }

  // ─── Delete milestone ─────────────────────────────────────
  function _confirmDeleteMilestone(projectId, msId) {
    const proj = window.getProject(projectId);
    if (!proj) return;
    const ms = (proj.milestones || []).find(m => m.id === msId);
    if (!ms) return;
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title text-danger"><i class="fa fa-triangle-exclamation"></i> Delete Milestone</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <p>Delete <strong>${esc(ms.title)}</strong>?</p>
        <p style="color:var(--text-muted);font-size:var(--font-size-sm)">Tasks linked to this milestone will be unlinked but not deleted.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="ms-del-confirm-btn">Delete</button>
      </div>
    `);
    document.getElementById('ms-del-confirm-btn').onclick = () => {
      proj.milestones = (proj.milestones || []).filter(m => m.id !== msId);
      (proj.tasks || []).forEach(t => { if (t.milestone_id === msId) t.milestone_id = null; });
      proj.updated_at = window.isoNow();
      window.saveData();
      window.closeModal();
      window.renderMilestones(projectId);
      if (typeof window.renderTasks === 'function') window.renderTasks(projectId);
    };
  }
})();
