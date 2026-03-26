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
        <button class="btn btn-primary btn-sm" id="btn-new-milestone">
          <i class="fa fa-plus"></i> New Milestone
        </button>
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
                    ${blocked > 0 ? `<span class="ms-blocked-badge"><i class="fa fa-triangle-exclamation"></i> ${blocked} blocked</span>` : ''}
                    <span class="ms-click-hint"><i class="fa fa-chevron-down"></i> View details</span>
                  </div>
                  ${msTasks.length > 0 ? `
                    <div class="ms-progress-row">
                      <div class="ms-progress-track">
                        <div class="ms-progress-fill" style="width:${pct}%;background:${esc(color)}"></div>
                      </div>
                      <span class="ms-progress-pct">${pct}%</span>
                    </div>
                    <div class="ms-task-chips">
                      ${msTasks.slice(0, 6).map(t => `
                        <span class="ms-task-chip ms-chip-status-${t.status}" title="${esc(t.title)}">${esc(t.title.length > 30 ? t.title.slice(0, 30) + '…' : t.title)}</span>
                      `).join('')}
                      ${msTasks.length > 6 ? `<span class="ms-task-chip-more">+${msTasks.length - 6} more</span>` : ''}
                    </div>
                  ` : ''}
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

    // ─ Toggle inline detail ──────────────────────────────
    function _toggleInlineDetail(cnt, pid, card) {
      const msId  = card.dataset.msId;
      const item  = card.closest('.ms-card-item');
      const panel = item ? item.querySelector('.ms-inline-detail') : null;
      if (!panel) return;
      const wasOpen = panel.classList.contains('msd-open');
      // Close all open panels first
      cnt.querySelectorAll('.ms-inline-detail.msd-open').forEach(p => p.classList.remove('msd-open'));
      cnt.querySelectorAll('.ms-card-item.ms-expanded').forEach(c => {
        c.classList.remove('ms-expanded');
        c.querySelectorAll('.ms-expand-icon').forEach(i => i.classList.remove('rotated'));
      });
      if (!wasOpen) {
        panel.classList.add('msd-open');
        item.classList.add('ms-expanded');
        card.querySelectorAll('.ms-expand-icon').forEach(i => i.classList.add('rotated'));
        if (typeof window.openMilestoneDetail === 'function')
          window.openMilestoneDetail(pid, msId, panel);
        setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
      }
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

    const titleInput = document.getElementById('ms-title');
    const doSave = () => {
      const title = titleInput.value.trim();
      if (!title) { titleInput.style.borderColor = 'var(--color-danger)'; titleInput.focus(); return; }
      const start = document.getElementById('ms-start').value || null;
      const end   = document.getElementById('ms-end').value   || null;
      const desc  = document.getElementById('ms-desc').value.trim();
      const now   = window.isoNow();
      if (isEdit) {
        ms.title       = title;
        ms.start_date  = start;
        ms.end_date    = end;
        ms.color       = selColor;
        ms.description = desc;
        ms.updated_at  = now;
      } else {
        proj.milestones = proj.milestones || [];
        proj.milestones.push({
          id: window.uid('ms'), title, start_date: start, end_date: end,
          color: selColor, description: desc, created_at: now, updated_at: now
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
