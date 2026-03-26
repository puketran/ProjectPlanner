// ============================================================
// toc.js — Sidebar mini project list (table-of-contents)
// ============================================================
(function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  window.renderSidebarProjects = function () {
    const container = document.getElementById('sidebar-projects-mini');
    if (!container) return;
    if (!window.appData.currentUser) { container.innerHTML = ''; return; }

    const projects = window.getUserProjects('active')
      .sort((a, b) => (b.updated_at || '') > (a.updated_at || '') ? 1 : -1)
      .slice(0, 8); // Show at most 8 recent projects

    if (projects.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = `
      <div class="sidebar-mini-header">Projects</div>
      ${projects.map(p => `
        <a class="sidebar-mini-item ${p.id === window.currentProjectId ? 'active' : ''}"
           data-project-id="${p.id}" href="#" title="${esc(p.name)}">
          <span class="sidebar-mini-dot" style="background:${esc(p.color||'#6366f1')}"></span>
          <span class="sidebar-mini-name">${esc(p.name)}</span>
        </a>`).join('')}
    `;

    container.querySelectorAll('.sidebar-mini-item').forEach(link => {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        window.openProject(this.dataset.projectId);
        window.renderSidebarProjects();
      });
    });
  };
})();
