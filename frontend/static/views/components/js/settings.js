// ============================================================
// settings.js — Settings view render and save
// ============================================================
(function () {
  'use strict';

  window.renderSettings = function () {
    // Theme
    const isDark = document.body.classList.contains('theme-dark');
    const darkBtn  = document.getElementById('btn-theme-dark');
    const lightBtn = document.getElementById('btn-theme-light');
    if (darkBtn)  darkBtn.classList.toggle('active-view-btn', isDark);
    if (lightBtn) lightBtn.classList.toggle('active-view-btn', !isDark);

    // AI language
    const langEl = document.getElementById('ai-lang-select');
    const savedLang = (window.appData.config || {}).ai_response_language || 'English';
    if (langEl) langEl.value = savedLang;

    // Data dir
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        const dirEl = document.getElementById('data-dir-input');
        if (dirEl) dirEl.value = data.data_dir || '';
      }).catch(() => {});

    // Storage status
    _renderStorageStatus();

    // AI status
    if (typeof window.checkAIStatus === 'function') window.checkAIStatus();
  };

  function _renderStorageStatus() {
    fetch('/api/settings/status')
      .then(r => r.json())
      .then(data => {
        const el = document.getElementById('storage-status');
        if (!el) return;
        el.innerHTML = `
          <div class="settings-row">
            <label>Data folder</label>
            <span class="text-muted">${data.data_dir || '—'}</span>
          </div>
          <div class="settings-row">
            <label>Projects on server</label>
            <span>${data.project_count || 0}</span>
          </div>
          <div class="settings-row">
            <label>Disk used</label>
            <span>${data.disk_used_mb || 0} MB</span>
          </div>`;
      }).catch(() => {});
  }

  window.saveSettings = function () {
    const langEl  = document.getElementById('ai-lang-select');
    const dirEl   = document.getElementById('data-dir-input');
    const updates = {};
    if (langEl) updates.ai_response_language = langEl.value;
    if (dirEl && dirEl.value.trim()) updates.data_dir = dirEl.value.trim();

    // Save to local config
    window.appData.config = Object.assign(window.appData.config || {}, updates);
    window.saveData();

    // Save to server
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).then(r => r.json()).then(data => {
      if (data.success) _showToast('Settings saved!');
      else _showToast('Error saving settings.', true);
    }).catch(() => _showToast('Saved locally.'));
  };

  window.setTheme = function (theme) {
    document.body.className = 'theme-' + theme;
    localStorage.setItem('pp-theme', theme);
    window.appData.config = window.appData.config || {};
    window.appData.config.theme = theme;
    window.saveData();
    window.renderSettings();
    // Update theme icon
    const icon = document.querySelector('#btn-theme-toggle i');
    if (icon) icon.className = theme === 'dark' ? 'fa fa-moon' : 'fa fa-sun';
  };

  // Restore saved theme on load
  window.initTheme = function () {
    const saved = localStorage.getItem('pp-theme') || (window.appData.config || {}).theme || 'dark';
    document.body.className = 'theme-' + saved;
    const icon = document.querySelector('#btn-theme-toggle i');
    if (icon) icon.className = saved === 'dark' ? 'fa fa-moon' : 'fa fa-sun';
  };

  // ─── Toast notification ───────────────────────────────────
  function _showToast(msg, isError) {
    const existing = document.getElementById('pp-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'pp-toast';
    toast.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:9999;
      padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;
      background:${isError ? 'var(--color-danger)' : 'var(--color-success)'};
      color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.3);
      animation:slide-up .2s ease;`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  window.showToast = _showToast;
})();
