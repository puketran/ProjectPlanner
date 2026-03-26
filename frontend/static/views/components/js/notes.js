// ============================================================
// notes.js — Notes list, editor with markdown preview
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  let _previewMode = false;
  let _saveTimer   = null;

  // ─── Render notes list ────────────────────────────────────
  window.renderNotes = function (projectId) {
    projectId = projectId || window.currentProjectId;
    const container = document.getElementById('notes-list');
    if (!container) return;

    const proj  = window.getProject(projectId);
    const notes = proj ? (proj.notes || []).slice().sort((a,b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updated_at || '') > (a.updated_at || '') ? 1 : -1;
    }) : [];

    if (notes.length === 0) {
      container.innerHTML = '<p class="empty-state" style="font-size:var(--font-size-xs)">No notes yet.</p>';
      return;
    }

    container.innerHTML = notes.map(n => `
      <div class="note-item ${n.id === window.currentNoteId ? 'active' : ''}" data-note-id="${n.id}">
        ${n.pinned ? '<i class="fa fa-thumbtack note-item-pinned" title="Pinned"></i> ' : ''}
        <div class="note-item-title">${esc(n.title || 'Untitled')}</div>
        <div class="note-item-date">${_fmtDate(n.updated_at)}</div>
      </div>
    `).join('');

    container.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', function () {
        _openNote(projectId, this.dataset.noteId);
      });
    });
  };

  // ─── Open / show note editor ──────────────────────────────
  function _openNote(projectId, noteId) {
    window.currentNoteId = noteId;
    const proj = window.getProject(projectId);
    const note = proj ? (proj.notes || []).find(n => n.id === noteId) : null;

    // Highlight active note
    document.querySelectorAll('.note-item').forEach(el => {
      el.classList.toggle('active', el.dataset.noteId === noteId);
    });

    const emptyEl  = document.getElementById('note-editor-empty');
    const editorEl = document.getElementById('note-editor');
    if (!note) {
      if (emptyEl)  emptyEl.classList.remove('hidden');
      if (editorEl) editorEl.classList.add('hidden');
      return;
    }

    if (emptyEl)  emptyEl.classList.add('hidden');
    if (editorEl) editorEl.classList.remove('hidden');

    const titleInp   = document.getElementById('note-title-input');
    const contentInp = document.getElementById('note-content-input');
    const preview    = document.getElementById('note-preview');

    if (titleInp)   titleInp.value   = note.title   || '';
    if (contentInp) contentInp.value = note.content || '';
    if (preview)    preview.innerHTML = '';
    _previewMode = false;
    const previewBtn = document.getElementById('btn-note-preview');
    if (previewBtn) previewBtn.querySelector('i').className = 'fa fa-eye';
    if (contentInp) contentInp.classList.remove('hidden');
    if (preview)    preview.classList.add('hidden');

    // Bind auto-save
    const autoSave = () => {
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(() => _saveNote(projectId, noteId), 800);
    };
    if (titleInp) {
      titleInp.oninput = autoSave;
    }
    if (contentInp) {
      contentInp.oninput = autoSave;
    }
  }

  function _saveNote(projectId, noteId) {
    const proj = window.getProject(projectId);
    if (!proj) return;
    const note = (proj.notes || []).find(n => n.id === noteId);
    if (!note) return;
    const titleInp   = document.getElementById('note-title-input');
    const contentInp = document.getElementById('note-content-input');
    note.title      = (titleInp   || {}).value || '';
    note.content    = (contentInp || {}).value || '';
    note.updated_at = window.isoNow();
    proj.updated_at = note.updated_at;
    window.saveData();
    window.renderNotes(projectId);
  }

  // ─── Create note ──────────────────────────────────────────
  window.createNote = function (projectId) {
    projectId = projectId || window.currentProjectId;
    const proj = window.getProject(projectId);
    if (!proj) return;
    const id  = window.uid('note');
    const now = window.isoNow();
    const note = { id, title: 'New Note', content: '', pinned: false, created_at: now, updated_at: now };
    proj.notes = proj.notes || [];
    proj.notes.unshift(note);
    proj.updated_at = now;
    window.saveData();
    window.renderNotes(projectId);
    _openNote(projectId, id);
    const inp = document.getElementById('note-title-input');
    if (inp) { inp.focus(); inp.select(); }
  };

  // ─── Delete note ──────────────────────────────────────────
  window.deleteCurrentNote = function () {
    const projectId = window.currentProjectId;
    const noteId    = window.currentNoteId;
    if (!projectId || !noteId) return;
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title">Delete Note</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <p class="confirm-modal-text">This note will be permanently deleted.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="del-note-ok">Delete</button>
      </div>
    `);
    document.getElementById('del-note-ok').onclick = function () {
      const proj = window.getProject(projectId);
      if (proj) {
        proj.notes = (proj.notes || []).filter(n => n.id !== noteId);
        proj.updated_at = window.isoNow();
        window.saveData();
      }
      window.currentNoteId = null;
      window.closeModal();
      const emptyEl  = document.getElementById('note-editor-empty');
      const editorEl = document.getElementById('note-editor');
      if (emptyEl)  emptyEl.classList.remove('hidden');
      if (editorEl) editorEl.classList.add('hidden');
      window.renderNotes(projectId);
    };
  };

  // ─── Toggle preview ───────────────────────────────────────
  window.toggleNotePreview = function () {
    const contentInp = document.getElementById('note-content-input');
    const preview    = document.getElementById('note-preview');
    const btn        = document.getElementById('btn-note-preview');
    if (!contentInp || !preview) return;
    _previewMode = !_previewMode;
    if (_previewMode) {
      preview.innerHTML = _renderMarkdown(contentInp.value);
      contentInp.classList.add('hidden');
      preview.classList.remove('hidden');
      if (btn) btn.querySelector('i').className = 'fa fa-pen';
    } else {
      contentInp.classList.remove('hidden');
      preview.classList.add('hidden');
      if (btn) btn.querySelector('i').className = 'fa fa-eye';
    }
  };

  // ─── Minimal markdown → HTML ──────────────────────────────
  function _renderMarkdown(text) {
    let html = esc(text);
    html = html.replace(/^### (.+)$/gm,  '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm,   '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm,    '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g,    '<em>$1</em>');
    html = html.replace(/`(.+?)`/g,      '<code>$1</code>');
    html = html.replace(/^---$/gm,       '<hr>');
    html = html.replace(/^- (.+)$/gm,    '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><h([1-3])>/g,'<h$1>').replace(/<\/h([1-3])><\/p>/g,'</h$1>');
    html = html.replace(/<p><hr><\/p>/g,'<hr>');
    return html;
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  }
})();
