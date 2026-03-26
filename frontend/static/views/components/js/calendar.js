// ============================================================
// calendar.js — Monthly calendar view
// ============================================================
(function () {
  'use strict';

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let _year  = new Date().getFullYear();
  let _month = new Date().getMonth(); // 0-based
  let _calTasks = [];

  // ─── Render calendar view ─────────────────────────────────
  window.renderCalendar = function () {
    _updateLabel();
    _loadCalendarTasks().then(() => _drawGrid());
  };

  window.calPrev = function () { if (_month === 0) { _month = 11; _year--; } else { _month--; } window.renderCalendar(); };
  window.calNext = function () { if (_month === 11) { _month = 0; _year++; } else { _month++; } window.renderCalendar(); };
  window.calToday = function () { _year = new Date().getFullYear(); _month = new Date().getMonth(); window.renderCalendar(); };

  function _updateLabel() {
    const el = document.getElementById('cal-month-label');
    if (el) el.textContent = MONTHS[_month] + ' ' + _year;
  }

  async function _loadCalendarTasks() {
    if (!window.appData.currentUser) return;
    // Collect tasks from local state first (fast)
    const uid = window.appData.currentUser.id;
    _calTasks = [];
    Object.values(window.appData.projects).forEach(proj => {
      if (proj.user_id !== uid || proj.status === 'deleted') return;
      (proj.tasks || []).forEach(t => {
        if (t.deleted || !t.due_date) return;
        _calTasks.push({
          task_id:       t.id,
          task_title:    t.title,
          project_id:    proj.id,
          project_name:  proj.name,
          project_color: proj.color || '#6366f1',
          due_date:      t.due_date,
          status:        t.status,
          priority:      t.priority
        });
      });
    });
    // Try also syncing from server (non-blocking)
    try {
      const r = await fetch(`/api/calendar/tasks?user_id=${uid}&year=${_year}&month=${_month + 1}`);
      if (r.ok) {
        const data = await r.json();
        // Merge server tasks that aren't already in local
        const localIds = new Set(_calTasks.map(t => t.task_id));
        for (const t of data.tasks || []) {
          if (!localIds.has(t.task_id)) _calTasks.push(t);
        }
      }
    } catch (_) { /* use local only */ }
  }

  function _drawGrid() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    const today     = new Date();
    const firstDay  = new Date(_year, _month, 1);
    const lastDay   = new Date(_year, _month + 1, 0);
    const startDow  = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    // Tasks indexed by YYYY-MM-DD
    const tasksByDay = {};
    _calTasks.forEach(t => {
      if (!t.due_date) return;
      const key = t.due_date.slice(0, 10);
      (tasksByDay[key] = tasksByDay[key] || []).push(t);
    });

    let html = DAYS.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    // Blank cells before first day
    for (let i = 0; i < startDow; i++) {
      html += `<div class="calendar-day other-month"></div>`;
    }

    for (let d = 1; d <= totalDays; d++) {
      const isToday = today.getFullYear() === _year && today.getMonth() === _month && today.getDate() === d;
      const key = `${_year}-${String(_month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayTasks = tasksByDay[key] || [];
      const hasOverdue = dayTasks.some(t => t.status !== 'done' && new Date(t.due_date) < today);

      const taskDots = dayTasks.slice(0, 3).map(t => {
        const cls = [
          'day-task-dot',
          t.status === 'done' ? 'done' : '',
          !isToday && new Date(t.due_date) < today && t.status !== 'done' ? 'overdue' : '',
          t.priority === 'high' || t.priority === 'urgent' ? 'high' : ''
        ].filter(Boolean).join(' ');
        return `<div class="${cls}" data-task-id="${t.task_id}" data-proj-id="${t.project_id}"
          title="${t.task_title} — ${t.project_name}" style="--task-color:${t.project_color}">
          ${t.task_title}
        </div>`;
      }).join('');

      const moreCount = dayTasks.length > 3 ? dayTasks.length - 3 : 0;
      const moreHtml  = moreCount ? `<div class="day-tasks-more">+${moreCount} more</div>` : '';

      html += `
        <div class="calendar-day${isToday ? ' today' : ''}${hasOverdue ? ' has-overdue' : ''}${dayTasks.length ? ' has-tasks' : ''}"
          data-date="${key}">
          <div class="day-number">${d}</div>
          <div class="day-tasks">${taskDots}${moreHtml}</div>
        </div>`;
    }

    // Fill remaining cells
    const filled = startDow + totalDays;
    const remaining = filled % 7 === 0 ? 0 : 7 - (filled % 7);
    for (let i = 0; i < remaining; i++) {
      html += `<div class="calendar-day other-month"></div>`;
    }

    grid.innerHTML = html;

    // Event: click day cell to show day panel
    grid.querySelectorAll('.calendar-day:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', function (e) {
        if (e.target.closest('.day-task-dot')) {
          const dot = e.target.closest('.day-task-dot');
          const projId = dot.dataset.projId;
          const taskId = dot.dataset.taskId;
          if (projId && taskId && typeof window.openDetailPanel === 'function') {
            e.stopPropagation();
            window.openProject(projId);
            setTimeout(() => window.openDetailPanel(projId, taskId), 100);
          }
          return;
        }
        _showDayPanel(this.dataset.date, tasksByDay[this.dataset.date] || []);
      });
    });
  }

  function _showDayPanel(dateStr, tasks) {
    const panel = document.getElementById('calendar-day-panel');
    const label = document.getElementById('cal-day-label');
    const list  = document.getElementById('calendar-day-tasks');
    if (!panel) return;

    if (label) {
      const d = new Date(dateStr + 'T00:00:00');
      label.textContent = d.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });
    }

    if (list) {
      if (tasks.length === 0) {
        list.innerHTML = '<p class="empty-state" style="font-size:var(--font-size-xs)">No tasks this day.</p>';
      } else {
        list.innerHTML = tasks.map(t => `
          <div class="day-task-item ${t.status === 'done' ? 'done' : ''}" style="border-left-color:${t.project_color}">
            <div>
              <div style="font-weight:500">${t.task_title}</div>
              <div style="font-size:var(--font-size-xs);color:var(--text-muted)">${t.project_name}</div>
            </div>
            <span class="badge badge-status-${t.status}">${t.status}</span>
          </div>`).join('');
      }
    }

    // Add task with pre-filled due date
    const addBtn = document.getElementById('btn-cal-add-task');
    if (addBtn) {
      addBtn.onclick = function () {
        panel.classList.add('hidden');
        // Navigate to projects view and open add task with date
        window.switchView('projects');
      };
    }

    panel.classList.remove('hidden');
  }

  // Close day panel
  const closeBtn = document.getElementById('btn-close-day-panel');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    const panel = document.getElementById('calendar-day-panel');
    if (panel) panel.classList.add('hidden');
  });
})();
