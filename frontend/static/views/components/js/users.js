// ============================================================
// users.js — User profiles: render, login, create, delete
// ============================================================
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Render user selection screen ────────────────────────
  window.renderUserSelection = function () {
    const container = document.getElementById('users-list');
    if (!container) return;
    container.innerHTML = '<p class="empty-state"><i class="fa fa-spinner fa-spin"></i> Loading…</p>';

    fetch('/api/users')
      .then(r => r.json())
      .then(data => {
        const users = data.users || [];
        if (users.length === 0) {
          container.innerHTML = '<p class="empty-state">No profiles yet. Create one below.</p>';
          return;
        }
        container.innerHTML = users.map(u => `
          <div class="user-card" data-user-id="${u.id}">
            <div class="user-avatar">${esc(u.name.slice(0,1).toUpperCase())}</div>
            <div class="user-info">
              <div class="user-name">${esc(u.name)}</div>
              <div class="user-meta">${u.project_count} project${u.project_count !== 1 ? 's' : ''}</div>
            </div>
            <button class="btn btn-ghost btn-sm delete-user-btn" data-user-id="${u.id}" title="Delete profile">
              <i class="fa fa-trash"></i>
            </button>
          </div>
        `).join('');

        container.querySelectorAll('.user-card').forEach(card => {
          card.addEventListener('click', function (e) {
            if (e.target.closest('.delete-user-btn')) return;
            _selectUser(this.dataset.userId, this.querySelector('.user-name').textContent.trim());
          });
        });
        container.querySelectorAll('.delete-user-btn').forEach(btn => {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            _confirmDeleteUser(this.dataset.userId);
          });
        });
      })
      .catch(() => {
        container.innerHTML = '<p class="empty-state text-danger">Could not load profiles.</p>';
      });
  };

  // ─── Select / login ───────────────────────────────────────
  function _selectUser(userId, userName) {
    // Try server login (checks if PIN is required)
    fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, pin: null })
    }).then(r => r.json()).then(data => {
      if (data.success) {
        _doLogin(data.user.id, data.user.name);
      } else {
        // PIN required
        _showPinModal(userId, userName);
      }
    }).catch(() => _doLogin(userId, userName));
  }

  function _doLogin(userId, userName) {
    window.appData.currentUser = { id: userId, name: userName };
    window.saveData();
    const el = document.getElementById('header-username');
    if (el) el.textContent = userName;
    window.switchView('dashboard');
    window.loadProjectsFromServer(userId).then(() => {
      if (typeof window.renderDashboard === 'function')        window.renderDashboard();
      if (typeof window.renderSidebarProjects === 'function') window.renderSidebarProjects();
    });
  }

  // ─── PIN modal ────────────────────────────────────────────
  function _showPinModal(userId, userName) {
    let pin = '';
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-lock"></i> PIN for ${esc(userName)}</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div id="pin-display" class="pin-modal-display">_ _ _ _</div>
        <div class="pin-keypad" id="pin-keypad">
          <button class="pin-key" data-k="1">1</button>
          <button class="pin-key" data-k="2">2</button>
          <button class="pin-key" data-k="3">3</button>
          <button class="pin-key" data-k="4">4</button>
          <button class="pin-key" data-k="5">5</button>
          <button class="pin-key" data-k="6">6</button>
          <button class="pin-key" data-k="7">7</button>
          <button class="pin-key" data-k="8">8</button>
          <button class="pin-key" data-k="9">9</button>
          <div></div>
          <button class="pin-key" data-k="0">0</button>
          <button class="pin-key delete" data-k="del">⌫</button>
        </div>
        <p id="pin-error" class="form-error" style="text-align:center;min-height:20px"></p>
      </div>
    `);

    document.getElementById('pin-keypad').addEventListener('click', function (e) {
      const btn = e.target.closest('.pin-key');
      if (!btn) return;
      const k = btn.dataset.k;
      if (k === 'del') { pin = pin.slice(0, -1); }
      else if (pin.length < 4) { pin += k; }
      const d = document.getElementById('pin-display');
      if (d) d.textContent = pin.length ? '•'.repeat(pin.length) : '_ _ _ _';
      if (pin.length === 4) {
        fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, pin })
        }).then(r => r.json()).then(data => {
          if (data.success) { window.closeModal(); _doLogin(userId, userName); }
          else {
            pin = '';
            const d2 = document.getElementById('pin-display'); if (d2) d2.textContent = '_ _ _ _';
            const er = document.getElementById('pin-error');   if (er) er.textContent = 'Incorrect PIN – try again.';
          }
        });
      }
    });
  }

  // ─── Delete user ──────────────────────────────────────────
  function _confirmDeleteUser(userId) {
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title">Delete Profile</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="confirm-modal-icon"><i class="fa fa-triangle-exclamation"></i></div>
        <p class="confirm-modal-text">This permanently deletes the profile and ALL its projects. This cannot be undone.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="confirm-del-user-btn">Delete</button>
      </div>
    `);
    document.getElementById('confirm-del-user-btn').onclick = async function () {
      await fetch('/api/users/' + userId, { method: 'DELETE' });
      Object.keys(window.appData.projects).forEach(pid => {
        if (window.appData.projects[pid].user_id === userId) delete window.appData.projects[pid];
      });
      window.saveData();
      window.closeModal();
      window.renderUserSelection();
    };
  }

  // ─── Create user modal ────────────────────────────────────
  window.showCreateUserModal = function () {
    window.openModal(`
      <div class="modal-header">
        <span class="modal-title"><i class="fa fa-user-plus"></i> New Profile</span>
        <button class="modal-close" onclick="window.closeModal()"><i class="fa fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input id="new-user-name" type="text" class="form-input" placeholder="Your name" />
        </div>
        <div class="form-group">
          <label class="form-label">PIN (4 digits, optional)</label>
          <input id="new-user-pin" type="password" class="form-input" placeholder="Leave blank for no PIN" maxlength="4" inputmode="numeric" pattern="[0-9]*" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-primary" id="confirm-create-user-btn">Create</button>
      </div>
    `);
    const nameInput = document.getElementById('new-user-name');
    nameInput.focus();
    const doCreate = async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.style.borderColor = 'var(--color-danger)'; return; }
      const pin = document.getElementById('new-user-pin').value || null;
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin })
      });
      if (r.ok) {
        window.closeModal();
        window.renderUserSelection();
      }
    };
    document.getElementById('confirm-create-user-btn').onclick = doCreate;
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doCreate(); });
  };
})();
