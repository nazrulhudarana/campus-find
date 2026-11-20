document.addEventListener('DOMContentLoaded', () => {
  const drawer = document.getElementById('mobileDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const openBtn = document.getElementById('openDrawerBtn');
  const closeBtn = document.getElementById('closeDrawerBtn');

  const toggleDrawer = (state) => {
    if (drawer) drawer.classList.toggle('open', state);
    if (backdrop) backdrop.classList.toggle('open', state);
  };

  if (openBtn) openBtn.addEventListener('click', () => toggleDrawer(true));
  if (closeBtn) closeBtn.addEventListener('click', () => toggleDrawer(false));
  if (backdrop) backdrop.addEventListener('click', () => toggleDrawer(false));

  const syncTabs = (tab) => {
    document.querySelectorAll('[data-tab]').forEach((el) => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
  };

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncTabs(btn.dataset.tab);
      toggleDrawer(false);
    });
  });

  const logoutHandler = () => {
    localStorage.removeItem('campusfind_token');
    toggleDrawer(false);
    alert('Logged out successfully.');
  };

  const mobileLogout = document.getElementById('drawerLogoutBtn');
  const pcLogout = document.getElementById('pcLogoutBtn');
  if (mobileLogout) mobileLogout.addEventListener('click', logoutHandler);
  if (pcLogout) pcLogout.addEventListener('click', logoutHandler);
});