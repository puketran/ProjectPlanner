// ============================================================
// timeline.js — Multi-level Gantt / macro plan view
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS_IN  = [31,28,31,30,31,30,31,31,30,31,30,31];

  let _year  = new Date().getFullYear();
  let _level = 0; // 0 = Projects, 1 = Milestones, 2 = Tasks, 3 = By Users
  let _tlDiscFilters = new Set(); // multi-select disciplines for Tasks level (empty = All)
  let _tlUserFilters = new Set(); // multi-select users for By Users level (empty = All)
  let _collapsedProjects = new Set(); // project IDs collapsed in Milestones view (level 1)

  const TL_COLORS = ['#6366f1','#8b5cf6','#ec4899','#22c55e','#f97316','#06b6d4','#eab308','#ef4444','#14b8a6','#3b82f6'];

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
        <button class="tl-level-btn${_level === 3 ? ' active' : ''}" data-lvl="3">
          <i class="fa fa-users"></i> By Users
        </button>
      </div>
      <div class="tl-toolbar-right"></div>`;

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
        _tlDiscFilters = new Set(); // reset filter on level change
        _tlUserFilters = new Set();
        _collapsedProjects = new Set();
        window.renderTimeline();
      });
    });

    // Discipline filter pills — only for Tasks level (2)
    if (_level === 2) {
      const allProjects = window.getUserProjects('active');
      const allTasks    = allProjects.flatMap(p => (p.tasks || []).filter(t => !t.deleted));
      const usedDiscs   = [...new Set(allTasks.map(t => t.discipline).filter(Boolean))];
      if (usedDiscs.length > 0) {
        const pillsHtml = `<div class="tl-disc-pills">${
          ['All', ...usedDiscs].map(d => {
            const isAll   = d === 'All';
            const active  = isAll ? _tlDiscFilters.size === 0 : _tlDiscFilters.has(d);
            const color   = (!isAll && typeof window.getDiscColor === 'function') ? window.getDiscColor(d) : '#6366f1';
            return `<button class="dp-pill tl-disc-pill${active ? ' active' : ''}" data-disc="${d}" style="${active && !isAll ? 'background:' + color + ';color:#fff;border-color:transparent;' : ''}">${d}</button>`;
          }).join('')
        }</div>`;
        toolbar.insertAdjacentHTML('beforeend', pillsHtml);
        toolbar.querySelectorAll('.tl-disc-pill').forEach(btn => {
          btn.addEventListener('click', function () {
            if (this.dataset.disc === 'All') {
              _tlDiscFilters = new Set();
            } else {
              if (_tlDiscFilters.has(this.dataset.disc)) {
                _tlDiscFilters.delete(this.dataset.disc);
              } else {
                _tlDiscFilters.add(this.dataset.disc);
              }
            }
            window.renderTimeline();
          });
        });
      }
    }

    // User filter pills — only for By Users level (3)
    if (_level === 3) {
      const users = _usersCache || [];
      if (users.length > 0) {
        const pillsHtml = `<div class="tl-disc-pills">${
          ['All', ...users].map(u => {
            const isAll  = u === 'All';
            const uid    = isAll ? 'All' : u.id;
            const label  = isAll ? 'All' : (u.name || u.id);
            const active = isAll ? _tlUserFilters.size === 0 : _tlUserFilters.has(uid);
            return `<button class="dp-pill tl-disc-pill${active ? ' active' : ''}" data-user="${uid}">${esc(label)}</button>`;
          }).join('')
        }</div>`;
        toolbar.insertAdjacentHTML('beforeend', pillsHtml);
        toolbar.querySelectorAll('[data-user]').forEach(btn => {
          btn.addEventListener('click', function () {
            if (this.dataset.user === 'All') {
              _tlUserFilters = new Set();
            } else {
              if (_tlUserFilters.has(this.dataset.user)) {
                _tlUserFilters.delete(this.dataset.user);
              } else {
                _tlUserFilters.add(this.dataset.user);
              }
            }
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
        if (_collapsedProjects.has(p.id)) return header; // collapsed — only show project header
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
    } else if (_level === 2) {
      rowsHtml = projects.map(p => {
        let tasks      = (p.tasks || []).filter(t => !t.deleted);
        // Apply multi-discipline filter
        if (_tlDiscFilters.size > 0) tasks = tasks.filter(t => _tlDiscFilters.has(t.discipline));
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
    } else {
      // Level 3 — By Users
      const allProjects = window.getUserProjects('active');
      const allTasks    = allProjects.flatMap(p =>
        (p.tasks || []).filter(t => !t.deleted).map(t => ({ ...t, _proj: p }))
      );
      // Collect all unique assignees present in tasks
      let userIds = [...new Set(allTasks.map(t => t.assignee).filter(Boolean))];
      // Apply user filter
      if (_tlUserFilters.size > 0) userIds = userIds.filter(uid => _tlUserFilters.has(uid));

      rowsHtml = userIds.map(uid => {
        const name    = _getAssigneeName(uid);
        const uTasks  = allTasks.filter(t => t.assignee === uid);
        const done    = uTasks.filter(t => t.status === 'done').length;
        const pct     = uTasks.length ? Math.round(done / uTasks.length * 100) : 0;
        const header  = `
          <div class="tl-row tl-row-user-header" data-tl-user="${esc(uid)}">
            <div class="tl-row-label">
              <span class="tl-row-icon"><i class="fa fa-circle-user"></i></span>
              <div class="tl-row-info">
                <span class="tl-row-name">${esc(name)}</span>
                <span class="tl-row-meta">${pct}% done · ${uTasks.length} task${uTasks.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div class="tl-row-chart tl-no-date-row"></div>
          </div>`;
        const taskRows = uTasks.map(t => _taskRowHtml(t._proj, null, t, totalDays)).join('');
        return header + taskRows;
      }).join('') || `<div class="tl-empty"><i class="fa fa-users" style="font-size:2em;margin-bottom:12px;display:block"></i>No assigned tasks found.</div>`;
    }

    chart.innerHTML = `
      <div class="tl-header-row">
        <div class="tl-label-header">${_level === 3 ? 'User / Task' : 'Project / Milestone / Task'}</div>
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

    // Click on bars → open timeline popup
    chart.querySelectorAll('.tl-bar, .tl-task-marker, .tl-ms-pin').forEach(el => {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        // Element may have its own data attributes OR we traverse to row
        const pid = this.dataset.tlProj || this.closest('.tl-row')?.dataset.tlProj;
        const tid = this.dataset.tlTask || this.closest('.tl-row')?.dataset.tlTask;
        const mid = this.closest('.tl-row')?.dataset.tlMs;
        if (!pid) return;
        if (tid) _openTlPopup(pid, tid, null, e);
        else if (mid) _openTlPopup(pid, null, mid, e);
      });
    });

    // Collapsible project rows (Milestones view, level 1)
    chart.querySelectorAll('.tl-collapse-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pid = btn.dataset.togglePid;
        if (_collapsedProjects.has(pid)) _collapsedProjects.delete(pid);
        else _collapsedProjects.add(pid);
        window.renderTimeline();
      });
    });

    // Click: row label → open project / detail panel (non-bar click)
    chart.querySelectorAll('.tl-row[data-tl-proj]').forEach(row => {
      row.querySelector('.tl-row-label')?.addEventListener('click', function (e) {
        const pid = row.dataset.tlProj;
        const tid = row.dataset.tlTask;
        if (!pid) return;
        window.openProject(pid);
        if (tid) {
          setTimeout(() => {
            if (typeof window.openDetailPanel === 'function') window.openDetailPanel(pid, tid);
          }, 60);
        } else if (row.dataset.tlMs) {
          setTimeout(() => {
            if (typeof window.switchProjectTab === 'function') window.switchProjectTab('milestones');
          }, 60);
        }
      });
    });
  }

  // ─── Timeline bar popup ───────────────────────────────────
  function _openTlPopup(projectId, taskId, msId, triggerEvent) {
    // Remove any existing popup
    const old = document.getElementById('tl-bar-popup');
    if (old) old.remove();

    const proj = window.getProject(projectId);
    if (!proj) return;

    let html = '';
    let popupColor = '#6366f1';

    if (taskId) {
      const task = (proj.tasks || []).find(t => t.id === taskId);
      if (!task) return;
      popupColor = task.discipline && typeof window.getDiscColor === 'function'
        ? window.getDiscColor(task.discipline) : (proj.color || '#6366f1');
      const ms    = task.milestone_id ? (proj.milestones || []).find(m => m.id === task.milestone_id) : null;
      const users = _usersCache || [];
      const statuses = ['todo', 'in-progress', 'blocked', 'done'];
      const SL = { 'todo':'Todo','in-progress':'In Progress','blocked':'Blocked','done':'Done' };
      const assigneeName = _getAssigneeName(task.assignee);
      html = `
        <div class="tl-popup-header" style="--popup-color:${popupColor}">
          <span class="tl-popup-type"><i class="fa fa-list-check"></i> Task</span>
          <button class="tl-popup-close icon-btn" id="tl-popup-close-btn"><i class="fa fa-xmark"></i></button>
        </div>
        <div class="tl-popup-body">
          <div class="tl-popup-field">
            <label>Title</label>
            <input class="tl-popup-input" id="tlp-title" value="${esc(task.title)}" placeholder="Task title">
          </div>
          <div class="tl-popup-row2">
            <div class="tl-popup-field">
              <label>Status</label>
              <select class="tl-popup-select" id="tlp-status">
                ${statuses.map(s => `<option value="${s}"${task.status===s?' selected':''}>${SL[s]}</option>`).join('')}
              </select>
            </div>
            <div class="tl-popup-field">
              <label>Discipline</label>
              <input class="tl-popup-input" id="tlp-discipline" value="${esc(task.discipline||'')}" placeholder="e.g. Dev, Art">
            </div>
          </div>
          <div class="tl-popup-row2">
            <div class="tl-popup-field">
              <label>Start date</label>
              <input class="tl-popup-input" type="date" id="tlp-start" value="${task.start_date||''}">
            </div>
            <div class="tl-popup-field">
              <label>Due date</label>
              <input class="tl-popup-input" type="date" id="tlp-due" value="${task.due_date||''}">
            </div>
          </div>
          <div class="tl-popup-field">
            <label>Assignee</label>
            <select class="tl-popup-select" id="tlp-assignee">
              <option value="">Unassigned</option>
              ${users.map(u => `<option value="${esc(u.id)}"${task.assignee===u.id?' selected':''}>${esc(u.name||u.id)}</option>`).join('')}
              ${task.assignee && !users.find(u=>u.id===task.assignee) ? `<option value="${esc(task.assignee)}" selected>${esc(assigneeName)}</option>` : ''}
            </select>
          </div>
          ${ms ? `<div class="tl-popup-field"><label>Milestone</label><span class="tl-popup-meta">${esc(ms.title)}</span></div>` : ''}
          <div class="tl-popup-field">
            <label>Description</label>
            <textarea class="tl-popup-textarea" id="tlp-desc" rows="2" placeholder="Description…">${esc(task.description||'')}</textarea>
          </div>
        </div>
        <div class="tl-popup-footer">
          <button class="btn btn-primary btn-sm" id="tlp-save-btn">Save</button>
          <button class="btn btn-ghost btn-sm" id="tlp-open-btn"><i class="fa fa-arrow-up-right-from-square"></i> Open</button>
        </div>`;

      const popup = _createPopupEl(html, triggerEvent);
      document.body.appendChild(popup);

      popup.querySelector('#tl-popup-close-btn').onclick = () => popup.remove();
      popup.querySelector('#tlp-open-btn').onclick = () => {
        popup.remove();
        window.openProject(projectId);
        setTimeout(() => {
          if (typeof window.openDetailPanel === 'function') window.openDetailPanel(projectId, taskId);
        }, 60);
      };
      popup.querySelector('#tlp-save-btn').onclick = () => {
        if (typeof window.pushUndo === 'function') window.pushUndo(projectId);
        task.title       = popup.querySelector('#tlp-title').value.trim() || task.title;
        task.status      = popup.querySelector('#tlp-status').value;
        task.discipline  = popup.querySelector('#tlp-discipline').value.trim() || task.discipline;
        task.start_date  = popup.querySelector('#tlp-start').value || null;
        task.due_date    = popup.querySelector('#tlp-due').value || null;
        task.assignee    = popup.querySelector('#tlp-assignee').value || null;
        task.description = popup.querySelector('#tlp-desc').value;
        task.updated_at  = typeof window.isoNow === 'function' ? window.isoNow() : new Date().toISOString();
        window.saveData();
        window.renderTimeline();
        popup.remove();
      };

    } else if (msId) {
      const ms = (proj.milestones || []).find(m => m.id === msId);
      if (!ms) return;
      popupColor = ms.color || proj.color || '#6366f1';
      const tasks        = (proj.tasks || []).filter(t => !t.deleted && t.milestone_id === ms.id);
      const done         = tasks.filter(t => t.status === 'done').length;
      const pct          = tasks.length ? Math.round(done / tasks.length * 100) : 0;
      const deliverables = ms.deliverables || [];
      html = `
        <div class="tl-popup-header" style="--popup-color:${popupColor}">
          <span class="tl-popup-type"><i class="fa fa-flag"></i> Milestone</span>
          <button class="tl-popup-close icon-btn" id="tl-popup-close-btn"><i class="fa fa-xmark"></i></button>
        </div>
        <div class="tl-popup-body">
          <div class="tl-popup-field">
            <label>Title</label>
            <input class="tl-popup-input" id="tlp-ms-title" value="${esc(ms.title)}" placeholder="Milestone title">
          </div>
          <div class="tl-popup-field">
            <label>Color</label>
            <div class="tl-popup-color-row" id="tlp-ms-colors">
              ${TL_COLORS.map(c => `<div class="tl-popup-swatch${(ms.color||TL_COLORS[0])===c?' selected':''}" data-color="${c}" style="background:${c}" title="${c}"></div>`).join('')}
            </div>
          </div>
          <div class="tl-popup-row2">
            <div class="tl-popup-field">
              <label>Start date</label>
              <input class="tl-popup-input" type="date" id="tlp-ms-start" value="${ms.start_date||''}">
            </div>
            <div class="tl-popup-field">
              <label>End date</label>
              <input class="tl-popup-input" type="date" id="tlp-ms-end" value="${ms.end_date||''}">
            </div>
          </div>
          ${ms.description ? `<div class="tl-popup-field"><label>Description</label><p class="tl-popup-meta">${esc(ms.description)}</p></div>` : ''}
          ${deliverables.length ? `
          <div class="tl-popup-field">
            <label>Deliverables <span style="font-weight:400;color:var(--text-muted)">${deliverables.filter(d=>d.done).length}/${deliverables.length} done</span></label>
            <div class="tl-popup-dl-list">
              ${deliverables.map(d => `
                <label class="tl-popup-dl-row">
                  <input type="checkbox" ${d.done?'checked':''} data-dl-id="${esc(d.id)}">
                  <span class="${d.done?'tl-dl-done':''}">${esc(d.text)}</span>
                </label>`).join('')}
            </div>
          </div>` : ''}
          <div class="tl-popup-field">
            <label>Progress</label>
            <div class="tl-popup-progress">
              <div class="tl-popup-prog-fill" style="width:${pct}%;background:${popupColor}"></div>
            </div>
            <span class="tl-popup-meta">${pct}% · ${done}/${tasks.length} tasks done</span>
          </div>
        </div>
        <div class="tl-popup-footer">
          <button class="btn btn-primary btn-sm" id="tlp-ms-save-btn">Save</button>
          <button class="btn btn-ghost btn-sm" id="tlp-ms-open-btn"><i class="fa fa-arrow-up-right-from-square"></i> Open</button>
        </div>`;

      const popup = _createPopupEl(html, triggerEvent);
      document.body.appendChild(popup);

      popup.querySelector('#tl-popup-close-btn').onclick = () => popup.remove();

      // Color swatch selection
      popup.querySelectorAll('.tl-popup-swatch').forEach(sw => {
        sw.addEventListener('click', function () {
          popup.querySelectorAll('.tl-popup-swatch').forEach(s => s.classList.remove('selected'));
          this.classList.add('selected');
          const hdr = popup.querySelector('.tl-popup-header');
          if (hdr) hdr.style.setProperty('--popup-color', this.dataset.color);
        });
      });

      // Deliverable check/uncheck — save immediately
      popup.querySelectorAll('.tl-popup-dl-row input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', function () {
          const dl = (ms.deliverables||[]).find(d => d.id === this.dataset.dlId);
          if (dl) {
            dl.done = this.checked;
            ms.updated_at = typeof window.isoNow==='function' ? window.isoNow() : new Date().toISOString();
            window.saveData();
            const lbl = this.closest('label')?.querySelector('span');
            if (lbl) lbl.className = this.checked ? 'tl-dl-done' : '';
          }
        });
      });

      popup.querySelector('#tlp-ms-open-btn').onclick = () => {
        popup.remove();
        window.openProject(projectId);
        setTimeout(() => {
          if (typeof window.switchProjectTab === 'function') window.switchProjectTab('milestones');
        }, 60);
      };
      popup.querySelector('#tlp-ms-save-btn').onclick = () => {
        if (typeof window.pushUndo === 'function') window.pushUndo(projectId);
        ms.title      = popup.querySelector('#tlp-ms-title').value.trim() || ms.title;
        ms.start_date = popup.querySelector('#tlp-ms-start').value || null;
        ms.end_date   = popup.querySelector('#tlp-ms-end').value || null;
        ms.color      = popup.querySelector('.tl-popup-swatch.selected')?.dataset.color || ms.color;
        ms.updated_at = typeof window.isoNow === 'function' ? window.isoNow() : new Date().toISOString();
        window.saveData();
        window.renderTimeline();
        popup.remove();
      };
    }
  }

  function _createPopupEl(html, triggerEvent) {
    const popup = document.createElement('div');
    popup.id    = 'tl-bar-popup';
    popup.className = 'tl-bar-popup';
    popup.innerHTML = html;

    // Position near cursor, keeping inside viewport
    document.body.appendChild(popup); // temporary attach to measure
    const pw = popup.offsetWidth  || 320;
    const ph = popup.offsetHeight || 300;
    document.body.removeChild(popup);

    const vw = window.innerWidth, vh = window.innerHeight;
    let x = triggerEvent ? triggerEvent.clientX + 12 : vw / 2 - pw / 2;
    let y = triggerEvent ? triggerEvent.clientY + 12 : vh / 2 - ph / 2;
    if (x + pw > vw - 16) x = Math.max(8, vw - pw - 16);
    if (y + ph > vh - 16) y = Math.max(8, vh - ph - 16);
    popup.style.left = x + 'px';
    popup.style.top  = y + 'px';

    // Close on outside click
    const outsideHandler = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('mousedown', outsideHandler, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', outsideHandler, true), 0);
    return popup;
  }

  // ─── Row builders ─────────────────────────────────────────
  function _projectRowHtml(p, totalDays, dimmed) {
    const color       = p.color || '#6366f1';
    const tasks       = (p.tasks || []).filter(t => !t.deleted);
    const done        = tasks.filter(t => t.status === 'done').length;
    const pct         = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;
    const barHtml     = (p.start_date && p.end_date)
      ? _barHtml(p.start_date, p.end_date, color, esc(p.name), totalDays, 'tl-bar-project')
      : `<div class="tl-no-date"><span>Set start &amp; end dates</span></div>`;
    // Milestone deadline overlays shown only at the Projects level (not when dimmed/child)
    const msOverlays = !dimmed ? (p.milestones || []).map(ms => {
      const endX = _dateX(ms.end_date || ms.start_date, totalDays);
      if (endX === null || endX < 0 || endX > 100) return '';
      const msColor = ms.color || color;
      return `<div class="tl-ms-overlay" style="left:${endX.toFixed(3)}%;border-color:${msColor}" title="${esc(ms.title)}: ${ms.end_date || ms.start_date || ''}"><span class="tl-ms-overlay-label" style="color:${msColor}">${esc(ms.title)}</span></div>`;
    }).join('') : '';
    const isCollapsed = _level === 1 && _collapsedProjects.has(p.id);
    const collapseBtn = _level === 1
      ? `<button class="tl-collapse-btn${isCollapsed?' tl-collapsed':''}" data-toggle-pid="${esc(p.id)}" title="${isCollapsed?'Expand':'Collapse'}"><i class="fa fa-chevron-down"></i></button>`
      : '';
    return `
      <div class="tl-row tl-row-project" data-tl-proj="${p.id}">
        <div class="tl-row-label">
          ${collapseBtn}
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
      chartContent = x !== null && x >= 0 && x <= 100
        ? `<div class="tl-task-marker" data-tl-proj="${p.id}" data-tl-task="${t.id}" style="left:calc(${x.toFixed(4)}% - 7px);background:${esc(color)}" title="${esc(t.title)}"></div>`
        : `<div class="tl-no-date"><span>Outside ${_year}</span></div>`;
    } else {
      chartContent = `<div class="tl-no-date"><span>No due date</span></div>`;
    }

    const projMini = _level === 3
      ? `<span class="tl-proj-mini" style="--proj-color:${p.color||'#6366f1'}">${esc(p.name.length > 13 ? p.name.slice(0, 13) + '…' : p.name)}</span>`
      : '';
    return `
      <div class="tl-row tl-row-task" data-tl-proj="${p.id}" data-tl-task="${t.id}">
        <div class="tl-row-label tl-indent-2">
          <span class="badge badge-status-${t.status} tl-status-dot"></span>
          <div class="tl-row-info">
            ${projMini}
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
