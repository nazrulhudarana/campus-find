window.CampusFindShell = (() => {
  const TOKEN_KEY = 'campusfind_token';
  const USER_KEY = 'campusfind_user';

  const getUser = () => {
    try {
      return JSON.parse(
        localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null'
      );
    } catch (_) {
      return null;
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.location.href = '/auth.html?mode=login';
  };

  const navItems = [
    { key: 'home', label: 'Dashboard', icon: 'fa-house', href: '/' },
    { key: 'feed', label: 'Community Feed', icon: 'fa-newspaper', href: '/?view=feed' },
    { key: 'search', label: 'Search Items', icon: 'fa-magnifying-glass', href: '/#search' },
    { key: 'report-lost', label: 'Report Lost', icon: 'fa-circle-exclamation', href: '/report-lost.html' },
    { key: 'report-found', label: 'Report Found', icon: 'fa-circle-check', href: '/report-found.html' },
    { key: 'map', label: 'Campus Map', icon: 'fa-location-dot', href: '/#map' },
    { key: 'reports', label: 'My Reports', icon: 'fa-file-lines', href: '/#reports' },
    { key: 'claims', label: 'My Claims', icon: 'fa-hand-holding', href: '/#claims' },
    { key: 'notifications', label: 'Notifications', icon: 'fa-bell', href: '/#notifications', badge: '3' },
    { key: 'profile', label: 'Profile', icon: 'fa-user', href: '/#profile' }
  ];

  const mount = (activeKey = 'home') => {
    const body = document.body;
    const existingMain = document.getElementById('pageContent');
    if (!existingMain) return;

    const user = getUser() || { name: 'Student', role: 'student' };
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user.name || 'Student'
    )}&background=1261D6&color=ffffff&size=128`;

    const root = document.createElement('div');
    root.className = 'cf-shell-root';

    const pcNavHtml = navItems
      .map(
        (n) => `
        <button type="button" class="cf-pc-item ${n.key === activeKey ? 'active' : ''}" data-href="${n.href}">
          <i class="fa-solid ${n.icon}"></i>
          <span>${n.label}</span>
          ${n.badge ? `<span class="badge-count">${n.badge}</span>` : ''}
        </button>`
      )
      .join('');

    const drawerNavHtml = navItems
      .map(
        (n) => `
        <button type="button" class="cf-drawer-item ${n.key === activeKey ? 'active' : ''}" data-href="${n.href}">
          <i class="fa-solid ${n.icon}"></i>
          <span>${n.label}</span>
        </button>`
      )
      .join('');

    root.innerHTML = `
      <div class="cf-drawer-backdrop" id="cfDrawerBackdrop"></div>
      <aside class="cf-drawer" id="cfDrawer">
        <div class="cf-drawer-head">
          <a href="/"><img src="/uploads/logo.png" alt="CampusFind" class="cf-drawer-logo" /></a>
          <button type="button" class="cf-drawer-close" id="cfCloseDrawer"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <nav class="cf-drawer-nav">${drawerNavHtml}</nav>
        <button type="button" class="cf-drawer-logout" id="cfDrawerLogout">
          <i class="fa-solid fa-right-from-bracket"></i> Logout
        </button>
      </aside>

      <aside class="cf-pc-sidebar">
        <div class="cf-pc-brand">
          <a href="/"><img src="/uploads/logo.png" alt="CampusFind" class="cf-pc-logo" /></a>
        </div>
        <nav class="cf-pc-nav">${pcNavHtml}</nav>
        <button type="button" class="cf-pc-logout" id="cfPcLogout">
          <i class="fa-solid fa-right-from-bracket"></i> Logout
        </button>
      </aside>

      <div class="cf-pc-main">
        <header class="cf-pc-topbar">
          <div class="cf-pc-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" placeholder="Search for items, locations..." />
          </div>
          <div class="cf-pc-right">
            <button type="button" class="cf-pc-bell" aria-label="Notifications">
              <i class="fa-regular fa-bell"></i>
              <span class="badge-count">3</span>
            </button>
            <div class="cf-menu-wrap">
              <button type="button" class="cf-pc-user-btn" id="cfPcUserBtn">
                <img src="${avatarUrl}" alt="User" />
                <div>
                  <strong>${user.name || 'Student'}</strong>
                  <small>${user.role === 'admin' ? 'Admin' : 'Student'}</small>
                </div>
                <i class="fa-solid fa-chevron-down" style="font-size:11px;color:#64748b;"></i>
              </button>
              <div class="cf-dropdown" id="cfPcDropdown">
                <button type="button" class="cf-dd-btn" data-action="profile"><i class="fa-regular fa-user"></i> My Profile</button>
                <button type="button" class="cf-dd-btn danger" data-action="logout"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
              </div>
            </div>
          </div>
        </header>

        <header class="cf-mob-header">
          <div class="cf-mob-toprow">
            <button type="button" class="cf-mob-ham" id="cfOpenDrawer" aria-label="Menu">
              <i class="fa-solid fa-bars"></i>
            </button>
            <a href="/" class="cf-mob-logo-link">
              <img src="/uploads/logo.png" alt="CampusFind" class="cf-mob-logo-img" />
            </a>
            <div class="cf-mob-right">
              <button type="button" class="cf-mob-bell" aria-label="Notifications">
                <i class="fa-regular fa-bell"></i>
                <span class="badge-count">3</span>
              </button>
              <div class="cf-menu-wrap">
                <button type="button" class="cf-mob-avatar-btn" id="cfMobUserBtn" aria-label="Profile menu">
                  <img src="${avatarUrl}" alt="Profile" />
                </button>
                <div class="cf-dropdown" id="cfMobDropdown">
                  <button type="button" class="cf-dd-btn" data-action="profile"><i class="fa-regular fa-user"></i> My Profile</button>
                  <button type="button" class="cf-dd-btn danger" data-action="logout"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div class="cf-shell-body" id="cfShellBodyMount"></div>
      </div>

      <nav class="cf-bottom-nav">
        <button type="button" class="cf-bnav-btn ${activeKey === 'home' ? 'active' : ''}" data-href="/">
          <i class="fa-solid fa-house"></i><span>Home</span>
        </button>
        <button type="button" class="cf-bnav-btn ${activeKey === 'feed' ? 'active' : ''}" data-href="/?view=feed">
          <i class="fa-solid fa-newspaper"></i><span>Feed</span>
        </button>
        <button type="button" class="cf-qr-fab" data-href="/#qr" aria-label="QR">
          <i class="fa-solid fa-qrcode"></i>
        </button>
        <button type="button" class="cf-bnav-btn" data-href="/#hero">
          <i class="fa-solid fa-trophy"></i><span>Hero</span>
        </button>
        <button type="button" class="cf-bnav-btn" data-href="/#profile">
          <i class="fa-solid fa-user"></i><span>Profile</span>
        </button>
      </nav>
    `;

    const shellBodyMount = root.querySelector('#cfShellBodyMount');
    shellBodyMount.appendChild(existingMain);
    body.prepend(root);

    const drawer = document.getElementById('cfDrawer');
    const backdrop = document.getElementById('cfDrawerBackdrop');
    const closeDrawer = () => {
      drawer?.classList.remove('open');
      backdrop?.classList.remove('open');
    };
    document.getElementById('cfOpenDrawer')?.addEventListener('click', () => {
      drawer?.classList.add('open');
      backdrop?.classList.add('open');
    });
    document.getElementById('cfCloseDrawer')?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);

    root.querySelectorAll('[data-href]').forEach((el) => {
      el.addEventListener('click', () => {
        window.location.href = el.dataset.href;
      });
    });

    const wireDropdown = (btnId, ddId) => {
      const btn = document.getElementById(btnId);
      const dd = document.getElementById(ddId);
      btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.cf-dropdown.open').forEach((d) => {
          if (d !== dd) d.classList.remove('open');
        });
        dd?.classList.toggle('open');
      });
      dd?.querySelectorAll('[data-action]').forEach((act) => {
        act.addEventListener('click', () => {
          if (act.dataset.action === 'logout') logout();
          else window.location.href = '/#profile';
        });
      });
    };

    wireDropdown('cfPcUserBtn', 'cfPcDropdown');
    wireDropdown('cfMobUserBtn', 'cfMobDropdown');
    document.addEventListener('click', () => {
      document.querySelectorAll('.cf-dropdown.open').forEach((d) => d.classList.remove('open'));
    });

    document.getElementById('cfDrawerLogout')?.addEventListener('click', logout);
    document.getElementById('cfPcLogout')?.addEventListener('click', logout);
  };

  return { mount };
})();