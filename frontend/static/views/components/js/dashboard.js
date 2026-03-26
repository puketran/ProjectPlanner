// ============================================================
// dashboard.js — Dashboard stats, upcoming tasks, recent projects
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  window.renderDashboard = function () {
    if (!window.appData.currentUser) return;
    _renderStats();
    _renderMilestones();
    _renderUpcoming();
    _renderDueSoon();
    _renderDepending();
    _renderBlocked();
    _renderRecent();
  };

  // --- Stats
  function _renderStats() {
    const container = document.getElementById('dashboard-stats');
    if (!container) return;
    const projects = window.getUserProjects('active');
    let doneTasks = 0, overdueTasks = 0, inProgressTasks = 0;
    const now = new Date();
    projects.forEach(p => {
      (p.tasks || []).filter(t => !t.deleted).forEach(t => {
        if (t.status === 'done')        doneTasks++;
        if (t.status === 'in-progress') inProgressTasks++;
        if (t.due_date && t.status !== 'done' && new Date(t.due_date + 'T00:00:00') < now) overdueTasks++;
      });
    });
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(99,102,241,.1);color:#6366f1"><i class="fa fa-folder-open"></i></div>
        <div class="stat-info"><div class="stat-value">${projects.length}</div><div class="stat-label">Active Projects</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(34,197,94,.1);color:#22c55e"><i class="fa fa-circle-check"></i></div>
        <div class="stat-info"><div class="stat-value">${doneTasks}</div><div class="stat-label">Tasks Done</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(59,130,246,.1);color:#3b82f6"><i class="fa fa-spinner"></i></div>
        <div class="stat-info"><div class="stat-value">${inProgressTasks}</div><div class="stat-label">In Progress</div></div>
      </div>
      <div class="stat-card ${overdueTasks > 0 ? 'stat-danger' : ''}">
        <div class="stat-icon" style="background:rgba(239,68,68,.1);color:#ef4444"><i class="fa fa-triangle-exclamation"></i></div>
        <div class="stat-info"><div class="stat-value">${overdueTasks}</div><div class="stat-label">Overdue</div></div>
      </div>`;
  }

  // --- Upcoming milestones (<2 weeks)
  function _renderMilestones() {
    const container = document.getElementById('dashboard-milestones');
    if (!container) return;
    const now  = new Date(); now.setHours(0, 0, 0, 0);
    const in14 = new Date(now.getTime() + 14 * 86400000);
    const items = [];
    window.getUserProjects('active').forEach(p => {
      (p.milestones || []).forEach(ms => {
        if (!ms.end_date) return;
        const end = new Date(ms.end_date + 'T00:00:00');
        if (end >= now && end <= in14) {
          const msTasks = (p.tasks || []).filter(t => !t.deleted && t.milestone_id === ms.id);
          const done    = msTasks.filter(t => t.status === 'done').length;
          const blocked = msTasks.filter(t => t.status === 'blocked').length;
          const pct     = msTasks.length > 0 ? Math.round(done / msTasks.length * 100) : 0;
          const daysLeft = Math.round((end - now) / 86400000);
          items.push({ ms, project: p, end, daysLeft, pct, msTasks, blocked });
        }
      });
    });
    if (items.length === 0) {
      container.innerHTML = '<p class="dash-empty">No milestones ending in the next 2 weeks.</p>';
      return;
    }
    items.sort((a, b) => a.end - b.end);
    container.innerHTML = '<div class="dash-ms-list">' + items.map(({ ms, project, daysLeft, pct, msTasks, blocked }) => {
      const color    = ms.color || '#6366f1';
      const urgency  = daysLeft <= 3 ? 'dash-ms-urgent' : daysLeft <= 7 ? 'dash-ms-soon' : '';
      const dayLabel = daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Tomorrow' : (daysLeft + 'd left');
      return '<div class="dash-ms-card ' + urgency + '" data-proj-id="' + project.id + '" style="--ms-color:' + color + '">' +
        '<div class="dash-ms-stripe" style="background:' + color + '"></div>' +
        '<div class="dash-ms-body">' +
          '<div class="dash-ms-title-row">' +
            '<span class="dash-ms-name"><i class="fa fa-flag" style="color:' + color + '"></i> ' + esc(ms.title) + '</span>' +
            '<span class="dash-ms-days ' + (daysLeft <= 3 ? 'dash-ms-days-urgent' : daysLeft <= 7 ? 'dash-ms-days-soon' : '') + '">' + dayLabel + '</span>' +
          '</div>' +
          '<div class="dash-ms-meta">' +
            '<span class="dash-ms-proj">' + esc(project.name) + '</span>' +
            (blocked ? '<span class="dash-ms-blocked"><i class="fa fa-triangle-exclamation"></i> ' + blocked + ' blocked</span>' : '') +
            '<span class="dash-ms-count">' + msTasks.length + ' task' + (msTasks.length !== 1 ? 's' : '') + '</span>' +
          '</div>' +
          '<div class="dash-ms-prog-row">' +
            '<div class="dash-ms-prog-track"><div class="dash-ms-prog-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
            '<span class="dash-ms-pct">' + pct + '%</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
    container.querySelectorAll('.dash-ms-card').forEach(card => {
      card.addEventListener('click', function () {
        window.openProject(this.dataset.projId);
        setTimeout(() => {
          const tab = document.querySelector('[data-tab="milestones"]');
          if (tab) tab.click();
        }, 80);
      });
    });
  }

  // --- Upcoming tasks (next 7 days, current user only)
  function _renderUpcoming() {
    const container = document.getElementById('dashboard-upcoming');
    if (!container) return;
    const userId  = window.appData.currentUser ? window.appData.currentUser.id : null;
    const now     = new Date();
    const in7days = new Date(now.getTime() + 7 * 86400000);
    const items   = [];
    window.getUserProjects('active').forEach(p => {
      (p.tasks || []).filter(t => !t.deleted && t.due_date && t.status !== 'done').forEach(t => {
        if (userId && t.assignee && t.assignee !== userId) return;
        const due = new Date(t.due_date + 'T00:00:00');
        if (due <= in7days) items.push({ task: t, project: p, due, overdue: due < now });
      });
    });
    items.sort((a, b) => a.due - b.due);
    if (items.length === 0) {
      container.innerHTML = '<p class="dash-empty">No upcoming tasks in the next 7 days.</p>';
      return;
    }
    container.innerHTML = _taskItemsHtml(items);
    _bindTaskItems(container);
  }

  // --- Tasks due within 3 days
  function _renderDueSoon() {
    const container = document.getElementById('dashboard-due-soon');
    if (!container) return;
    const now  = new Date(); now.setHours(0, 0, 0, 0);
    const in3  = new Date(now.getTime() + 3 * 86400000);
    const items = [];
    window.getUserProjects('active').forEach(p => {
      (p.tasks || []).filter(t => !t.deleted && t.due_date && t.status !== 'done').forEach(t => {
        const due = new Date(t.due_date + 'T00:00:00');
        if (due >= now && due <= in3) items.push({ task: t, project: p, due, overdue: false });
      });
    });
    items.sort((a, b) => a.due - b.due);
    if (items.length === 0) {
      container.innerHTML = '<p class="dash-empty">No tasks due in the next 3 days.</p>';
      return;
    }
    container.innerHTML = _taskItemsHtml(items);
    _bindTaskItems(container);
  }

  // --- Tasks waiting on current user's tasks
  function _renderDepending() {
    const container = document.getElementById('dashboard-depending');
    if (!container) return;
    const userId = window.appData.currentUser ? window.appData.currentUser.id : null;
    if (!userId) { container.innerHTML = '<p class="dash-empty">No user selected.</p>'; return; }
    const items = [];
    window.getUserProjects('active').forEach(p => {
      const myTasks   = (p.tasks || []).filter(t => !t.deleted && t.assignee === userId && t.status !== 'done');
      const myTaskIds = new Set(myTasks.map(t => t.id));
      if (!myTaskIds.size) return;
      (p.tasks || []).filter(t => !t.deleted && t.status !== 'done').forEach(t => {
        const blockingDeps = (t.dependencies || []).filter(d => myTaskIds.has(d.taskId));
        if (!blockingDeps.length) return;
        const prereqNames = blockingDeps.map(d => {
          const pre = myTasks.find(m => m.id === d.taskId);
          return pre ? pre.title : (d.title || '?');
        });
        items.push({ task: t, project: p, prereqNames });
      });
    });
    if (items.length === 0) {
      container.innerHTML = '<p class="dash-empty">No tasks are waiting on your work.</p>';
      return;
    }
    container.innerHTML = items.slice(0, 10).map(function(item) {
      var task = item.task, project = item.project, prereqNames = item.prereqNames;
      return '<div class="upcoming-item dash-dep-item" data-proj-id="' + project.id + '" data-task-id="' + task.id + '">' +
        '<span class="upcoming-dot" style="background:' + esc(project.color||'#6366f1') + '"></span>' +
        '<div class="upcoming-info">' +
          '<div class="upcoming-task-title">' + esc(task.title) + '</div>' +
          '<div class="upcoming-meta">' + esc(project.name) + ' &middot; <span class="dash-dep-needs"><i class="fa fa-link"></i> needs: ' +
            prereqNames.map(function(n){ return esc(n.length>20?n.slice(0,20)+'…':n); }).join(', ') +
          '</span></div>' +
        '</div>' +
        '<span class="badge badge-status-' + task.status + '">' + task.status + '</span>' +
      '</div>';
    }).join('');
    _bindTaskItems(container);
  }

  // --- Blocked tasks
  function _renderBlocked() {
    const container = document.getElementById('dashboard-blocked');
    if (!container) return;
    const items = [];
    window.getUserProjects('active').forEach(p => {
      (p.tasks || []).filter(t => !t.deleted && t.status === 'blocked').forEach(t => {
        items.push({ task: t, project: p, due: t.due_date ? new Date(t.due_date + 'T00:00:00') : null });
      });
    });
    if (items.length === 0) {
      container.innerHTML = '<p class="dash-empty">No blocked tasks — keep it up!</p>';
      return;
    }
    container.innerHTML = items.slice(0, 10).map(function(item) {
      var task = item.task, project = item.project, due = item.due;
      return '<div class="upcoming-item dash-blocked-item" data-proj-id="' + project.id + '" data-task-id="' + task.id + '">' +
        '<span class="upcoming-dot" style="background:#ef4444"></span>' +
        '<div class="upcoming-info">' +
          '<div class="upcoming-task-title">' + esc(task.title) + '</div>' +
          '<div class="upcoming-meta">' + esc(project.name) + (due ? ' &middot; <span class="text-danger"><i class="fa fa-calendar-days"></i> ' + _fmtRelDate(due) + '</span>' : '') + '</div>' +
        '</div>' +
        '<span class="badge badge-status-blocked">blocked</span>' +
      '</div>';
    }).join('');
    _bindTaskItems(container);
  }

  // --- Recent projects
  function _renderRecent() {
    const container = document.getElementById('dashboard-recent');
    if (!container) return;
    const projects = window.getUserProjects('active')
      .sort((a, b) => (b.updated_at || '') > (a.updated_at || '') ? 1 : -1)
      .slice(0, 5);
    if (projects.length === 0) {
      container.innerHTML = '<p class="dash-empty">No projects yet.</p>';
      return;
    }
    container.innerHTML = projects.map(p => {
      const tasks  = (p.tasks || []).filter(t => !t.deleted);
      const done   = tasks.filter(t => t.status === 'done').length;
      const pct    = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;
      const pinned = tasks.filter(t => t.pinned && t.status !== 'done').slice(0, 2);
      return `
        <div class="recent-project-block">
          <div class="recent-project-item" data-project-id="${p.id}">
            <span class="recent-project-icon" style="color:${esc(p.color||'#6366f1')}">${p.icon||'📁'}</span>
            <div class="recent-project-info">
              <div class="recent-project-name">${esc(p.name)}</div>
              <div class="recent-project-bar">
                <div class="recent-project-fill" style="width:${pct}%;background:${esc(p.color||'#6366f1')}"></div>
              </div>
            </div>
            <span class="recent-project-pct">${pct}%</span>
          </div>
          ${pinned.map(t => `
            <div class="dash-pinned-task" data-proj-id="${p.id}" data-task-id="${t.id}">
              <i class="fa fa-thumbtack dash-pinned-icon" style="color:${esc(p.color||'#6366f1')}"></i>
              <span class="dash-pinned-title">${esc(t.title)}</span>
              <span class="badge badge-status-${t.status}">${t.status}</span>
            </div>`).join('')}
        </div>`;
    }).join('');
    container.querySelectorAll('.recent-project-item').forEach(item => {
      item.addEventListener('click', function () { window.openProject(this.dataset.projectId); });
    });
    container.querySelectorAll('.dash-pinned-task').forEach(item => {
      item.addEventListener('click', function () {
        const pid = this.dataset.projId, tid = this.dataset.taskId;
        window.openProject(pid);
        setTimeout(() => {
          if (typeof window.openDetailPanel === 'function') window.openDetailPanel(pid, tid);
        }, 50);
      });
    });
  }

  // --- Shared
  function _taskItemsHtml(items) {
    return items.slice(0, 10).map(({ task, project, due, overdue }) =>
      '<div class="upcoming-item ' + (overdue ? 'overdue' : '') + '" data-proj-id="' + project.id + '" data-task-id="' + task.id + '">' +
        '<span class="upcoming-dot" style="background:' + esc(project.color||'#6366f1') + '"></span>' +
        '<div class="upcoming-info">' +
          '<div class="upcoming-task-title">' + esc(task.title) + '</div>' +
          '<div class="upcoming-meta">' + esc(project.name) + (due ? ' &middot; <span class="' + (overdue?'text-danger':'') + '">' + _fmtRelDate(due) + '</span>' : '') + '</div>' +
        '</div>' +
        '<span class="badge badge-status-' + task.status + '">' + task.status + '</span>' +
      '</div>'
    ).join('');
  }

  function _bindTaskItems(container) {
    container.querySelectorAll('.upcoming-item').forEach(item => {
      item.addEventListener('click', function () {
        const pid = this.dataset.projId, tid = this.dataset.taskId;
        window.openProject(pid);
        setTimeout(() => {
          if (typeof window.openDetailPanel === 'function') window.openDetailPanel(pid, tid);
        }, 50);
      });
    });
  }

  function _fmtRelDate(date) {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d     = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff  = Math.round((d - today) / 86400000);
    if (diff < 0)   return Math.abs(diff) + 'd overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return 'In ' + diff + ' days';
  }
})();
