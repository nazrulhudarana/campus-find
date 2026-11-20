window.CampusFindModals = (() => {
  let backdropEl = null;
  let cardEl = null;

  const ensureModalDom = () => {
    if (backdropEl) return;

    backdropEl = document.createElement('div');
    backdropEl.className = 'cf-modal-backdrop';
    backdropEl.id = 'cfModalBackdrop';

    cardEl = document.createElement('div');
    cardEl.className = 'cf-modal-card';
    cardEl.id = 'cfModalCard';

    backdropEl.appendChild(cardEl);
    document.body.appendChild(backdropEl);

    backdropEl.addEventListener('click', (e) => {
      if (e.target === backdropEl) close();
    });
  };

  const open = (title, bodyHtml) => {
    ensureModalDom();
    cardEl.innerHTML = `
      <div class="cf-modal-head">
        <h3>${title}</h3>
        <button class="cf-modal-close" type="button" id="cfModalCloseBtn">&times;</button>
      </div>
      <div id="cfModalBody">${bodyHtml}</div>
    `;
    backdropEl.classList.add('open');
    document.getElementById('cfModalCloseBtn').addEventListener('click', close);
  };

  const close = () => {
    if (backdropEl) backdropEl.classList.remove('open');
  };

  const getToken = () => localStorage.getItem('campusfind_token') || '';

  const openAuthModal = (onSuccess) => {
    open(
      'Student Login / Register',
      `
      <div id="authFormWrap">
        <div class="cf-form-group">
          <label>Email or Student ID</label>
          <input class="cf-input" id="loginIdentifier" placeholder="e.g. 2023100000354 or email" />
        </div>
        <div class="cf-form-group">
          <label>Password</label>
          <input class="cf-input" type="password" id="loginPassword" placeholder="Enter password" />
        </div>
        <button class="cf-btn-primary" type="button" id="submitLoginBtn">Login</button>
        <div class="cf-switch-link" id="showRegisterSwitch">New student? Create an account</div>
      </div>
      `
    );

    const bindLogin = () => {
      document.getElementById('submitLoginBtn').addEventListener('click', async () => {
        const identifier = document.getElementById('loginIdentifier').value.trim();
        const password = document.getElementById('loginPassword').value;
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (!data.success) return alert(data.message || 'Login failed');
        localStorage.setItem('campusfind_token', data.token);
        close();
        if (onSuccess) onSuccess(data.user);
      });
    };

    const bindRegisterSwitch = () => {
      document.getElementById('showRegisterSwitch').addEventListener('click', () => {
        document.getElementById('cfModalBody').innerHTML = `
          <div class="cf-row-2">
            <div class="cf-form-group">
              <label>Full Name</label>
              <input class="cf-input" id="regName" placeholder="Nazrul Huda" />
            </div>
            <div class="cf-form-group">
              <label>Student ID</label>
              <input class="cf-input" id="regStudentId" placeholder="2023100000354" />
            </div>
          </div>
          <div class="cf-row-2">
            <div class="cf-form-group">
              <label>Email</label>
              <input class="cf-input" id="regEmail" placeholder="name@seu.edu.bd" />
            </div>
            <div class="cf-form-group">
              <label>Department</label>
              <input class="cf-input" id="regDept" value="CSE" />
            </div>
          </div>
          <div class="cf-row-2">
            <div class="cf-form-group">
              <label>Telegram Chat ID (Optional)</label>
              <input class="cf-input" id="regTgChatId" placeholder="For instant alerts" />
            </div>
            <div class="cf-form-group">
              <label>Password</label>
              <input class="cf-input" type="password" id="regPassword" placeholder="Min 6 chars" />
            </div>
          </div>
          <button class="cf-btn-primary cf-btn-orange" type="button" id="submitRegBtn">Create Account</button>
          <div class="cf-switch-link" id="backLoginSwitch">Already have an account? Login</div>
        `;

        document.getElementById('submitRegBtn').addEventListener('click', async () => {
          const payload = {
            name: document.getElementById('regName').value.trim(),
            studentId: document.getElementById('regStudentId').value.trim(),
            email: document.getElementById('regEmail').value.trim(),
            department: document.getElementById('regDept').value.trim(),
            telegramChatId: document.getElementById('regTgChatId').value.trim(),
            password: document.getElementById('regPassword').value
          };
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!data.success) return alert(data.message || 'Registration failed');
          localStorage.setItem('campusfind_token', data.token);
          close();
          if (onSuccess) onSuccess(data.user);
        });

        document.getElementById('backLoginSwitch').addEventListener('click', () => openAuthModal(onSuccess));
      });
    };

    bindLogin();
    bindRegisterSwitch();
  };

  const openReportModal = (onCreated) => {
    if (!getToken()) {
      return openAuthModal(() => openReportModal(onCreated));
    }

    open(
      'Report Lost / Found Item',
      `
      <div class="cf-row-2">
        <div class="cf-form-group">
          <label>Report Type</label>
          <select class="cf-select" id="repType">
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
        </div>
        <div class="cf-form-group">
          <label>Category</label>
          <input class="cf-input" id="repCategory" placeholder="Bag, Electronics, ID..." />
        </div>
      </div>
      <div class="cf-form-group">
        <label>Item Title</label>
        <input class="cf-input" id="repTitle" placeholder="e.g. Black Backpack" />
      </div>
      <div class="cf-row-2">
        <div class="cf-form-group">
          <label>Location on Campus</label>
          <input class="cf-input" id="repLocation" placeholder="Library, Main Gate, Lab..." />
        </div>
        <div class="cf-form-group">
          <label>Date &amp; Time</label>
          <input class="cf-input" type="datetime-local" id="repDate" />
        </div>
      </div>
      <div class="cf-form-group">
        <label>Description</label>
        <textarea class="cf-textarea" rows="2" id="repDesc" placeholder="Color, brand, marks..."></textarea>
      </div>
      <div class="cf-form-group">
        <label>Photos (Up to 3)</label>
        <input class="cf-input" type="file" id="repPhotos" accept="image/*" multiple />
      </div>
      <label class="cf-check-row">
        <input type="checkbox" id="repSecurityDrop" />
        <span>Drop at Security Desk (Generates 4-Digit Handover PIN)</span>
      </label>
      <button class="cf-btn-primary cf-btn-orange" type="button" id="submitReportBtn">Submit Report</button>
      <div id="reportResultBox"></div>
      `
    );

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('repDate').value = now.toISOString().slice(0, 16);

    document.getElementById('submitReportBtn').addEventListener('click', async () => {
      const formData = new FormData();
      formData.append('type', document.getElementById('repType').value);
      formData.append('category', document.getElementById('repCategory').value.trim() || 'General');
      formData.append('title', document.getElementById('repTitle').value.trim());
      formData.append('locationName', document.getElementById('repLocation').value.trim());
      formData.append('eventDate', document.getElementById('repDate').value);
      formData.append('description', document.getElementById('repDesc').value.trim());
      formData.append('dropAtSecurity', document.getElementById('repSecurityDrop').checked);

      const files = document.getElementById('repPhotos').files;
      for (let i = 0; i < Math.min(files.length, 3); i += 1) {
        formData.append('photos', files[i]);
      }

      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + getToken() },
        body: formData
      });
      const data = await res.json();
      if (!data.success) return alert(data.message || 'Failed to submit report');

      const pinHtml = data.item.securityPin
        ? `<div class="cf-pin-box">
             <div>Security Desk 4-Digit PIN</div>
             <div class="cf-pin-code">${data.item.securityPin}</div>
             <small>Matches found: ${data.matchesFound}</small>
           </div>`
        : `<div class="cf-pin-box">Report saved! Matches found: ${data.matchesFound}</div>`;

      document.getElementById('reportResultBox').innerHTML = pinHtml;
      if (onCreated) onCreated();
    });
  };

  const openClaimModal = (item) => {
    if (!getToken()) {
      return openAuthModal(() => openClaimModal(item));
    }

    open(
      `Claim: ${item.title || 'Item'}`,
      `
      <div class="cf-form-group">
        <label>Proof of Ownership / Details</label>
        <textarea class="cf-textarea" rows="3" id="claimProof" placeholder="Describe unique marks, contents, or serial details..."></textarea>
      </div>
      <div class="cf-form-group">
        <label>Additional Notes (Optional)</label>
        <input class="cf-input" id="claimNotes" placeholder="Preferred pickup time..." />
      </div>
      <button class="cf-btn-primary" type="button" id="submitClaimBtn">Send Claim Request</button>
      `
    );

    document.getElementById('submitClaimBtn').addEventListener('click', async () => {
      const proofAnswer = document.getElementById('claimProof').value.trim();
      const notes = document.getElementById('claimNotes').value.trim();
      if (!proofAnswer) return alert('Please provide proof details');

      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getToken()
        },
        body: JSON.stringify({ itemId: item._id, proofAnswer, notes })
      });
      const data = await res.json();
      if (!data.success) return alert(data.message || 'Claim failed');
      alert('Claim request submitted!');
      close();
    });
  };

  const openQrModal = async (itemId = 'sample-tag') => {
    open('QR Item Tag', '<p>Generating QR code...</p>');
    try {
      const res = await fetch(`/api/items/${itemId}/qr`);
      const data = await res.json();
      if (data.success && data.qrDataUrl) {
        document.getElementById('cfModalBody').innerHTML = `
          <div style="text-align:center">
            <img src="${data.qrDataUrl}" alt="Item QR" style="width:220px;height:220px;" />
            <p style="margin-top:8px;font-size:12.5px;color:#64748b">Print &amp; attach to your bag, ID card, or laptop.</p>
          </div>
        `;
        return;
      }
    } catch (_) {}
    document.getElementById('cfModalBody').innerHTML =
      '<p>Select a real reported item to generate its QR tag.</p>';
  };

  const openLeaderboardModal = async () => {
    open('Campus Hero Leaderboard', '<p>Loading heroes...</p>');
    const res = await fetch('/api/admin/leaderboard');
    const data = await res.json();
    const heroes = data.heroes || [];

    if (!heroes.length) {
      document.getElementById('cfModalBody').innerHTML =
        '<p>No hero points recorded yet. Return found items to earn +25 Hero Points!</p>';
      return;
    }

    document.getElementById('cfModalBody').innerHTML = heroes
      .map(
        (h, idx) => `
        <div class="cf-list-item">
          <div><strong>#${idx + 1} ${h.name}</strong> <small>(${h.department || 'CSE'})</small></div>
          <strong>&#9733; ${h.heroPoints}</strong>
        </div>
      `
      )
      .join('');
  };

  return {
    open,
    close,
    openAuthModal,
    openReportModal,
    openClaimModal,
    openQrModal,
    openLeaderboardModal
  };
})();