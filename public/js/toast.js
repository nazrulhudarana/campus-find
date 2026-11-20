window.CfToast = (() => {
  const ensureContainer = () => {
    let el = document.getElementById('cfToastHost');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cfToastHost';
    el.style.cssText =
      'position:fixed;top:18px;right:18px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:380px;width:calc(100% - 36px);';
    document.body.appendChild(el);
    return el;
  };

  const show = (message, type = 'info') => {
    const host = ensureContainer();
    const card = document.createElement('div');
    const palette = {
      success: { bg: '#064e3b', border: '#34d399', text: '#ecfdf5' },
      error: { bg: '#7f1d1d', border: '#f87171', text: '#fef2f2' },
      info: { bg: '#091e46', border: '#fb923c', text: '#ffffff' }
    };
    const c = palette[type] || palette.info;

    card.style.cssText = `background:${c.bg};color:${c.text};border-left:4px solid ${c.border};padding:13px 16px;border-radius:14px;box-shadow:0 16px 36px rgba(7,25,61,0.32);font-size:13.5px;font-weight:600;line-height:1.45;display:flex;align-items:center;justify-content:space-between;gap:10px;`;
    card.innerHTML = `<span>${message}</span><button type="button" style="background:none;border:none;color:inherit;font-size:16px;cursor:pointer;padding:0 2px;">&times;</button>`;

    const removeCard = () => card.remove();
    card.querySelector('button').addEventListener('click', removeCard);
    host.appendChild(card);
    setTimeout(removeCard, 4200);
  };

  return { show };
})();