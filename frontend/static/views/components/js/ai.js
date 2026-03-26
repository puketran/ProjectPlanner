// ============================================================
// ai.js — AI features: suggest tasks, summarize, ask, deadline
// ============================================================
(function () {
  'use strict';

  let _aiAvailable = null; // null = unknown, true/false after first check

  // ─── Check AI availability ────────────────────────────────
  async function _checkAI() {
    if (_aiAvailable !== null) return _aiAvailable;
    try {
      const r = await fetch('/api/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_title: '__test__', description: '', existing_tasks: [] })
      });
      _aiAvailable = r.status !== 503;
    } catch (_) {
      _aiAvailable = false;
    }
    return _aiAvailable;
  }

  // ─── Suggest tasks for current project ───────────────────
  window.aiSuggestTasks = async function () {
    const projectId = window.currentProjectId;
    const proj = window.getProject(projectId);
    if (!proj) return;

    const available = await _checkAI();
    if (!available) { _showAIUnavailable(); return; }

    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-wand-magic-sparkles"></i> AI Task Suggestions</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="ai-loading"><div class="ai-spinner"></div> Generating suggestions…</div>
      </div>
    `);

    const existing = (proj.tasks || []).filter(t => !t.deleted).map(t => t.title);
    try {
      const r = await fetch('/api/ai/suggest-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_title: proj.name, description: proj.description || '', existing_tasks: existing })
      });
      const data = await r.json();
      const suggestions = data.suggestions || [];
      if (suggestions.length === 0) {
        _updateModalBody('<p class="empty-state">No suggestions returned.</p>');
        return;
      }
      _updateModalBody(`
        <p style="color:var(--text-muted);font-size:var(--font-size-sm);margin-bottom:var(--spacing-md)">
          Select tasks to add to the project:
        </p>
        <div class="ai-suggestion-chips">
          ${suggestions.map((s, i) => `
            <label class="ai-suggestion-chip">
              <input type="checkbox" value="${_esc(s)}" checked />
              <span class="ai-suggestion-text">${_esc(s)}</span>
            </label>`).join('')}
        </div>
        <div class="modal-footer" style="margin-top:var(--spacing-md);padding-top:var(--spacing-md);border-top:1px solid var(--border-color)">
          <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="ai-add-tasks-btn"><i class="fa fa-plus"></i> Add Selected</button>
        </div>
      `);
      document.getElementById('ai-add-tasks-btn').onclick = function () {
        document.querySelectorAll('.ai-suggestion-chip input:checked').forEach(cb => {
          window.createTask(projectId, cb.value, 'todo');
        });
        window.closeModal();
      };
    } catch (e) {
      _updateModalBody(`<p class="form-error">Error: ${_esc(String(e))}</p>`);
    }
  };

  // ─── Summarize project ────────────────────────────────────
  window.aiSummarizeProject = async function (projectId) {
    projectId = projectId || window.currentProjectId;
    const proj = window.getProject(projectId);
    if (!proj) return;

    const available = await _checkAI();
    if (!available) { _showAIUnavailable(); return; }

    _setAIPanelAnswer('<div class="ai-loading"><div class="ai-spinner"></div> Summarizing…</div>');

    try {
      const r = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: proj.name, tasks: (proj.tasks||[]).filter(t=>!t.deleted) })
      });
      const data = await r.json();
      _setAIPanelAnswer(`<div class="ai-result-box"><div class="ai-result-label">Project Summary</div>${_esc(data.summary||'No summary.')}</div>`);
    } catch (e) {
      _setAIPanelAnswer(`<p class="form-error">Error: ${_esc(String(e))}</p>`);
    }
  };

  // ─── Smart deadline for current task ─────────────────────
  window.aiSmartDeadline = async function () {
    const projectId = window.currentProjectId;
    const taskId    = window.currentTaskId;
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    if (!task) return;

    const available = await _checkAI();
    if (!available) { _showAIUnavailable(); return; }

    _setAIPanelAnswer('<div class="ai-loading"><div class="ai-spinner"></div> Estimating…</div>');

    try {
      const r = await fetch('/api/ai/smart-deadline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_title: task.title, description: task.description||'' })
      });
      const data = await r.json();
      _setAIPanelAnswer(`
        <div class="ai-result-box">
          <div class="ai-result-label">Suggested Deadline</div>
          <strong>${_esc(data.date||'Unknown')}</strong><br>
          <span style="color:var(--text-muted);font-size:var(--font-size-xs)">${_esc(data.reasoning||'')}</span>
        </div>
        ${data.date ? `<button class="btn btn-primary btn-sm" style="margin-top:8px" id="ai-apply-date-btn">
          <i class="fa fa-calendar-check"></i> Apply this date
        </button>` : ''}
      `);
      const applyBtn = document.getElementById('ai-apply-date-btn');
      if (applyBtn && data.date) {
        applyBtn.onclick = function () {
          task.due_date   = data.date;
          task.updated_at = window.isoNow();
          window.touchProject(projectId);
          if (typeof window.refreshDetailPanel === 'function') window.refreshDetailPanel();
          window.renderTasks(projectId);
          _setAIPanelAnswer(`<div class="ai-result-box"><div class="ai-result-label">Applied!</div>Due date set to ${_esc(data.date)}</div>`);
        };
      }
    } catch (e) {
      _setAIPanelAnswer(`<p class="form-error">Error: ${_esc(String(e))}</p>`);
    }
  };

  // ─── Ask AI about current task ────────────────────────────
  window.aiAsk = async function () {
    const question  = (document.getElementById('ai-ask-input') || {}).value || '';
    const projectId = window.currentProjectId;
    const taskId    = window.currentTaskId;
    if (!question.trim()) return;

    const available = await _checkAI();
    if (!available) { _showAIUnavailable(); return; }

    const inp = document.getElementById('ai-ask-input');
    if (inp) inp.value = '';
    _setAIPanelAnswer('<div class="ai-loading"><div class="ai-spinner"></div> Thinking…</div>');

    const proj = window.getProject(projectId);
    const task = window.getTaskById ? window.getTaskById(projectId, taskId) : null;
    const context = {
      project: proj ? { name: proj.name, description: proj.description } : {},
      task:    task  ? { title: task.title, description: task.description, status: task.status } : {}
    };

    try {
      const r = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), context })
      });
      const data = await r.json();
      _setAIPanelAnswer(`
        <div class="ai-result-box">
          <div class="ai-result-label">AI Answer</div>
          ${_esc(data.answer || 'No answer returned.')}
        </div>`);
    } catch (e) {
      _setAIPanelAnswer(`<p class="form-error">Error: ${_esc(String(e))}</p>`);
    }
  };

  // ─── Ask "what next" ──────────────────────────────────────
  window.aiWhatNext = async function () {
    const inp = document.getElementById('ai-ask-input');
    if (inp) inp.value = 'What should I do next on this task?';
    window.aiAsk();
  };

  // ─── Detect blockers ─────────────────────────────────────
  window.aiDetectBlockers = async function (projectId) {
    projectId = projectId || window.currentProjectId;
    const proj = window.getProject(projectId);
    if (!proj) return;

    const available = await _checkAI();
    if (!available) return;

    try {
      const r = await fetch('/api/ai/detect-blockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: (proj.tasks||[]).filter(t=>!t.deleted) })
      });
      const data = await r.json();
      return data.blockers || [];
    } catch (_) { return []; }
  };

  // ─── Helpers ─────────────────────────────────────────────
  function _setAIPanelAnswer(html) {
    const el = document.getElementById('ai-panel-answer');
    if (el) el.innerHTML = html;
  }

  function _updateModalBody(html) {
    const el = document.querySelector('#modal-content .modal-body');
    if (el) el.innerHTML = html;
    else {
      const box = document.getElementById('modal-content');
      if (box) box.innerHTML = `<div class="modal-body">${html}</div>`;
    }
  }

  function _showAIUnavailable() {
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title">AI Not Available</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="ai-unavailable">
          <i class="fa fa-robot"></i>
          <p>AI features are not configured.</p>
          <p style="font-size:var(--font-size-sm)">Set <code>AZURE_OPENAI_API_KEY</code> and <code>ENDPOINT_URL</code> in your <code>.env</code> file.</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="window.closeModal()">OK</button>
      </div>
    `);
  }

  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ─── Check AI status on load ──────────────────────────────
  window.checkAIStatus = async function () {
    const badge = document.getElementById('ai-status-badge');
    if (!badge) return;
    const available = await _checkAI();
    badge.innerHTML = available
      ? '<span class="badge badge-active"><i class="fa fa-circle-check"></i> AI Connected</span>'
      : '<span class="badge badge-draft"><i class="fa fa-circle-xmark"></i> AI Not Configured — set AZURE_OPENAI_API_KEY in .env</span>';
  };
})();
