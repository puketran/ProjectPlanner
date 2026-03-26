// ============================================================
// timeline.js — Multi-level Gantt / macro plan view
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS_IN  = [31,28,31,30,31,30,31,31,30,31,30,31];

  let _year  = new Date().getFullYear();
  let _level = 0; // 0 = Projects, 1 = Milestones, 2 = Tasks
  let _tlDiscFilter = null; // discipline filter for Tasks level

  // Users cache (populated lazily)
  let _usersCache = null;

  // ─── Entry point ──────────────────────────────────────────
  window.renderTimeline = function () {
    const view = document.getElementById('view-timeline');
    if (!view || !window.appData.currentUser) return;

    const toolbar = view.querySelector('.tl-toolbar');
    const chart   = view.querySelector('.tl-chart-area');
    if (!toolbar || !chart) return;

    _renderToolbar(toolbar);
    _renderChart(chart);

    // Lazy-load users for assignee names
    if (!_usersCache) _fetchUsers();
  };

  // ─── Toolbar ──────────────────────────────────────────────
  function _renderToolbar(toolbar) {
    toolbar.innerHTML = `
      <div class="tl-toolbar-left">
        <button class="btn btn-ghost btn-sm" id="tl-year-prev"><i class="fa fa-chevron-left"></i></button>
        <span class="tl-year-label">${_year}</span>
        <button class="btn btn-ghost btn-sm" id="tl-year-next"><i class="fa fa-chevron-right"></i></button>
        <button class="btn btn-ghost btn-sm" id="tl-today-btn"><i class="fa fa-crosshairs"></i> Today</button>
      </div>
      <div class="tl-level-tabs">
        <button class="tl-level-btn${_level === 0 ? ' active' : ''}" data-lvl="0">
          <i class="fa fa-folder-open"></i> Projects
        </button>
        <button class="tl-level-btn${_level === 1 ? ' active' : ''}" data-lvl="1">
          <i class="fa fa-flag"></i> Milestones
        </button>
        <button class="tl-level-btn${_level === 2 ? ' active' : ''}" data-lvl="2">
          <i class="fa fa-list-check"></i> Tasks
        </button>
      </div>`;

    document.getElementById('tl-year-prev').onclick = () => { _year--; window.renderTimeline(); };
    document.getElementById('tl-year-next').onclick = () => { _year++; window.renderTimeline(); };
    document.getElementById('tl-today-btn').onclick = () => {
      _year = new Date().getFullYear();
      window.renderTimeline();
      setTimeout(_scrollToToday, 80);
    };
    toolbar.querySelectorAll('.tl-level-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        _level = parseInt(this.dataset.lvl, 10);
        _tlDiscFilter = null; // reset filter on level change
        window.renderTimeline();
      });
    });

    // Discipline filter pills — only for Tasks level
    if (_level === 2) {
      const allProjects = window.getUserProjects('active');
      const allTasks    = allProjects.flatMap(p => (p.tasks || []).filter(t => !t.deleted));
      const usedDiscs   = [...new Set(allTasks.map(t => t.discipline).filter(Boolean))];
      if (usedDiscs.length > 0) {
        const pillsHtml = `<div class="tl-disc-pills">${
          ['All', ...usedDiscs].map(d => {
            const isAll   = d === 'All';
            const active  = isAll ? !_tlDiscFilter : _tlDiscFilter === d;
            const color   = (!isAll && typeof window.getDiscColor === 'function') ? window.getDiscColor(d) : '#6366f1';
            return `<button class="dp-pill tl-disc-pill${active ? ' active' : ''}" data-disc="${d}" style="${active ? 'background:' + color + ';color:#fff;border-color:transparent;' : ''}">${d}</button>`;
          }).join('')
        }</div>`;
        toolbar.insertAdjacentHTML('beforeend', pillsHtml);
        toolbar.querySelectorAll('.tl-disc-pill').forEach(btn => {
          btn.addEventListener('click', function () {
            _tlDiscFilter = this.dataset.disc === 'All' ? null : this.dataset.disc;
            window.renderTimeline();
          });
        });
      }
    }
  } // end _renderToolbar

  // ─── Chart rendering ──────────────────────────────────────
  function _renderChart(chart) {
    const isLeap   = (_year % 4 === 0 && _year % 100 !== 0) || _year % 400 === 0;
    const totalDays = isLeap ? 366 : 365;
    const todayX   = _getTodayX(totalDays);

    // Month header
    const monthCells = MONTHS.map((m, i) => {
      const days = (i === 1 && isLeap) ? 29 : DAYS_IN[i];
      const w    = (days / totalDays * 100).toFixed(5);
      return `<div class="tl-month-cell" style="width:${w}%">${m}</div>`;
    }).join('');

    const projects = window.getUserProjects('active');
    let rowsHtml   = '';

    if (_level === 0) {
      rowsHtml = projects.map(p => _projectRowHtml(p, totalDays, false)).join('');
    } else if (_level === 1) {
      rowsHtml = projects.map(p => {
        const header = _projectRowHtml(p, totalDays, true);
        const msRows = (p.milestones || []).map(ms =>
          _milestoneRowHtml(p, ms, totalDays, false)
        ).join('');
        const noMs = `
          ${!(p.milestones || []).length ? `
            <div class="tl-row tl-row-no-ms">
              <div class="tl-row-label tl-indent-1">
                <div class="tl-row-info"><span class="tl-row-meta" style="font-style:italic">No milestones</span></div>
              </div>
              <div class="tl-row-chart tl-no-date-row"></div>
            </div>` : ''}`;
        return header + msRows + noMs;
      }).join('');
    } else {
      rowsHtml = projects.map(p => {
        let tasks      = (p.tasks || []).filter(t => !t.deleted);
        // Apply discipline filter
        if (_tlDiscFilter) tasks = tasks.filter(t => t.discipline === _tlDiscFilter);
        const milestones = p.milestones || [];
        const header     = _projectRowHtml(p, totalDays, true);

        // Milestone sub-groups
        const msGroupRows = milestones.map(ms => {
          const msTasks  = tasks.filter(t => t.milestone_id === ms.id);
          const msHeader = _milestoneRowHtml(p, ms, totalDays, true);
          const taskRows = msTasks.map(t => _taskRowHtml(p, ms, t, totalDays)).join('');
          return msHeader + taskRows;
        }).join('');

        // Unassigned tasks
        const unassigned    = tasks.filter(t => !t.milestone_id);
        const unassignedRows = unassigned.map(t => _taskRowHtml(p, null, t, totalDays)).join('');

        return unassigned.length > 0
          ? header + msGroupRows + unassignedRows
          : header + msGroupRows;
      }).join('');
    }

    chart.innerHTML = `
      <div class="tl-header-row">
        <div class="tl-label-header">Project / Milestone / Task</div>
        <div class="tl-months">${monthCells}</div>
      </div>
      <div class="tl-rows-container">
        <div class="tl-today-line-container">
          ${todayX !== null
            ? `<div class="tl-today-line" id="tl-today-line" style="left:${todayX.toFixed(4)}%"></div>`
            : ''}
        </div>
        ${rowsHtml || `<div class="tl-empty"><i class="fa fa-chart-gantt" style="font-size:2em;margin-bottom:12px;display:block"></i>No active projects with date ranges.<br>Set start &amp; end dates on your projects to see them on the timeline.</div>`}
      </div>`;

    // Click: project label → open project; task label → open detail panel
    chart.querySelectorAll('.tl-row[data-tl-proj]').forEach(row => {
      row.addEventListener('click', function (e) {
        const pid = this.dataset.tlProj;
        const tid = this.dataset.tlTask;
        if (!pid) return;
        window.openProject(pid);
        if (tid) {
          setTimeout(() => {
            if (typeof window.openDetailPanel === 'function') window.openDetailPanel(pid, tid);
          }, 60);
        } else if (this.dataset.tlMs) {
          setTimeout(() => {
            if (typeof window.switchProjectTab === 'function') window.switchProjectTab('milestones');
          }, 60);
        }
      });
    });
  }

  // ─── Row builders ─────────────────────────────────────────
  function _projectRowHtml(p, totalDays, dimmed) {
    const color   = p.color || '#6366f1';
    const tasks   = (p.tasks || []).filter(t => !t.deleted);
    const done    = tasks.filter(t => t.status === 'done').length;
    const pct     = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;
    const barHtml = (p.start_date && p.end_date)
      ? _barHtml(p.start_date, p.end_date, color, esc(p.name), totalDays, 'tl-bar-project')
      : `<div class="tl-no-date"><span>Set start &amp; end dates</span></div>`;
    // Milestone deadline overlays shown only at the Projects level (not when dimmed/child)
    const msOverlays = !dimmed ? (p.milestones || []).map(ms => {
      const endX = _dateX(ms.end_date || ms.start_date, totalDays);
      if (endX === null || endX < 0 || endX > 100) return '';
      const msColor = ms.color || color;
      return `<div class="tl-ms-overlay" style="left:${endX.toFixed(3)}%;border-color:${msColor}" title="${esc(ms.title)}: ${ms.end_date || ms.start_date || ''}"><span class="tl-ms-overlay-label" style="color:${msColor}">${esc(ms.title)}</span></div>`;
    }).join('') : '';
    return `
      <div class="tl-row tl-row-project" data-tl-proj="${p.id}">
        <div class="tl-row-label">
          <span class="tl-row-icon">${p.icon || '📁'}</span>
          <div class="tl-row-info">
            <span class="tl-row-name">${esc(p.name)}</span>
            <span class="tl-row-meta">${pct}% done · ${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="tl-row-chart">${barHtml}${msOverlays}</div>
      </div>`;
  }

  function _milestoneRowHtml(p, ms, totalDays, dimmed) {
    const color   = ms.color || p.color || '#6366f1';
    const tasks   = ((window.getProject(p.id) || {}).tasks || []).filter(t => !t.deleted && t.milestone_id === ms.id);
    const barHtml = _milestoneBarOrPin(ms, p, totalDays);
    return `
      <div class="tl-row tl-row-milestone" data-tl-proj="${p.id}" data-tl-ms="${ms.id}">
        <div class="tl-row-label tl-indent-1">
          <span class="ms-color-dot" style="background:${esc(color)}"></span>
          <div class="tl-row-info">
            <span class="tl-row-name">${esc(ms.title)}</span>
            <span class="tl-row-meta">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="tl-row-chart">${barHtml}</div>
      </div>`;
  }

  function _taskRowHtml(p, ms, t, totalDays) {
    const color      = ms ? (ms.color || p.color || '#6366f1') : (p.color || '#6366f1');
    const assignee   = _getAssigneeName(t.assignee);
    let chartContent = '';

    if (t.due_date) {
      const x = _dateX(t.due_date, totalDays);
      chartContent = x !== null
        ? `<div class="tl-task-marker" style="left:calc(${x.toFixed(4)}% - 7px);background:${esc(color)}" title="${esc(t.title)}"></div>`
        : `<div class="tl-no-date"><span>Outside ${_year}</span></div>`;
    } else {
      chartContent = `<div class="tl-no-date"><span>No due date</span></div>`;
    }

    return `
      <div class="tl-row tl-row-task" data-tl-proj="${p.id}" data-tl-task="${t.id}">
        <div class="tl-row-label tl-indent-2">
          <span class="badge badge-status-${t.status} tl-status-dot"></span>
          <div class="tl-row-info">
            <span class="tl-row-name tl-task-name">${esc(t.title)}</span>
            ${assignee ? `<span class="tl-assignee-chip">${esc(assignee)}</span>` : ''}
          </div>
        </div>
        <div class="tl-row-chart">${chartContent}</div>
      </div>`;
  }

  // ─── Milestone bar or pin (handles narrow/single-day milestones) ───
  function _milestoneBarOrPin(ms, p, totalDays) {
    const color = ms.color || p.color || '#6366f1';
    const label = esc(ms.title);
    if (!ms.start_date) {
      return `<div class="tl-no-date"><span>No dates set</span></div>`;
    }
    // Single-day milestone (no end date or end === start)
    if (!ms.end_date || ms.end_date === ms.start_date) {
      const x = _dateX(ms.start_date, totalDays);
      if (x === null || x < 0 || x > 100) return `<div class="tl-no-date"><span>Outside ${_year}</span></div>`;
      return `<div class="tl-ms-pin" style="left:${x.toFixed(3)}%;background:${color}" title="${label} (${ms.start_date})"><span class="tl-ms-pin-label" style="color:${color}">${label}</span></div>`;
    }
    // Multi-day — check how wide the bar would be
    const x1    = _dateX(ms.start_date, totalDays);
    const x2    = _dateX(ms.end_date,   totalDays);
    const left  = x1 !== null ? Math.max(0, x1) : 0;
    const right = x2 !== null ? Math.min(100, x2) : 100;
    const width = right - left;
    if (width < 1.2) {
      // Too narrow to show a readable bar — use the pin marker instead
      const x = _dateX(ms.start_date, totalDays);
      if (x === null || x < 0 || x > 100) return `<div class="tl-no-date"><span>Outside ${_year}</span></div>`;
      return `<div class="tl-ms-pin" style="left:${x.toFixed(3)}%;background:${color}" title="${label} (${ms.start_date} – ${ms.end_date})"><span class="tl-ms-pin-label" style="color:${color}">${label}</span></div>`;
    }
    return _barHtml(ms.start_date, ms.end_date, color, label, totalDays, 'tl-bar-milestone');
  }

  // ─── Bar builder ──────────────────────────────────────────
  function _barHtml(startDate, endDate, color, label, totalDays, extraClass) {
    const x1 = _dateX(startDate, totalDays);
    const x2 = _dateX(endDate,   totalDays);
    // Allow bars that start before or end after the year — clamp to 0–100
    const left  = x1 !== null ? Math.max(0,   x1) : 0;
    const right = x2 !== null ? Math.min(100, x2) : 100;
    const width = Math.max(0.5, right - left);
    return `<div class="tl-bar ${extraClass || ''}" style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%;background:${color}" title="${label}">
      <span class="tl-bar-label">${label}</span>
    </div>`;
  }

  // ─── Date math ────────────────────────────────────────────
  function _dateX(dateStr, totalDays) {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d)) return null;
      const start     = new Date(_year, 0, 1);
      const dayOfYear = Math.floor((d - start) / 86400000);
      return dayOfYear / totalDays * 100;
    } catch (_) { return null; }
  }

  function _getTodayX(totalDays) {
    const today = new Date();
    if (today.getFullYear() !== _year) return null;
    const start     = new Date(_year, 0, 1);
    const dayOfYear = Math.floor((today - start) / 86400000);
    return dayOfYear / totalDays * 100;
  }

  function _scrollToToday() {
    const line = document.getElementById('tl-today-line');
    if (line) line.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  // ─── Assignee name lookup ──────────────────────────────────
  function _getAssigneeName(assigneeId) {
    if (!assigneeId) return null;
    if (window.appData.currentUser && window.appData.currentUser.id === assigneeId)
      return window.appData.currentUser.name;
    if (_usersCache) {
      const u = _usersCache.find(u => u.id === assigneeId);
      return u ? u.name : assigneeId;
    }
    return assigneeId; // fallback until cache loads
  }

  function _fetchUsers() {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => {
        _usersCache = Array.isArray(data) ? data : (data.users || []);
        // Re-render if timeline is currently visible
        if (window.currentView === 'timeline') window.renderTimeline();
      })
      .catch(() => { _usersCache = []; });
  }

  // Allow external modules to seed the cache
  window.tlSetUsersCache = function (users) { _usersCache = users; };
})();
