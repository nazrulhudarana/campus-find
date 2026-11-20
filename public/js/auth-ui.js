window.CampusFindAuth = (() => {
  const TOKEN_KEY = 'campusfind_token';
  const USER_KEY = 'campusfind_user';

  const getToken = () =>
    localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';

  const getSavedUser = () => {
    try {
      const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null';
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  };

  const showDashboard = (user) => {
    if (user) {
      const targetStorage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
      targetStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    const landingView = document.getElementById('landingView');
    const dashboardView = document.getElementById('dashboardView');
    if (landingView) landingView.style.display = 'none';
    if (dashboardView) dashboardView.style.display = '';
    if (window.CampusFindDashboard && window.CampusFindDashboard.loadRealData) {
      window.CampusFindDashboard.loadRealData(user);
    }
  };

  const showLanding = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    const landingView = document.getElementById('landingView');
    const dashboardView = document.getElementById('dashboardView');
    if (dashboardView) dashboardView.style.display = 'none';
    if (landingView) landingView.style.display = 'flex';
  };

  const goToAuth = (mode = 'login') => {
    window.location.href = `/auth.html?mode=${mode}`;
  };

  const init = async () => {
    document.getElementById('heroOpenLoginBtn')?.addEventListener('click', () => goToAuth('login'));
    document.getElementById('heroOpenSignupBtn')?.addEventListener('click', () => goToAuth('signup'));
    document.getElementById('lpGetStartedBtn')?.addEventListener('click', () => goToAuth('signup'));
    document.getElementById('lpBottomSignupBtn')?.addEventListener('click', () => goToAuth('signup'));
    document.getElementById('lpBottomLoginBtn')?.addEventListener('click', () => goToAuth('login'));

    const token = getToken();
    if (!token) {
      showLanding();
      return;
    }

    try {
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const meData = await meRes.json();
      if (meData.success && meData.user) {
        showDashboard(meData.user);
      } else {
        showLanding();
      }
    } catch (_) {
      showLanding();
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  return { getToken, getSavedUser, showDashboard, showLanding, goToAuth };
})();