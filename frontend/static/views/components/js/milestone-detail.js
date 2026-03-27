// ============================================================
// milestone-detail.js — Milestone inline sub-view (Gantt + task list)
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const SC = { 'todo':'#6b7280','in-progress':'#3b82f6','blocked':'#ef4444','done':'#22c55e' };
  const SL = { 'todo':'Todo','in-progress':'In Progress','blocked':'Blocked','done':'Done' };
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Module-level deliverable drag state (readable during dragover)
  let _activeDlDrag = null; // { dlId, fromMsId, projId }

  /** Derive short discipline abbreviation */
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

  function _fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric'});
  }

  /** Compute deliverable done state — auto-derived from linked tasks if any */
  function _dlDone(dl, tasks) {
    if (!dl.task_ids || dl.task_ids.length === 0) return !!dl.done;
    return dl.task_ids.every(id => {
      const t = tasks.find(t => t.id === id);
      return t && t.status === 'done';
    });
  }

  // ─── Public API ───────────────────────────────────────────
  // targetEl = the inline panel div; if omitted, falls back to #msd-inner-{msId}
  window.openMilestoneDetail = function (projectId, msId, targetEl) {
    const proj = window.getProject(projectId);
    if (!proj) return;
    const ms = (proj.milestones || []).find(m => m.id === msId);
    if (!ms) return;
    const el = targetEl || document.getElementById('msd-inner-' + msId);
    if (!el) return;
    _render(el, proj, ms, projectId);
  };

  // Backward compat — hides old overlay if it is still in DOM
  window.closeMilestoneDetail = function () {
    const o = document.getElementById('milestone-detail-overlay');
    if (o) { o.classList.add('hidden'); o.classList.remove('open'); }
  };

  // ─── Main render ──────────────────────────────────────────
  function _render(el, proj, ms, projectId) {
    const color   = ms.color || '#6366f1';
    const tasks   = (proj.tasks || []).filter(t => !t.deleted && t.milestone_id === ms.id);
    const done    = tasks.filter(t => t.status === 'done').length;
    const blocked = tasks.filter(t => t.status === 'blocked').length;
    const pct     = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;

    const msStart = ms.start_date ? new Date(ms.start_date + 'T00:00:00') : null;
    const msEnd   = ms.end_date   ? new Date(ms.end_date   + 'T00:00:00') : null;
    const totalMs = (msStart && msEnd && msEnd > msStart) ? msEnd - msStart : null;

    // View mode: 'full' (ms range) or 'crop' (today → end). Preserved across re-renders.
    const mode    = el.dataset.msdMode || 'full';
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    let viewStart = msStart;
    let viewTotal = totalMs;
    if (mode === 'crop' && msStart && msEnd) {
      const vs = today > msStart ? today : msStart;
      const vt = msEnd - vs;
      if (vt > 0) { viewStart = vs; viewTotal = vt; }
    }
    // Add 12% trailing buffer so bars near the right edge show their labels
    if (viewTotal) viewTotal = viewTotal * 1.12;

    const sortedTasks = _topoSort(tasks);
    const taskIds     = new Set(tasks.map(t => t.id));

    // Bottleneck detection – visible only when viewing tasks
    const overlaps   = viewTotal ? _detectBottlenecks(tasks, viewStart, viewTotal) : [];
    const overlapIds = new Set(overlaps.flatMap(o => [o.taskIdA, o.taskIdB]));

    // Deliverables & task highlight filter
    const deliverables = ms.deliverables || [];
    const _isLate = t => t.due_date && t.status !== 'done' && new Date(t.due_date + 'T00:00:00') < today;
    const highlightIds = new Set(sortedTasks.filter(t => t.status === 'blocked' || overlapIds.has(t.id) || _isLate(t)).map(t => t.id));
    const taskFilter   = el.dataset.msdTaskFilter || (highlightIds.size > 0 ? 'highlights' : 'all');
    const displayTasks = (taskFilter === 'highlights' && highlightIds.size > 0) ? sortedTasks.filter(t => highlightIds.has(t.id)) : sortedTasks;

    // Bottleneck stripes (rendered behind bars)
    const bnHtml = overlaps.map(o =>
      `<div class="msd-bn-stripe" style="left:${Math.max(0,o.left).toFixed(2)}%;width:${(o.right-o.left).toFixed(2)}%" title="Bottleneck: overlapping tasks"></div>`
    ).join('');

    el.innerHTML = `
      <div class="msd-inline-panel" style="--msd-color:${color}">

        <div class="msd-inline-header">
          <div class="msd-inline-stats">
            <span class="msd-stat-pill msd-sp-todo">${tasks.filter(t=>t.status==='todo').length} Todo</span>
            <span class="msd-stat-pill msd-sp-ip">${tasks.filter(t=>t.status==='in-progress').length} In&nbsp;Progress</span>
            ${blocked ? `<span class="msd-stat-pill msd-sp-blocked"><i class="fa fa-triangle-exclamation"></i> ${blocked} Blocked</span>` : ''}
            ${overlaps.length ? `<span class="msd-stat-pill msd-sp-bottle"><i class="fa fa-code-branch"></i> ${overlaps.length} Bottleneck${overlaps.length>1?'s':''}</span>` : ''}
            <span class="msd-stat-pill msd-sp-done">${done} Done</span>
            <span class="msd-stat-sep"></span>
            <span class="msd-stat-pct" style="color:${color}">${pct}%</span>
          </div>
          <div class="msd-prog-track"><div class="msd-prog-fill" style="width:${pct}%;background:${color}"></div></div>
          ${ms.description ? `<p class="msd-inline-desc">${esc(ms.description)}</p>` : ''}
        </div>

        ${viewTotal ? `
        <div class="msd-gantt">
          <div class="msd-gantt-toolbar">
            <span class="msd-gt-label"><i class="fa fa-chart-gantt"></i> Timeline</span>
            <div class="msd-dl-focus-indicator" style="display:none">
              <span class="msd-dl-focus-name"></span>
              <button class="msd-dl-focus-clear icon-btn" title="Clear focus"><i class="fa fa-xmark"></i></button>
            </div>
            <div class="msd-zoom-controls">
              <button class="msd-zoom-btn" data-zoom-delta="-0.25" title="Zoom out"><i class="fa fa-magnifying-glass-minus"></i></button>
              <span class="msd-zoom-lvl">1×</span>
              <button class="msd-zoom-btn" data-zoom-delta="0.25" title="Zoom in"><i class="fa fa-magnifying-glass-plus"></i></button>
              <button class="msd-zoom-btn msd-zoom-reset" data-zoom-reset title="Fit view" style="display:none"><i class="fa fa-arrows-left-right-to-line"></i></button>
            </div>
            <div class="msd-mode-toggle">
              <button class="msd-mode-btn${mode==='full'?' msd-mode-active':''}" data-mode="full">Full range</button>
              <button class="msd-mode-btn${mode==='crop'?' msd-mode-active':''}" data-mode="crop">From today</button>
            </div>
          </div>
          <div class="msd-gantt-inner">
            <div class="msd-gantt-labels">
              <div class="msd-gl-hdr">Task</div>
              ${sortedTasks.map(t => {
                const abbr  = _discAbbrev(t.discipline);
                const dc    = t.discipline && typeof window.getDiscColor === 'function' ? window.getDiscColor(t.discipline) : '';
                const isOL  = overlapIds.has(t.id);
                return `<div class="msd-gl-row${t.status==='blocked'?' msd-gl-blocked':''}${isOL?' msd-gl-overlap':''}" data-task-id="${t.id}" title="${esc(t.title)}">
                  ${isOL ? `<i class="fa fa-exclamation msd-gl-bn-icon" title="Potential bottleneck"></i>` : ''}
                  ${abbr ? `<span class="msd-disc-tag" style="color:${dc}">[${esc(abbr)}]</span>` : ''}
                  <span class="msd-gl-title">${esc(t.title)}</span>
                </div>`;
              }).join('')}
            </div>
            <div class="msd-gantt-track" id="msd-track-${ms.id}">
              <div class="msd-gantt-track-inner" data-view-start="${viewStart.getTime()}" data-view-total="${viewTotal}">
                ${_monthHeaderHtml(viewStart, msEnd, viewTotal)}
                <div class="msd-week-hdr-slot"></div>
                <div class="msd-day-hdr-slot"></div>
                <div class="msd-bars-layer" id="msd-bars-${ms.id}">
                  ${bnHtml}
                  ${_todayLineHtml(viewStart, viewTotal, today)}
                  ${sortedTasks.map(t =>
                    `<div class="msd-bar-row" data-task-id="${t.id}">
                      ${_ghostBarsHtml(t, tasks, taskIds, ms, viewStart, viewTotal)}
                      ${_barHtml(t, ms, viewStart, viewTotal, overlapIds.has(t.id))}
                    </div>`
                  ).join('')}
                  <svg class="msd-dep-svg" id="msd-dep-svg-${ms.id}"></svg>
                </div>
              </div>
            </div>
          </div>
        </div>` : `
        <div class="msd-no-dates"><i class="fa fa-circle-info"></i> Add milestone start &amp; end dates to see the Gantt timeline.</div>`}

        <div class="msd-deliverables">
          <div class="msd-dl-hdr">
            <span><i class="fa fa-box-archive"></i> Deliverables${deliverables.length ? ` <span class="msd-dl-count">${deliverables.filter(d=>_dlDone(d,tasks)).length}/${deliverables.length} done</span>` : ''}</span>
            <button class="msd-dl-add icon-btn" title="Add deliverable"><i class="fa fa-plus"></i></button>
          </div>
          <div class="msd-dl-items" data-ms-id="${esc(ms.id)}">
            ${deliverables.map(d => {
              const isDone    = _dlDone(d, tasks);
              const linked    = (d.task_ids||[]).map(id => tasks.find(t=>t.id===id)).filter(Boolean);
              const hasLinked = linked.length > 0;
              const orphan    = hasLinked && linked.every(t => t.status !== 'done') && !isDone;
              return `<div class="msd-dl-item${isDone?' msd-dl-done':''}${hasLinked?' msd-dl-linked':''}" data-dl-id="${esc(d.id)}" draggable="true">
                <span class="msd-dl-drag-handle" title="Drag to another milestone"><i class="fa fa-grip-vertical"></i></span>
                <span class="msd-dl-check-icon"><i class="fa ${isDone?'fa-circle-check':'fa-circle'}" style="color:${isDone?'#22c55e':'var(--text-muted)'}"></i></span>
                <div class="msd-dl-body" style="cursor:pointer">
                  <span class="msd-dl-text${isDone?' msd-dl-text-done':''}">${esc(d.text)}</span>
                  ${hasLinked ? `<div class="msd-dl-tasks">${linked.map(t=>`<span class="msd-dl-task-chip msd-dl-tc-${t.status}" title="${esc(t.title)}">${esc(t.title)}</span>`).join('')}</div>` : '<span style="font-size:11px;color:var(--text-muted)">(no tasks linked)</span>'}
                </div>
                ${hasLinked ? `<button class="msd-dl-focus-btn icon-btn" data-dl-id="${esc(d.id)}" data-dl-text="${esc(d.text)}" title="Focus in timeline"><i class="fa fa-crosshairs" style="font-size:11px"></i></button>` : ''}
                <button class="msd-dl-link-btn icon-btn" data-dl-id="${esc(d.id)}" title="Link tasks"><i class="fa fa-link" style="font-size:11px"></i></button>
                <button class="msd-dl-remove icon-btn" title="Remove"><i class="fa fa-xmark"></i></button>
              </div>`;
            }).join('') || '<p class="msd-dl-empty">No deliverables defined</p>'}
          </div>
          <div class="msd-dl-add-row" style="display:none">
            <input class="msd-dl-input form-input" placeholder="Deliverable name…" style="margin-bottom:6px">
            ${tasks.length > 0 ? `<div class="msd-dl-task-picker"><span class="msd-dl-picker-label">Link to tasks (auto-done when all linked tasks done):</span>${tasks.map(t=>`<label class="msd-dl-task-opt"><input type="checkbox" class="msd-dl-task-cb" value="${esc(t.id)}"><span class="msd-dl-task-opt-dot" style="background:${SC[t.status]||'#6b7280'}"></span>${esc(t.title)}</label>`).join('')}</div>` : ''}
            <div class="msd-dl-add-actions">
              <button class="msd-dl-submit btn btn-secondary btn-sm">Add</button>
              <button class="msd-dl-cancel btn btn-ghost btn-sm">Cancel</button>
            </div>
          </div>
          <div class="msd-dl-link-picker" style="display:none" data-for-dl="">
            <span class="msd-dl-picker-label">Select tasks to link:</span>
            ${tasks.map(t=>`<label class="msd-dl-task-opt"><input type="checkbox" class="msd-dl-link-cb" value="${esc(t.id)}"><span class="msd-dl-task-opt-dot" style="background:${SC[t.status]||'#6b7280'}"></span>${esc(t.title)}</label>`).join('')}
            <div class="msd-dl-add-actions">
              <button class="msd-dl-link-save btn btn-secondary btn-sm">Save links</button>
              <button class="msd-dl-link-cancel btn btn-ghost btn-sm">Cancel</button>
            </div>
          </div>
        </div>

        <div class="msd-task-list">
          <div class="msd-tl-hdr">
            <span><i class="fa fa-list-check"></i> ${tasks.length} Task${tasks.length!==1?'s':''}</span>
            ${highlightIds.size > 0 ? `
              <div class="msd-tl-filter-toggle">
                <button class="msd-tl-filter-btn${taskFilter==='highlights'?' active':''}" data-filter="highlights"><i class="fa fa-triangle-exclamation"></i> ${highlightIds.size} Alert${highlightIds.size>1?'s':''}</button>
                <button class="msd-tl-filter-btn${taskFilter==='all'?' active':''}" data-filter="all">All</button>
              </div>` : ''}
          </div>
          ${tasks.length===0
            ? '<p class="msd-empty">No tasks assigned to this milestone.</p>'
            : displayTasks.length === 0
              ? `<p class="msd-empty"><i class="fa fa-circle-check" style="color:#22c55e"></i> No blocked, late, or bottleneck tasks!</p>`
              : displayTasks.map(t => _taskRowHtml(t, proj)).join('')}
        </div>

      </div>`;

    _bindEvents(el, proj, ms, projectId);
    if (viewTotal) requestAnimationFrame(() => _drawDepArrows(el, ms.id, tasks));
    if (viewTotal) _bindZoom(el, ms, tasks);
    if (viewTotal) requestAnimationFrame(() => _applyDlFocus(el, ms));
  }

  // ─── Topological sort (prerequisites first) ──────────────
  function _topoSort(tasks) {
    if (!tasks.length) return tasks;
    const taskIds = new Set(tasks.map(t => t.id));
    const visited = new Set();
    const result  = [];
    // Queue starts with tasks that have no in-milestone prerequisites
    const queue = tasks.filter(t =>
      !(t.dependencies || []).some(d => taskIds.has(d.taskId))
    ).map(t => t.id);

    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const task = tasks.find(t => t.id === id);
      if (task) result.push(task);
      tasks.forEach(t => {
        if (visited.has(t.id)) return;
        const deps = (t.dependencies || []).filter(d => taskIds.has(d.taskId));
        if (deps.every(d => visited.has(d.taskId))) queue.push(t.id);
      });
    }
    tasks.forEach(t => { if (!visited.has(t.id)) result.push(t); });
    return result;
  }

  // ─── Month header ─────────────────────────────────────────
  function _monthHeaderHtml(viewStart, viewEnd, viewTotal) {
    const cells = [];
    const d = new Date(viewStart.getFullYear(), viewStart.getMonth(), 1);
    while (d <= viewEnd) {
      const mStart = Math.max(d.getTime(), viewStart.getTime());
      const nextM  = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const mEnd   = Math.min(nextM.getTime() - 1, viewEnd.getTime());
      const pct    = (mEnd - mStart + 86400000) / viewTotal * 100;
      if (pct > 0) cells.push(`<div class="msd-month-cell" style="width:${pct.toFixed(3)}%">${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()!==viewStart.getFullYear()?d.getFullYear():''}</div>`);
      d.setMonth(d.getMonth() + 1);
    }
    return `<div class="msd-month-hdr" data-hdr-type="month">${cells.join('')}</div>`;
  }

  // ─── Week header (shown at zoom ≥ 1.5 and ≤ 250 days) ────
  function _weekHeaderHtml(viewStart, viewTotal) {
    const DAY_MS  = 86400000;
    const WEEK_MS = 7 * DAY_MS;
    const totalDays = Math.ceil(viewTotal / DAY_MS);
    if (totalDays > 250) return '';
    const vs  = viewStart.getTime();
    const end = vs + viewTotal;
    // Find the Monday at or before viewStart
    const d = new Date(vs);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay(); // 0=Sun,1=Mon
    if (dow !== 1) d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const cells = [];
    while (d.getTime() < end) {
      const wStart = Math.max(d.getTime(), vs);
      const wEnd   = Math.min(d.getTime() + WEEK_MS, end);
      const width  = (wEnd - wStart) / viewTotal * 100;
      if (width > 0.1) {
        const lbl = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
        cells.push(`<div class="msd-week-cell" style="width:${width.toFixed(3)}%">${lbl}</div>`);
      }
      d.setDate(d.getDate() + 7);
    }
    return `<div class="msd-week-hdr">${cells.join('')}</div>`;
  }

  // ─── Day header (shown at zoom ≥ 3) ──────────────────────
  function _dayHeaderHtml(viewStart, viewTotal) {
    const DAY_MS   = 86400000;
    const totalDays = Math.ceil(viewTotal / DAY_MS);
    if (totalDays > 120) return ''; // too many — skip
    const cells = [];
    const d = new Date(viewStart.getTime());
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < totalDays; i++) {
      const pct = DAY_MS / viewTotal * 100;
      const day = d.getDate();
      const mon = MONTHS_SHORT[d.getMonth()];
      // Show month label on 1st of month, else just day number
      const lbl = day === 1 ? `${mon} 1` : String(day);
      cells.push(`<div class="msd-day-cell" style="width:${pct.toFixed(4)}%">${lbl}</div>`);
      d.setDate(d.getDate() + 1);
    }
    return `<div class="msd-day-hdr" data-hdr-type="day">${cells.join('')}</div>`;
  }

  // ─── Today vertical line ──────────────────────────────────
  function _todayLineHtml(viewStart, viewTotal, today) {
    const x = (today.getTime() - viewStart.getTime()) / viewTotal * 100;
    if (x < 0 || x > 100) return '';
    return `<div class="msd-today-line" style="left:${x.toFixed(3)}%"><span class="msd-today-lbl">Today</span></div>`;
  }

  // ─── Bar range helper (percentage positions) ──────────────
  function _getBarRange(t, viewStart, viewTotal) {
    const vst   = viewStart.getTime();
    const start = t.start_date ? new Date(t.start_date + 'T00:00:00') : null;
    const due   = t.due_date   ? new Date(t.due_date   + 'T00:00:00') : null;
    if (start && due && due >= start) {
      return { left: (start.getTime()-vst)/viewTotal*100, right: (due.getTime()-vst)/viewTotal*100 };
    } else if (due) {
      const x = (due.getTime()-vst)/viewTotal*100;
      return { left: x-1.5, right: x+3.5 };
    } else if (start) {
      const x = (start.getTime()-vst)/viewTotal*100;
      return { left: x, right: x+5 };
    }
    return { left: 2, right: 7 };
  }

  // ─── Detect bottlenecks (connected tasks whose date ranges overlap) ─────────
  // Only flags pairs that have an explicit dependency link AND overlap in the view.
  function _detectBottlenecks(tasks, viewStart, viewTotal) {
    const ranges = tasks.map(t => { const r = _getBarRange(t, viewStart, viewTotal); return { id:t.id, left:r.left, right:r.right, deps:(t.dependencies||[]) }; });
    const rangeById = Object.fromEntries(ranges.map(r => [r.id, r]));
    const overlaps = [];
    const seen = new Set();
    for (const rA of ranges) {
      for (const dep of rA.deps) {
        const rB = rangeById[dep.taskId];
        if (!rB) continue;
        const key = [rA.id, rB.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const ol = Math.max(rA.left, rB.left), or_ = Math.min(rA.right, rB.right);
        if (or_ - ol > 0.5) overlaps.push({ taskIdA:rA.id, taskIdB:rB.id, left:ol, right:or_ });
      }
    }
    return overlaps;
  }

  // ─── Ghost bars (prerequisite task shown on same row) ─────
  function _ghostBarsHtml(t, tasks, taskIds, ms, viewStart, viewTotal) {
    const deps = (t.dependencies || []).filter(d => taskIds.has(d.taskId));
    if (!deps.length) return '';
    return deps.map(dep => {
      const prereq = tasks.find(tt => tt.id === dep.taskId);
      if (!prereq) return '';
      const r     = _getBarRange(prereq, viewStart, viewTotal);
      // Skip ghost bars that are entirely outside the view range
      if (r.right < 0 || r.left > 100) return '';
      const left  = Math.max(0, r.left);
      const rawWidth = r.right - r.left;
      const width = Math.min(Math.max(3, rawWidth), 100 - left);
      if (left > 100) return '';
      const dc    = prereq.discipline && typeof window.getDiscColor === 'function' ? window.getDiscColor(prereq.discipline) : (ms.color || '#6366f1');
      const abbr  = _discAbbrev(prereq.discipline);
      return `<div class="msd-ghost-bar" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;border-color:${dc}" title="Prerequisite: ${esc(prereq.title)}">
        <span class="msd-bar-lbl" style="color:${dc}">${abbr?`[${abbr}] `:''}${esc(prereq.title)}</span>
      </div>`;
    }).join('');
  }

  // ─── Task bar ─────────────────────────────────────────────
  function _barHtml(t, ms, viewStart, viewTotal, isBottleneck) {
    const vst       = viewStart.getTime();
    const vendt     = vst + viewTotal;
    const start     = t.start_date ? new Date(t.start_date + 'T00:00:00') : null;
    const due       = t.due_date   ? new Date(t.due_date   + 'T00:00:00') : null;
    const msColor   = ms.color || '#6366f1';
    const discColor = t.discipline && typeof window.getDiscColor === 'function'
      ? window.getDiscColor(t.discipline) : msColor;

    let leftPct = 2, widthPct = 5;
    if (start && due && due >= start) {
      // Raw positions in view-percentage
      const rawLeft  = (start.getTime() - vst) / viewTotal * 100;
      const rawRight = (due.getTime()   - vst) / viewTotal * 100;
      // Skip if entirely outside view
      if (rawRight < 0 || rawLeft > 100) {
        return `<div class="msd-bar-outside" title="${esc(t.title)} (outside view range)"></div>`;
      }
      leftPct  = Math.max(0, rawLeft);
      widthPct = Math.max(2, Math.min(rawRight, 100) - leftPct);
    } else if (due) {
      const rawX = (due.getTime() - vst) / viewTotal * 100;
      if (rawX < -2 || rawX > 102) {
        return `<div class="msd-bar-outside" title="${esc(t.title)} (outside view range)"></div>`;
      }
      leftPct  = Math.max(0, rawX - 1.5);
      widthPct = Math.min(5, 100 - leftPct);
    } else if (start) {
      const rawX = (start.getTime() - vst) / viewTotal * 100;
      if (rawX > 102) {
        return `<div class="msd-bar-outside" title="${esc(t.title)} (outside view range)"></div>`;
      }
      leftPct  = Math.max(0, rawX);
      widthPct = Math.min(5, 100 - leftPct);
    }

    const isBlocked = t.status === 'blocked';
    const isDone    = t.status === 'done';
    const barColor  = isDone ? '#22c55e' : isBlocked ? '#ef4444' : discColor;
    const abbr      = _discAbbrev(t.discipline);

    return `<div class="msd-task-bar${isBlocked?' msd-bar-blocked':''}${isDone?' msd-bar-done':''}${isBottleneck?' msd-bar-bottleneck':''}"
        data-task-id="${t.id}"
        style="left:${leftPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%;background:${barColor}${isDone?'99':'cc'};border-color:${barColor}"
        title="${esc(t.title)}: ${SL[t.status]||t.status}${t.due_date?' – due '+_fmtDate(t.due_date):''}">
      <span class="msd-bar-lbl">${abbr?`[${abbr}] `:''}${esc(t.title)}</span>
    </div>`;
  }

  // ─── SVG dependency arrows (drawn post-layout) ───────────
  function _drawDepArrows(el, msId, tasks) {
    const svg   = el.querySelector(`#msd-dep-svg-${msId}`);
    const layer = el.querySelector(`#msd-bars-${msId}`);
    if (!svg || !layer) return;

    const taskIds   = new Set(tasks.map(t => t.id));
    const layerRect = layer.getBoundingClientRect();
    const arrows    = [];

    tasks.forEach(t => {
      (t.dependencies || []).forEach(dep => {
        if (!taskIds.has(dep.taskId)) return;
        const fromBar = layer.querySelector(`.msd-bar-row[data-task-id="${dep.taskId}"] .msd-task-bar`);
        const toBar   = layer.querySelector(`.msd-bar-row[data-task-id="${t.id}"] .msd-task-bar`);
        if (!fromBar || !toBar) return;
        const fr = fromBar.getBoundingClientRect();
        const tr = toBar.getBoundingClientRect();
        arrows.push({
          x1: fr.right - layerRect.left,
          y1: fr.top   - layerRect.top  + fr.height * 0.5,
          x2: tr.left  - layerRect.left,
          y2: tr.top   - layerRect.top  + tr.height * 0.5,
        });
      });
    });

    if (!arrows.length) return;

    const uid = `da-${msId}`;
    svg.setAttribute('width',  layer.offsetWidth);
    svg.setAttribute('height', layer.offsetHeight);
    svg.innerHTML = `
      <defs>
        <marker id="${uid}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="#ef4444aa"/>
        </marker>
      </defs>
      ${arrows.map(a => {
        const cx = (a.x1 + a.x2) * 0.5;
        return `<path d="M ${a.x1} ${a.y1} C ${cx} ${a.y1} ${cx} ${a.y2} ${a.x2} ${a.y2}"
          fill="none" stroke="#ef4444aa" stroke-width="1.5" stroke-dasharray="5 3"
          marker-end="url(#${uid})"/>`;
      }).join('')}`;
  }

  // ─── Task row (list section) ──────────────────────────────
  function _taskRowHtml(t, proj) {
    const abbr      = _discAbbrev(t.discipline);
    const dc        = t.discipline && typeof window.getDiscColor === 'function' ? window.getDiscColor(t.discipline) : '';
    const overdue   = t.due_date && t.status !== 'done' && new Date(t.due_date + 'T00:00:00') < new Date();
    const isBlocked = t.status === 'blocked';
    const deps      = (t.dependencies || []).filter(d => (proj.tasks||[]).some(tt => tt.id === d.taskId && !tt.deleted));
    const depNames  = deps.map(d => {
      const dt = (proj.tasks||[]).find(tt => tt.id === d.taskId);
      return dt ? `<em>${esc(dt.title.length>22?dt.title.slice(0,22)+'…':dt.title)}</em>` : '?';
    }).join(', ');

    return `
      <div class="msd-task-row${isBlocked?' msd-tr-blocked':''}" data-task-id="${t.id}">
        <button class="msd-status-btn" data-task-id="${t.id}" title="${SL[t.status]||t.status}">
          <i class="fa ${t.status==='done'?'fa-circle-check':t.status==='blocked'?'fa-circle-xmark':'fa-circle'}"
             style="color:${SC[t.status]||'#6b7280'}"></i>
        </button>
        <div class="msd-task-body">
          <div class="msd-trow-title">
            ${abbr?`<span class="msd-disc-prefix" style="color:${dc}">[${esc(abbr)}]</span>`:''}
            <span class="${t.status==='done'?'msd-done':''}">${esc(t.title)}</span>
          </div>
          <div class="msd-task-meta">
            <span class="badge badge-status-${t.status}">${SL[t.status]||t.status}</span>
            ${t.due_date?`<span class="${overdue?'msd-overdue':''}"><i class="fa fa-calendar-days"></i> ${_fmtDate(t.due_date)}</span>`:''}
            ${deps.length?`<span class="msd-dep-info"><i class="fa fa-link"></i> needs: ${depNames}</span>`:''}
            ${(t.subtasks||[]).length?`<span><i class="fa fa-list-check"></i> ${(t.subtasks||[]).filter(s=>s.done).length}/${(t.subtasks||[]).length}</span>`:''}
          </div>
        </div>
        <button class="msd-open-btn icon-btn" data-task-id="${t.id}" title="Open task"><i class="fa fa-arrow-up-right-from-square"></i></button>
      </div>`;
  }

  // ─── Deliverable popup: full Gantt timeline + editable name ──
  function _openDlPopup(dl, ms, proj, projectId) {
    document.querySelectorAll('.msd-dl-popup-overlay').forEach(n => n.remove());

    const allTasks  = proj.tasks || [];
    const linked    = (dl.task_ids||[]).map(id => allTasks.find(t => t.id === id)).filter(Boolean);
    const isDone    = _dlDone(dl, allTasks);
    const DAY_MS    = 86400000;
    const today     = new Date(); today.setHours(0, 0, 0, 0);

    // Timeline range from milestone dates
    const msStartMs = ms.start_date  ? new Date(ms.start_date  + 'T00:00:00').getTime() : null;
    const msEndMs   = ms.target_date ? new Date(ms.target_date + 'T00:00:00').getTime() : null;
    let viewStart, viewEnd, viewTotal;
    const hasTimeline = !!(msStartMs && msEndMs && msEndMs > msStartMs);
    if (hasTimeline) {
      viewStart = new Date(msStartMs);
      viewTotal = (msEndMs - msStartMs + DAY_MS) * 1.12;
      viewEnd   = new Date(msStartMs + viewTotal);
    }

    // Build body
    let bodyHtml;
    if (!linked.length) {
      bodyHtml = `<p class="msd-dl-popup-hint" style="padding:16px">No tasks linked — use the 🔗 button to link tasks.</p>`;
    } else if (!hasTimeline) {
      bodyHtml = `<p class="msd-dl-popup-hint" style="padding:16px">Add milestone start &amp; end dates to see the Gantt timeline.</p>`;
    } else {
      const labelsHtml = linked.map(t => {
        const abbr = _discAbbrev(t.discipline);
        const dc   = t.discipline && typeof window.getDiscColor === 'function' ? window.getDiscColor(t.discipline) : '';
        return `<div class="msd-gl-row" data-task-id="${esc(t.id)}" title="${esc(t.title)}">
          ${abbr ? `<span class="msd-disc-tag" style="color:${dc}">[${esc(abbr)}]</span>` : ''}
          <span class="msd-gl-title">${esc(t.title)}</span>
        </div>`;
      }).join('');
      const barsHtml = linked.map(t =>
        `<div class="msd-bar-row" data-task-id="${esc(t.id)}">${_barHtml(t, ms, viewStart, viewTotal, false)}</div>`
      ).join('');
      bodyHtml = `
        <div class="msd-dl-popup-toolbar">
          <button class="msd-dl-pz-btn icon-btn" data-delta="-0.5" title="Zoom out"><i class="fa fa-magnifying-glass-minus"></i></button>
          <span class="msd-dl-pz-lvl">1×</span>
          <button class="msd-dl-pz-btn icon-btn" data-delta="0.5" title="Zoom in"><i class="fa fa-magnifying-glass-plus"></i></button>
          <span style="font-size:10px;color:var(--text-muted);margin-left:4px">Ctrl+scroll to zoom · drag to pan</span>
        </div>
        <div class="msd-gantt-inner msd-dl-popup-gantt">
          <div class="msd-gantt-labels msd-dl-popup-labels">
            <div class="msd-gl-hdr">Task</div>
            ${labelsHtml}
          </div>
          <div class="msd-dl-popup-track">
            <div class="msd-dl-popup-track-inner" data-view-start="${viewStart.getTime()}" data-view-total="${viewTotal}">
              ${_monthHeaderHtml(viewStart, viewEnd, viewTotal)}
              <div class="msd-week-hdr-slot"></div>
              <div class="msd-day-hdr-slot"></div>
              <div class="msd-bars-layer">
                ${_todayLineHtml(viewStart, viewTotal, today)}
                ${barsHtml}
              </div>
            </div>
          </div>
        </div>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'msd-dl-popup-overlay';
    overlay.innerHTML = `
      <div class="msd-dl-popup" role="dialog" aria-modal="true">
        <div class="msd-dl-popup-hdr">
          <input class="msd-dl-popup-name form-input" value="${esc(dl.text)}" placeholder="Deliverable name…">
          <span class="msd-dl-popup-status ${isDone ? 'msd-dl-popup-done' : ''}">${isDone
            ? '<i class="fa fa-circle-check" style="color:#22c55e"></i> Done'
            : '<i class="fa fa-circle" style="color:var(--text-muted)"></i> In progress'}</span>
          <button class="msd-dl-popup-close icon-btn" title="Close"><i class="fa fa-xmark"></i></button>
        </div>
        <div class="msd-dl-popup-body">${bodyHtml}</div>
        ${linked.length && !isDone ? `<p class="msd-dl-popup-hint">Done automatically when all ${linked.length} linked task${linked.length > 1 ? 's' : ''} complete.</p>` : ''}
      </div>`;
    document.body.appendChild(overlay);

    // ── Popup Gantt zoom + drag ───────────────────────────────
    if (hasTimeline && linked.length) {
      const track = overlay.querySelector('.msd-dl-popup-track');
      const inner = overlay.querySelector('.msd-dl-popup-track-inner');
      let zoom = 1;

      function applyPopupZoom(z) {
        zoom = Math.min(8, Math.max(0.25, z));
        inner.style.width = (zoom * 100) + '%';
        track.style.overflowX = zoom > 1 ? 'auto' : 'hidden';
        track.style.cursor    = zoom > 1 ? 'grab' : '';
        const lvl = overlay.querySelector('.msd-dl-pz-lvl');
        if (lvl) lvl.textContent = (zoom % 1 === 0 ? zoom.toFixed(0) : zoom.toFixed(1)) + '×';
        const vsMs = parseFloat(inner.dataset.viewStart);
        const vtMs = parseFloat(inner.dataset.viewTotal);
        const totalDays = Math.ceil(vtMs / 86400000);
        const weekSlot = inner.querySelector('.msd-week-hdr-slot');
        const daySlot  = inner.querySelector('.msd-day-hdr-slot');
        if (weekSlot) weekSlot.innerHTML = (zoom >= 1.5 && totalDays <= 250) ? _weekHeaderHtml(new Date(vsMs), vtMs) : '';
        if (daySlot)  daySlot.innerHTML  = (zoom >= 3   && totalDays <= 90)  ? _dayHeaderHtml(new Date(vsMs), vtMs)  : '';
      }

      overlay.querySelectorAll('.msd-dl-pz-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); applyPopupZoom(zoom + parseFloat(btn.dataset.delta || '0')); });
      });
      track.addEventListener('wheel', e => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        applyPopupZoom(zoom + (e.deltaY < 0 ? 0.25 : -0.25));
      }, { passive: false });
      track.addEventListener('pointerdown', function(e) {
        if (e.button !== 0) return;
        const startX = e.clientX, startScroll = track.scrollLeft;
        track.setPointerCapture(e.pointerId);
        track.style.cursor = 'grabbing';
        function onMove(ev) { track.scrollLeft = startScroll - (ev.clientX - startX); }
        function onUp() {
          track.releasePointerCapture(e.pointerId);
          track.style.cursor = zoom > 1 ? 'grab' : '';
          track.removeEventListener('pointermove', onMove);
          track.removeEventListener('pointerup', onUp);
        }
        track.addEventListener('pointermove', onMove);
        track.addEventListener('pointerup', onUp);
      });
      applyPopupZoom(1);
    }

    // ── Name editing ─────────────────────────────────────────
    const nameInput = overlay.querySelector('.msd-dl-popup-name');
    function saveName() {
      const newText = nameInput.value.trim();
      if (!newText || newText === dl.text) return;
      const fp = window.getProject(proj.id);
      const fm = (fp?.milestones||[]).find(m => m.id === ms.id) || ms;
      const fd = (fm.deliverables||[]).find(d => d.id === dl.id);
      if (!fd) return;
      fd.text = newText;
      fm.updated_at = window.isoNow();
      window.saveData();
      if (typeof window.refreshOpenMilestoneDetails === 'function') window.refreshOpenMilestoneDetails(projectId);
    }
    nameInput.addEventListener('blur', saveName);
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveName(); overlay.remove(); }
      if (e.key === 'Escape') overlay.remove();
    });
    overlay.querySelector('.msd-dl-popup-close').addEventListener('click', () => { saveName(); overlay.remove(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { saveName(); overlay.remove(); } });
  }

  // ─── Deliverable focus: dim/highlight rows in Gantt ──────
  function _applyDlFocus(el, ms) {
    const dlId = el.dataset.msdDlFocus || '';
    const deliverables = ms.deliverables || [];
    const dl  = dlId ? deliverables.find(d => d.id === dlId) : null;
    const focusIds = new Set(dl ? (dl.task_ids || []) : []);
    const active   = focusIds.size > 0;

    // Gantt rows
    el.querySelectorAll('.msd-gl-row').forEach(row => {
      row.classList.toggle('msd-row-dimmed',  active && !focusIds.has(row.dataset.taskId));
      row.classList.toggle('msd-row-focused', active &&  focusIds.has(row.dataset.taskId));
    });
    el.querySelectorAll('.msd-bar-row').forEach(row => {
      row.classList.toggle('msd-row-dimmed',  active && !focusIds.has(row.dataset.taskId));
      row.classList.toggle('msd-row-focused', active &&  focusIds.has(row.dataset.taskId));
    });

    // Toolbar indicator
    const ind  = el.querySelector('.msd-dl-focus-indicator');
    const name = el.querySelector('.msd-dl-focus-name');
    if (ind)  ind.style.display  = active ? '' : 'none';
    if (name) name.textContent   = active ? `Showing: ${dl.text}` : '';

    // Deliverable focus button active state
    el.querySelectorAll('.msd-dl-focus-btn').forEach(btn => {
      btn.classList.toggle('msd-dl-focus-active', btn.dataset.dlId === dlId && active);
    });
  }

  // ─── Gantt zoom ───────────────────────────────────────────
  function _bindZoom(el, ms, tasks) {
    const track = el.querySelector(`#msd-track-${ms.id}`);
    if (!track) return;

    // Restore zoom level across re-renders (stored on outer el)
    const initZoom = parseFloat(el.dataset.msdZoom || '1');
    _applyZoom(el, track, initZoom, ms, tasks);

    // Zoom buttons in toolbar
    el.querySelectorAll('.msd-zoom-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const cur = parseFloat(el.dataset.msdZoom || '1');
        const nz  = 'zoomReset' in btn.dataset ? 1 : Math.min(8, Math.max(0.25, cur + parseFloat(btn.dataset.zoomDelta || '0')));
        el.dataset.msdZoom = nz;
        _applyZoom(el, track, nz, ms, tasks);
      });
    });

    // Ctrl+Wheel zoom
    track.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const cur = parseFloat(el.dataset.msdZoom || '1');
      const nz  = Math.min(8, Math.max(0.25, cur + (e.deltaY < 0 ? 0.25 : -0.25)));
      el.dataset.msdZoom = nz;
      _applyZoom(el, track, nz, ms, tasks);
    }, { passive: false });

    // Drag to scroll (click-drag panning)
    track.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      const startX      = e.clientX;
      const startScroll = track.scrollLeft;
      track.setPointerCapture(e.pointerId);
      track.style.cursor = 'grabbing';
      function onMove(ev) {
        track.scrollLeft = startScroll - (ev.clientX - startX);
      }
      function onUp() {
        track.releasePointerCapture(e.pointerId);
        track.style.cursor = '';
        track.removeEventListener('pointermove', onMove);
        track.removeEventListener('pointerup', onUp);
      }
      track.addEventListener('pointermove', onMove);
      track.addEventListener('pointerup', onUp);
    });
  }

  function _applyZoom(el, track, zoom, ms, tasks) {
    const inner = track.querySelector('.msd-gantt-track-inner');
    if (!inner) return;
    inner.style.width = (zoom * 100) + '%';
    if (zoom > 1) {
      track.style.overflowX = 'auto';
      track.style.cursor = 'grab';
    } else {
      track.style.overflowX = 'hidden';
      track.style.cursor = '';
    }
    const badge = el.querySelector('.msd-zoom-lvl');
    if (badge) badge.textContent = (zoom % 1 === 0 ? zoom.toFixed(0) : zoom.toFixed(1)) + '×';
    const resetBtn = el.querySelector('.msd-zoom-reset');
    if (resetBtn) resetBtn.style.display = zoom !== 1 ? '' : 'none';
    // Week / Day sub-headers based on zoom level
    const vsMs      = parseFloat(inner.dataset.viewStart);
    const vtMs      = parseFloat(inner.dataset.viewTotal);
    const totalDays = (vsMs && vtMs) ? Math.ceil(vtMs / 86400000) : 0;
    const weekSlot  = inner.querySelector('.msd-week-hdr-slot');
    const daySlot   = inner.querySelector('.msd-day-hdr-slot');
    if (weekSlot) weekSlot.innerHTML = (vsMs && vtMs && zoom >= 1.5 && totalDays <= 250) ? _weekHeaderHtml(new Date(vsMs), vtMs) : '';
    if (daySlot)  daySlot.innerHTML  = (vsMs && vtMs && zoom >= 3   && totalDays <= 90)  ? _dayHeaderHtml(new Date(vsMs), vtMs)  : '';
    // Re-draw dependency arrows after layout settles
    if (ms && tasks) requestAnimationFrame(() => _drawDepArrows(el, ms.id, tasks));
  }

  // ─── Event bindings ───────────────────────────────────────
  function _bindEvents(el, proj, ms, projectId) {
    // Mode toggle (Full range / From today)
    el.querySelectorAll('.msd-mode-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        el.dataset.msdMode = btn.dataset.mode;
        const up = window.getProject(proj.id);
        _render(el, up, (up.milestones||[]).find(m => m.id === ms.id) || ms, projectId);
      });
    });

    // Status toggle
    el.querySelectorAll('.msd-status-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const task = (proj.tasks||[]).find(t => t.id === btn.dataset.taskId);
        if (!task) return;
        if (typeof window.pushUndo === 'function') window.pushUndo(proj.id);
        task.status       = task.status === 'done' ? 'todo' : 'done';
        task.completed_at = task.status === 'done' ? window.isoNow() : null;
        task.updated_at   = window.isoNow();
        window.saveData();
        window.renderTasks(proj.id);
        const updProj = window.getProject(proj.id);
        const updMs   = (updProj.milestones||[]).find(m => m.id === ms.id) || ms;
        _render(el, updProj, updMs, projectId);
      });
    });

    // Label row click → open detail panel
    el.querySelectorAll('.msd-gl-row').forEach(row => {
      row.addEventListener('click', () => {
        if (typeof window.openDetailPanel === 'function')
          window.openDetailPanel(proj.id, row.dataset.taskId);
      });
    });

    // Bar click → open detail panel
    el.querySelectorAll('.msd-task-bar').forEach(bar => {
      bar.addEventListener('click', e => {
        e.stopPropagation();
        if (typeof window.openDetailPanel === 'function')
          window.openDetailPanel(proj.id, bar.dataset.taskId);
      });
    });

    // Open-detail button + task body
    el.querySelectorAll('.msd-open-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (typeof window.openDetailPanel === 'function')
          window.openDetailPanel(proj.id, btn.dataset.taskId);
      });
    });
    el.querySelectorAll('.msd-task-body').forEach(body => {
      body.addEventListener('click', function () {
        const row = this.closest('.msd-task-row');
        if (row && typeof window.openDetailPanel === 'function')
          window.openDetailPanel(proj.id, row.dataset.taskId);
      });
    });

    // Deliverables — toggle add row
    const dlAddBtn = el.querySelector('.msd-dl-add');
    const dlAddRow = el.querySelector('.msd-dl-add-row');
    if (dlAddBtn && dlAddRow) {
      dlAddBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = dlAddRow.style.display !== 'none';
        dlAddRow.style.display = isOpen ? 'none' : '';
        el.querySelector('.msd-dl-link-picker').style.display = 'none';
        if (!isOpen) el.querySelector('.msd-dl-input')?.focus();
      });
      el.querySelector('.msd-dl-cancel')?.addEventListener('click', e => {
        e.stopPropagation(); dlAddRow.style.display = 'none';
      });
    }

    // Deliverables — submit new item
    const _doAddDl = () => {
      const input = el.querySelector('.msd-dl-input');
      const text  = input ? input.value.trim() : '';
      if (!text) return;
      const taskIds = [...(el.querySelectorAll('.msd-dl-task-cb:checked') || [])].map(cb => cb.value);
      const fp = window.getProject(proj.id);
      const fm = (fp?.milestones||[]).find(m => m.id === ms.id) || ms;
      fm.deliverables = fm.deliverables || [];
      fm.deliverables.push({ id: window.uid('dl'), text, done: false, task_ids: taskIds });
      fm.updated_at = window.isoNow();
      window.saveData();
      _render(el, window.getProject(proj.id), (window.getProject(proj.id)?.milestones||[]).find(m=>m.id===ms.id)||fm, projectId);
    };
    el.querySelector('.msd-dl-submit')?.addEventListener('click', e => { e.stopPropagation(); _doAddDl(); });
    el.querySelector('.msd-dl-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.stopPropagation(); _doAddDl(); }
      if (e.key === 'Escape') { e.stopPropagation(); if (dlAddRow) dlAddRow.style.display='none'; }
    });

    // Deliverables — click body to open popup
    el.querySelectorAll('.msd-dl-body').forEach(body => {
      body.addEventListener('click', e => {
        e.stopPropagation();
        const item  = body.closest('.msd-dl-item');
        const dlId  = item?.dataset.dlId;
        if (!dlId) return;
        const fp = window.getProject(proj.id);
        const fm = (fp?.milestones||[]).find(m => m.id === ms.id) || ms;
        const dl = (fm.deliverables||[]).find(d => d.id === dlId);
        if (!dl) return;
        _openDlPopup(dl, fm, fp, projectId);
      });
    });

    // Deliverables — drag to another milestone ─────────────
    const dlItemsContainer = el.querySelector('.msd-dl-items');

    el.querySelectorAll('.msd-dl-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.dlId); // fallback
        // Use module-level var so dragover can read it cross-panel
        _activeDlDrag = { dlId: item.dataset.dlId, fromMsId: ms.id, projId: proj.id };
        item.classList.add('msd-dl-dragging');
        // Highlight all other open milestone deliverable containers
        requestAnimationFrame(() => {
          document.querySelectorAll('.msd-dl-items').forEach(z => {
            if (z.dataset.msId !== ms.id) z.classList.add('msd-dl-drop-target');
          });
        });
      });
      item.addEventListener('dragend', () => {
        _activeDlDrag = null;
        item.classList.remove('msd-dl-dragging');
        document.querySelectorAll('.msd-dl-items').forEach(z => {
          z.classList.remove('msd-dl-drop-target', 'msd-dl-drop-over');
        });
      });
    });

    // Drop zone — accept deliverables from other milestones
    if (dlItemsContainer) {
      dlItemsContainer.addEventListener('dragover', e => {
        if (!_activeDlDrag) return;
        if (_activeDlDrag.fromMsId === ms.id) return; // same milestone — ignore
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        dlItemsContainer.classList.add('msd-dl-drop-over');
      });
      dlItemsContainer.addEventListener('dragleave', e => {
        if (!dlItemsContainer.contains(e.relatedTarget)) {
          dlItemsContainer.classList.remove('msd-dl-drop-over');
        }
      });
      dlItemsContainer.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        dlItemsContainer.classList.remove('msd-dl-drop-over', 'msd-dl-drop-target');
        if (!_activeDlDrag) return;
        const { dlId, fromMsId, projId } = _activeDlDrag;
        _activeDlDrag = null;
        if (!dlId || fromMsId === ms.id) return;

        const fp     = window.getProject(projId);
        const fromMs = (fp?.milestones||[]).find(m => m.id === fromMsId);
        const toMs   = (fp?.milestones||[]).find(m => m.id === ms.id);
        if (!fromMs || !toMs) return;
        const dlIdx = (fromMs.deliverables||[]).findIndex(d => d.id === dlId);
        if (dlIdx < 0) return;

        if (typeof window.pushUndo === 'function') window.pushUndo(projId);
        const [dl] = fromMs.deliverables.splice(dlIdx, 1);
        toMs.deliverables = toMs.deliverables || [];
        toMs.deliverables.push(dl);
        fp.updated_at = window.isoNow();
        window.saveData();
        window.refreshOpenMilestoneDetails(projId);
      });
    }

    // Deliverables — link tasks picker
    const dlLinkPicker = el.querySelector('.msd-dl-link-picker');
    el.querySelectorAll('.msd-dl-link-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!dlLinkPicker) return;
        const dlId = btn.dataset.dlId;
        dlAddRow && (dlAddRow.style.display = 'none');
        // Pre-check currently linked tasks
        const fp  = window.getProject(proj.id);
        const fm  = (fp?.milestones||[]).find(m => m.id === ms.id) || ms;
        const dl  = (fm.deliverables||[]).find(d => d.id === dlId);
        dlLinkPicker.dataset.forDl = dlId;
        dlLinkPicker.querySelectorAll('.msd-dl-link-cb').forEach(cb => {
          cb.checked = dl && (dl.task_ids||[]).includes(cb.value);
        });
        dlLinkPicker.style.display = dlLinkPicker.style.display === 'none' ? '' : 'none';
      });
    });
    dlLinkPicker?.querySelector('.msd-dl-link-save')?.addEventListener('click', e => {
      e.stopPropagation();
      const dlId   = dlLinkPicker.dataset.forDl;
      const taskIds = [...dlLinkPicker.querySelectorAll('.msd-dl-link-cb:checked')].map(cb => cb.value);
      const fp = window.getProject(proj.id);
      const fm = (fp?.milestones||[]).find(m => m.id === ms.id) || ms;
      const dl = (fm.deliverables||[]).find(d => d.id === dlId);
      if (dl) { dl.task_ids = taskIds; fm.updated_at = window.isoNow(); window.saveData(); }
      _render(el, window.getProject(proj.id), (window.getProject(proj.id)?.milestones||[]).find(m=>m.id===ms.id)||fm, projectId);
    });
    dlLinkPicker?.querySelector('.msd-dl-link-cancel')?.addEventListener('click', e => {
      e.stopPropagation(); dlLinkPicker.style.display = 'none';
    });

    // Deliverables — focus in timeline
    el.querySelectorAll('.msd-dl-focus-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const dlId = btn.dataset.dlId;
        const isSame = el.dataset.msdDlFocus === dlId;
        el.dataset.msdDlFocus = isSame ? '' : dlId;
        _applyDlFocus(el, ms);
      });
    });

    // Clear deliverable focus from toolbar X button
    el.querySelector('.msd-dl-focus-clear')?.addEventListener('click', e => {
      e.stopPropagation();
      el.dataset.msdDlFocus = '';
      _applyDlFocus(el, ms);
    });

    // Deliverables — remove
    el.querySelectorAll('.msd-dl-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const dlId = btn.closest('.msd-dl-item')?.dataset.dlId;
        const fp = window.getProject(proj.id);
        const fm = (fp?.milestones||[]).find(m => m.id === ms.id) || ms;
        fm.deliverables = (fm.deliverables||[]).filter(d => d.id !== dlId);
        fm.updated_at = window.isoNow();
        window.saveData();
        _render(el, window.getProject(proj.id), (window.getProject(proj.id)?.milestones||[]).find(m=>m.id===ms.id)||fm, projectId);
      });
    });

    // Task list filter toggle
    el.querySelectorAll('.msd-tl-filter-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        el.dataset.msdTaskFilter = btn.dataset.filter;
        const fp = window.getProject(proj.id);
        _render(el, fp, (fp?.milestones||[]).find(m => m.id === ms.id) || ms, projectId);
      });
    });
  }

  // Expose bottleneck detector for milestone card highlights
  window._msdDetectBottlenecks = function (tasks, msStart, msEnd) {
    if (!msStart || !msEnd || msEnd <= msStart) return [];
    const viewTotal = msEnd - msStart;
    return _detectBottlenecks(tasks, msStart, viewTotal);
  };

  // Re-render any currently-open milestone detail panels for a project
  window.refreshOpenMilestoneDetails = function (projectId) {
    document.querySelectorAll('.ms-inline-detail.msd-open').forEach(panel => {
      const item = panel.closest('.ms-card-item');
      const msId = item?.dataset.msId;
      if (!msId) return;
      const fp = window.getProject(projectId);
      if (!fp) return;
      const fm = (fp.milestones||[]).find(m => m.id === msId);
      if (fm) _render(panel, fp, fm, projectId);
    });
  };
})();
