// ============================================================
// milestone-detail.js — Milestone inline sub-view (Gantt + task list)
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const SC = { 'todo':'#6b7280','in-progress':'#3b82f6','blocked':'#ef4444','done':'#22c55e' };
  const SL = { 'todo':'Todo','in-progress':'In Progress','blocked':'Blocked','done':'Done' };
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

    const sortedTasks = _topoSort(tasks);
    const taskIds     = new Set(tasks.map(t => t.id));

    // Bottleneck detection – visible only when viewing tasks
    const overlaps   = viewTotal ? _detectBottlenecks(tasks, viewStart, viewTotal) : [];
    const overlapIds = new Set(overlaps.flatMap(o => [o.taskIdA, o.taskIdB]));

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
            <div class="msd-zoom-controls">
              <button class="msd-zoom-btn" data-zoom-delta="-0.5" title="Zoom out"><i class="fa fa-magnifying-glass-minus"></i></button>
              <span class="msd-zoom-lvl">1×</span>
              <button class="msd-zoom-btn" data-zoom-delta="0.5" title="Zoom in"><i class="fa fa-magnifying-glass-plus"></i></button>
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
                  <span class="msd-gl-title">${esc(t.title.length>24?t.title.slice(0,24)+'…':t.title)}</span>
                </div>`;
              }).join('')}
            </div>
            <div class="msd-gantt-track" id="msd-track-${ms.id}">
              <div class="msd-gantt-track-inner">
                ${_monthHeaderHtml(viewStart, msEnd, viewTotal)}
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

        <div class="msd-task-list">
          <div class="msd-tl-hdr"><i class="fa fa-list-check"></i> ${tasks.length} Task${tasks.length!==1?'s':''}</div>
          ${sortedTasks.length===0
            ? '<p class="msd-empty">No tasks assigned to this milestone.</p>'
            : sortedTasks.map(t => _taskRowHtml(t, proj)).join('')}
        </div>

      </div>`;

    _bindEvents(el, proj, ms, projectId);
    if (viewTotal) requestAnimationFrame(() => _drawDepArrows(el, ms.id, tasks));
    if (viewTotal) _bindZoom(el, ms, tasks);
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
    return `<div class="msd-month-hdr">${cells.join('')}</div>`;
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

  // ─── Detect bottlenecks (overlapping date ranges) ─────────
  function _detectBottlenecks(tasks, viewStart, viewTotal) {
    const ranges = tasks.map(t => { const r = _getBarRange(t, viewStart, viewTotal); return { id:t.id, left:r.left, right:r.right }; });
    const overlaps = [];
    for (let i=0; i<ranges.length; i++) {
      for (let j=i+1; j<ranges.length; j++) {
        const A=ranges[i], B=ranges[j];
        const ol = Math.max(A.left, B.left), or_ = Math.min(A.right, B.right);
        if (or_ - ol > 0.5) overlaps.push({ taskIdA:A.id, taskIdB:B.id, left:ol, right:or_ });
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
      const left  = Math.max(0, r.left);
      const width = Math.min(Math.max(3, r.right - r.left), 100 - left);
      if (left > 100) return '';
      const dc    = prereq.discipline && typeof window.getDiscColor === 'function' ? window.getDiscColor(prereq.discipline) : (ms.color || '#6366f1');
      const abbr  = _discAbbrev(prereq.discipline);
      return `<div class="msd-ghost-bar" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;border-color:${dc}" title="Prerequisite: ${esc(prereq.title)}">
        <span class="msd-bar-lbl" style="color:${dc}">${abbr?`[${abbr}] `:''}${esc(prereq.title.length>16?prereq.title.slice(0,16)+'…':prereq.title)}</span>
      </div>`;
    }).join('');
  }

  // ─── Task bar ─────────────────────────────────────────────
  function _barHtml(t, ms, viewStart, viewTotal, isBottleneck) {
    const vst       = viewStart.getTime();
    const start     = t.start_date ? new Date(t.start_date + 'T00:00:00') : null;
    const due       = t.due_date   ? new Date(t.due_date   + 'T00:00:00') : null;
    const msColor   = ms.color || '#6366f1';
    const discColor = t.discipline && typeof window.getDiscColor === 'function'
      ? window.getDiscColor(t.discipline) : msColor;

    let leftPct = 2, widthPct = 5;
    if (start && due && due >= start) {
      leftPct  = Math.max(0, (start.getTime() - vst) / viewTotal * 100);
      widthPct = Math.max(3, (due.getTime() - start.getTime()) / viewTotal * 100);
      widthPct = Math.min(widthPct, 100 - leftPct);
    } else if (due) {
      leftPct  = Math.max(0, (due.getTime() - vst) / viewTotal * 100 - 1.5);
      widthPct = 5;
    } else if (start) {
      leftPct  = Math.max(0, (start.getTime() - vst) / viewTotal * 100);
      widthPct = 5;
    }

    const isBlocked = t.status === 'blocked';
    const isDone    = t.status === 'done';
    const barColor  = isDone ? '#22c55e' : isBlocked ? '#ef4444' : discColor;
    const abbr      = _discAbbrev(t.discipline);

    return `<div class="msd-task-bar${isBlocked?' msd-bar-blocked':''}${isDone?' msd-bar-done':''}${isBottleneck?' msd-bar-bottleneck':''}"
        data-task-id="${t.id}"
        style="left:${leftPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%;background:${barColor}${isDone?'99':'cc'};border-color:${barColor}"
        title="${esc(t.title)}: ${SL[t.status]||t.status}${t.due_date?' – due '+_fmtDate(t.due_date):''}">
      <span class="msd-bar-lbl">${abbr?`[${abbr}] `:''}${esc(t.title.length>20?t.title.slice(0,20)+'…':t.title)}</span>
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
        const nz  = 'zoomReset' in btn.dataset ? 1 : Math.min(8, Math.max(1, cur + parseFloat(btn.dataset.zoomDelta || '0')));
        el.dataset.msdZoom = nz;
        _applyZoom(el, track, nz, ms, tasks);
      });
    });

    // Ctrl+Wheel zoom
    track.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const cur = parseFloat(el.dataset.msdZoom || '1');
      const nz  = Math.min(8, Math.max(1, cur + (e.deltaY < 0 ? 0.25 : -0.25)));
      el.dataset.msdZoom = nz;
      _applyZoom(el, track, nz, ms, tasks);
    }, { passive: false });
  }

  function _applyZoom(el, track, zoom, ms, tasks) {
    const inner = track.querySelector('.msd-gantt-track-inner');
    if (!inner) return;
    if (zoom <= 1) {
      inner.style.width = '100%';
      track.style.overflowX = 'hidden';
    } else {
      inner.style.width = (zoom * 100) + '%';
      track.style.overflowX = 'auto';
    }
    const badge = el.querySelector('.msd-zoom-lvl');
    if (badge) badge.textContent = (zoom % 1 === 0 ? zoom.toFixed(0) : zoom.toFixed(1)) + '×';
    const resetBtn = el.querySelector('.msd-zoom-reset');
    if (resetBtn) resetBtn.style.display = zoom > 1 ? '' : 'none';
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
  }
})();
