window.CampusFindDashboard = (() => {
  let cachedItems = [];
  let activeFeedTab = 'all';
  let activeCategory = 'all';
  let activeLocation = 'all';
  let activeSort = 'latest';
  let activeQuery = '';
  let isFeedMode = new URLSearchParams(window.location.search).get('view') === 'feed';

  const shortDept = (dept = '') => {
    const match = dept.match(/\(([^)]+)\)/);
    return match ? match[1] : dept || 'CSE';
  };

  const formatRelativeTime = (dateInput) => {
    if (!dateInput) return 'Recently';
    const diffSec = Math.max(1, Math.floor((Date.now() - new Date(dateInput).getTime()) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  };

  const renderUser = (user) => {
    if (!user) return;
    const deptShort = shortDept(user.department);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user.name || 'Student'
    )}&background=1261D6&color=ffffff&size=128`;

    ['pcTopAvatar', 'mobTopAvatar', 'dashProfileAvatar'].forEach((id) => {
      const img = document.getElementById(id);
      if (img) img.src = avatarUrl;
    });

    const nameEl = document.getElementById('dashUserName');
    const subEl = document.getElementById('dashUserSub');
    const ptsEl = document.getElementById('dashHeroPoints');
    const pcNameEl = document.getElementById('pcTopUserName');
    const pcSubEl = document.getElementById('pcTopUserSub');

    if (nameEl) nameEl.textContent = `${user.name}!`;
    if (subEl) subEl.textContent = `${user.studentId} • ${deptShort}`;
    if (ptsEl) ptsEl.textContent = `★ ${user.heroPoints ?? 0}`;
    if (pcNameEl) pcNameEl.textContent = user.name;
    if (pcSubEl) pcSubEl.textContent = user.role === 'admin' ? 'Admin' : 'Student';
  };

  const setActiveNavHighlight = (mode) => {
    document.querySelectorAll('.pc-nav-btn, .drawer-link, .nav-item').forEach((btn) => {
      const t = btn.dataset.tab;
      if (mode === 'feed') {
        btn.classList.toggle('active', t === 'feed');
      } else if (t === 'home' || t === 'feed') {
        btn.classList.toggle('active', t === 'home');
      }
    });
  };

  const switchViewMode = (mode) => {
    isFeedMode = mode === 'feed';
    const mainContent = document.querySelector('#dashboardView .main-content');
    const feedSec = ensureNewsfeedSection();
    if (!mainContent || !feedSec) return;

    const children = Array.from(mainContent.children);
    if (isFeedMode) {
      children.forEach((child) => {
        if (child.id !== 'cfCampusNewsfeedSection') {
          child.dataset.prevDisplay = child.style.display || '';
          child.style.display = 'none';
        }
      });
      feedSec.style.display = 'flex';
      renderNewsfeedCards();
      setActiveNavHighlight('feed');
    } else {
      children.forEach((child) => {
        if (child.id !== 'cfCampusNewsfeedSection') {
          child.style.display = child.dataset.prevDisplay || '';
        }
      });
      feedSec.style.display = 'none';
      setActiveNavHighlight('home');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const populateFilterOptions = () => {
    const catSel = document.getElementById('cfFeedCategorySel');
    const locSel = document.getElementById('cfFeedLocationSel');

    if (catSel) {
      const prev = activeCategory;
      const cats = Array.from(new Set(cachedItems.map((i) => i.category).filter(Boolean)));
      catSel.innerHTML =
        '<option value="all">Category: All</option>' +
        cats.map((c) => `<option value="${c}">${c}</option>`).join('');
      catSel.value = cats.includes(prev) ? prev : 'all';
      activeCategory = catSel.value;
    }

    if (locSel) {
      const prev = activeLocation;
      const locs = Array.from(
        new Set(
          cachedItems
            .map((i) => String(i.locationName || '').split('•')[0].trim())
            .filter(Boolean)
        )
      );
      locSel.innerHTML =
        '<option value="all">Location: All</option>' +
        locs.map((l) => `<option value="${l}">${l}</option>`).join('');
      locSel.value = locs.includes(prev) ? prev : 'all';
      activeLocation = locSel.value;
    }
  };

  const ensureNewsfeedSection = () => {
    let sec = document.getElementById('cfCampusNewsfeedSection');
    if (sec) return sec;

    const mainContent = document.querySelector('#dashboardView .main-content');
    if (!mainContent) return null;

    sec = document.createElement('section');
    sec.id = 'cfCampusNewsfeedSection';
    sec.className = 'cf-feed-shell';
    sec.style.display = isFeedMode ? 'flex' : 'none';
    sec.innerHTML = `
      <div class="cf-feed-hero">
        <div class="cf-feed-hero-inner">
          <div class="cf-feed-hero-icon"><i class="fa-solid fa-users"></i></div>
          <div>
            <h2>Campus Community <span>Feed</span></h2>
            <p>Browse lost and found items shared by our SEU community</p>
          </div>
        </div>
      </div>

      <div class="cf-feed-controls">
        <div class="cf-pill-bar" id="cfFeedPillBar">
          <button type="button" class="cf-pill-btn active" data-feed="all">
            <i class="fa-solid fa-border-all"></i> <span>All Posts</span>
          </button>
          <button type="button" class="cf-pill-btn" data-feed="lost">
            <i class="fa-solid fa-circle-exclamation"></i> <span>Lost Items</span>
          </button>
          <button type="button" class="cf-pill-btn" data-feed="found">
            <i class="fa-solid fa-circle-check"></i> <span>Found Items</span>
          </button>
          <button type="button" class="cf-pill-btn" data-feed="campus">
            <i class="fa-solid fa-location-dot"></i> <span>My Campus</span>
          </button>
        </div>

        <div class="cf-feed-search-wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="cfFeedSearchInput" placeholder="Search posts..." />
        </div>
      </div>

      <div class="cf-feed-subbar">
        <div class="cf-select-row">
          <select id="cfFeedCategorySel" class="cf-mini-select">
            <option value="all">Category: All</option>
          </select>
          <select id="cfFeedLocationSel" class="cf-mini-select">
            <option value="all">Location: All</option>
          </select>
          <select id="cfFeedSortSel" class="cf-mini-select">
            <option value="latest">Sort: Latest First</option>
            <option value="claims">Sort: Most Claims</option>
          </select>
        </div>
        <button type="button" id="cfFeedRefreshBtn" class="cf-refresh-btn">
          <i class="fa-solid fa-rotate-right"></i> <span>Refresh</span>
        </button>
      </div>

      <div class="cf-feed-list" id="cfNewsfeedGrid"></div>
    `;

    mainContent.appendChild(sec);

    sec.querySelectorAll('.cf-pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFeedTab = btn.dataset.feed || 'all';
        sec.querySelectorAll('.cf-pill-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderNewsfeedCards();
      });
    });

    document.getElementById('cfFeedSearchInput')?.addEventListener('input', (e) => {
      activeQuery = e.target.value || '';
      renderNewsfeedCards();
    });

    document.getElementById('cfFeedCategorySel')?.addEventListener('change', (e) => {
      activeCategory = e.target.value || 'all';
      renderNewsfeedCards();
    });

    document.getElementById('cfFeedLocationSel')?.addEventListener('change', (e) => {
      activeLocation = e.target.value || 'all';
      renderNewsfeedCards();
    });

    document.getElementById('cfFeedSortSel')?.addEventListener('change', (e) => {
      activeSort = e.target.value || 'latest';
      renderNewsfeedCards();
    });

    document.getElementById('cfFeedRefreshBtn')?.addEventListener('click', () => {
      const u = window.CampusFindAuth?.getSavedUser();
      loadRealData(u);
    });

    return sec;
  };

  const renderNewsfeedCards = () => {
    ensureNewsfeedSection();
    populateFilterOptions();

    const grid = document.getElementById('cfNewsfeedGrid');
    if (!grid) return;

    const q = activeQuery.trim().toLowerCase();

    let filtered = cachedItems.filter((item) => {
      if (activeFeedTab === 'lost' && item.type !== 'lost') return false;
      if (activeFeedTab === 'found' && item.type !== 'found') return false;
      if (activeFeedTab === 'campus') {
        const loc = String(item.locationName || '').toLowerCase();
        if (
          !loc.includes('seu') &&
          !loc.includes('campus') &&
          !loc.includes('library') &&
          !loc.includes('academic')
        ) {
          return false;
        }
      }

      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      if (activeLocation !== 'all') {
        const baseLoc = String(item.locationName || '').split('•')[0].trim();
        if (baseLoc !== activeLocation) return false;
      }

      if (q) {
        const hay = `${item.title || ''} ${item.description || ''} ${item.locationName || ''} ${
          item.category || ''
        } ${item.reporter?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    if (activeSort === 'claims') {
      filtered = [...filtered].sort((a, b) => Number(b.claimCount ?? 0) - Number(a.claimCount ?? 0));
    } else {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.createdAt || b.eventDate || 0) - new Date(a.createdAt || a.eventDate || 0)
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML =
        '<div class="cf-empty-feed">No lost or found posts match your current filter.</div>';
      return;
    }

    const fallbackImg =
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80';

    grid.innerHTML = filtered
      .map((item) => {
        const imgSrc =
          Array.isArray(item.photos) && item.photos.length > 0 ? item.photos[0] : fallbackImg;
        const isFound = item.type === 'found';
        const isApproved = Boolean(item.hasApprovedClaim || item.displayStatus === 'approved');
        const claimCount = Number(item.claimCount ?? 0);
        const rejectedCount = Number(item.rejectedCount ?? 0);
        const reporterName = item.reporter?.name || 'SEU Student';
        const relTime = formatRelativeTime(item.eventDate || item.createdAt);

        const rightStatsHtml = isFound
          ? `
            <div class="cf-stat-pair">
              <div class="cf-stat-box claims">
                <i class="fa-solid fa-users"></i>
                <strong>${claimCount}</strong>
                <span>Claim${claimCount === 1 ? '' : 's'}</span>
              </div>
              <div class="cf-stat-box rejected">
                <i class="fa-solid fa-circle-xmark"></i>
                <strong>${rejectedCount}</strong>
                <span>Rejected</span>
              </div>
            </div>
            <button type="button" class="cf-view-details-btn" data-action="claim" data-item-id="${item._id}">
              Claim Item <i class="fa-solid fa-arrow-right"></i>
            </button>
          `
          : `
            <div class="cf-lost-helper-note">
              <i class="fa-solid fa-hand-holding-heart"></i>
              <span>Saw or found this lost item? Report it as found to help the owner.</span>
            </div>
            <button type="button" class="cf-view-details-btn lost-found-btn" data-action="report-found" data-item-title="${encodeURIComponent(
              item.title || ''
            )}">
              I Found This <i class="fa-solid fa-arrow-right"></i>
            </button>
          `;

        return `
          <article class="cf-feed-row-card">
            <img src="${imgSrc}" alt="${item.title}" class="cf-feed-thumb" />

            <div class="cf-feed-main">
              <div class="cf-feed-top">
                <h3 class="cf-feed-title">${item.title}</h3>
                <span class="cf-type-badge ${isFound ? 'found' : 'lost'}">
                  <i class="fa-solid ${isFound ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
                  ${isFound ? 'FOUND' : 'LOST'}
                </span>
              </div>

              <p class="cf-feed-summary">${item.description || ''}</p>

              <div class="cf-feed-submeta">
                <span><i class="fa-solid fa-location-dot"></i> ${item.locationName || 'SEU Campus'}</span>
                <span><i class="fa-regular fa-clock"></i> ${relTime}</span>
              </div>

              <div class="cf-feed-author-row">
                <span class="cf-author-chip">
                  <i class="fa-solid fa-user"></i> Posted by: ${reporterName}
                </span>
              </div>

              ${
                isApproved
                  ? `
                <div class="cf-returned-banner">
                  <span><i class="fa-solid fa-circle-check"></i> Approved / Returned to: <strong>${
                    item.approvedRecipientName || 'Verified Claimant'
                  }</strong></span>
                  <span class="cf-returned-pill"><i class="fa-solid fa-check"></i> Approved</span>
                </div>
              `
                  : ''
              }
            </div>

            <div class="cf-feed-right-panel">
              ${rightStatsHtml}
            </div>
          </article>
        `;
      })
      .join('');

    grid.querySelectorAll('.cf-view-details-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'report-found') {
          const t = decodeURIComponent(btn.dataset.itemTitle || '');
          window.location.href = t
            ? `/report-found.html?lostTitle=${encodeURIComponent(t)}`
            : '/report-found.html';
          return;
        }

        const targetItem = cachedItems.find((it) => String(it._id) === String(btn.dataset.itemId));
        if (!targetItem) return;
        if (window.CampusFindClaims) {
          window.CampusFindClaims.openClaimModal(targetItem, () => {
            const u = window.CampusFindAuth?.getSavedUser();
            loadRealData(u);
          });
        } else {
          window.CampusFindModals?.openClaimModal(targetItem);
        }
      });
    });
  };

  const openClaimsPage = () => {
    window.location.href = '/claims.html';
  };

  const loadRealData = async (currentUser) => {
    renderUser(currentUser);
    ensureNewsfeedSection();

    try {
      const statsRes = await fetch('/api/admin/stats');
      const statsData = await statsRes.json();
      if (statsData.success && statsData.stats) {
        document.getElementById('statTotal').textContent = statsData.stats.total ?? 0;
        document.getElementById('statMatched').textContent = statsData.stats.matched ?? 0;
        document.getElementById('statPending').textContent = statsData.stats.pending ?? 0;
        document.getElementById('statResolved').textContent = statsData.stats.resolved ?? 0;
      }
    } catch (_) {}

    try {
      const itemsRes = await fetch('/api/items');
      const itemsData = await itemsRes.json();
      const items = (itemsData.success && itemsData.items) || [];
      cachedItems = items;
      if (isFeedMode) {
        renderNewsfeedCards();
      }

      const container = document.getElementById('recentItemsList');
      if (!container) return;

      if (items.length === 0) {
        container.innerHTML =
          '<p class="item-meta">No recent Lost &amp; Found reports yet. Click "Report Lost" or "Report Found" to post.</p>';
        return;
      }

      const latest = items[0];
      const imgSrc =
        latest.photos && latest.photos.length
          ? latest.photos[0]
          : 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=300&q=80';
      const isFound = latest.type === 'found';
      const isApproved = Boolean(latest.hasApprovedClaim || latest.displayStatus === 'approved');
      const claimCount = Number(latest.claimCount ?? 0);
      const rejectedCount = Number(latest.rejectedCount ?? 0);

      container.innerHTML = `
        <article class="item-card">
          <img src="${imgSrc}" alt="${latest.title}" class="item-thumb" />
          <div class="item-body">
            <div class="item-top-row">
              <strong>${latest.title}</strong>
              <span class="badge-lost">${
                isApproved ? 'Approved' : isFound ? 'Found' : 'Lost'
              }</span>
            </div>
            <p class="item-meta"><i class="fa-solid fa-location-dot"></i> ${
              latest.locationName || latest.locationLabel || 'SEU Campus'
            }</p>
            <p class="item-meta" style="font-weight:700;">
              ${
                isFound
                  ? `${claimCount} Claim(s) • ${rejectedCount} Rejected`
                  : 'Lost item report • Report if found'
              }
            </p>
            <button class="match-banner" type="button" id="recentClaimBtn">
              <span><i class="fa-solid ${isFound ? 'fa-hand' : 'fa-box-open'}"></i> ${
                isFound
                  ? isApproved
                    ? 'Approved • View / Chat'
                    : 'Claim Item'
                  : 'I Found This Item'
              }</span>
              <span>&rsaquo;</span>
            </button>
          </div>
        </article>
      `;

      document.getElementById('recentClaimBtn')?.addEventListener('click', () => {
        if (!isFound) {
          window.location.href = `/report-found.html?lostTitle=${encodeURIComponent(
            latest.title || ''
          )}`;
          return;
        }
        if (window.CampusFindClaims) {
          window.CampusFindClaims.openClaimModal(latest, () => {
            const u = window.CampusFindAuth?.getSavedUser();
            loadRealData(u);
          });
        } else {
          window.CampusFindModals?.openClaimModal(latest);
        }
      });
    } catch (_) {}
  };

  const setupUserDropdown = (btnId, ddId) => {
    const btn = document.getElementById(btnId);
    const dd = document.getElementById(ddId);
    if (!btn || !dd) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.user-dropdown.open').forEach((other) => {
        if (other !== dd) other.classList.remove('open');
      });
      const next = !dd.classList.contains('open');
      dd.classList.toggle('open', next);
      btn.setAttribute('aria-expanded', String(next));
    });

    dd.querySelectorAll('[data-action]').forEach((item) => {
      item.addEventListener('click', () => {
        dd.classList.remove('open');
        const action = item.dataset.action;
        if (action === 'logout') {
          window.CampusFindAuth?.showLanding();
        } else if (action === 'profile') {
          const profileTrigger =
            document.querySelector('.pc-nav-btn[data-tab="profile"]') ||
            document.querySelector('.drawer-link[data-tab="profile"]') ||
            document.querySelector('.nav-item[data-tab="profile"]');
          profileTrigger?.click();
        }
      });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (isFeedMode) {
      switchViewMode('feed');
    } else {
      setActiveNavHighlight('home');
    }

    document.querySelectorAll('.pc-search-box input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        activeQuery = e.target.value || '';
        const feedSearch = document.getElementById('cfFeedSearchInput');
        if (feedSearch) feedSearch.value = activeQuery;
        if (isFeedMode) renderNewsfeedCards();
      });
    });

    document.querySelectorAll('[data-tab="home"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchViewMode('home');
      });
    });

    document.querySelectorAll('[data-tab="feed"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchViewMode('feed');
      });
    });

    document.getElementById('mobReportLostBtn')?.addEventListener('click', () => {
      window.location.href = '/report-lost.html';
    });
    document.getElementById('mobReportFoundBtn')?.addEventListener('click', () => {
      window.location.href = '/report-found.html';
    });
    document.getElementById('qaReportLostBtn')?.addEventListener('click', () => {
      window.location.href = '/report-lost.html';
    });
    document.getElementById('qaReportFoundBtn')?.addEventListener('click', () => {
      window.location.href = '/report-found.html';
    });
    document.getElementById('openReportBtn')?.addEventListener('click', () => {
      window.location.href = '/report-lost.html';
    });

    document.querySelectorAll('[data-tab="report-lost"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = '/report-lost.html';
      });
    });
    document.querySelectorAll('[data-tab="report-found"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = '/report-found.html';
      });
    });

    document.querySelectorAll('[data-tab="claims"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openClaimsPage();
      });
    });

    document.getElementById('qaSearchBtn')?.addEventListener('click', () => {
      switchViewMode('feed');
    });
    document.getElementById('openSearchBtn')?.addEventListener('click', () => {
      switchViewMode('feed');
    });
    document.getElementById('qaMapBtn')?.addEventListener('click', () => {
      if (isFeedMode) switchViewMode('home');
      document.getElementById('campusMapPreview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.getElementById('pcExploreMapBtn')?.addEventListener('click', () => {
      if (isFeedMode) switchViewMode('home');
      document.getElementById('campusMapPreview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    document.getElementById('qrCenterBtn')?.addEventListener('click', () => {
      window.CampusFindModals?.openQrModal();
    });
    document.getElementById('qaScanQrBtn')?.addEventListener('click', () => {
      window.CampusFindModals?.openQrModal();
    });

    document
      .querySelectorAll('.mobile-hero-banner button, .pc-points-cta, .hero-points-pill, #pcJoinHeroBtn')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          window.CampusFindModals?.openLeaderboardModal();
        });
      });

    setupUserDropdown('pcUserMenuBtn', 'pcUserDropdown');
    setupUserDropdown('mobUserMenuBtn', 'mobUserDropdown');

    document.addEventListener('click', () => {
      document.querySelectorAll('.user-dropdown.open').forEach((dd) => dd.classList.remove('open'));
    });

    const logoutHandler = () => {
      window.CampusFindAuth?.showLanding();
    };
    document.getElementById('drawerLogoutBtn')?.addEventListener('click', logoutHandler);
    document.getElementById('pcLogoutBtn')?.addEventListener('click', logoutHandler);
  });

  return { loadRealData, openClaimsPage, switchViewMode };
})();