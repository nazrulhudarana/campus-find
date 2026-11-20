window.CampusFindClaims = (() => {
  const TOKEN_KEY = 'campusfind_token';
  const USER_KEY = 'campusfind_user';
  let liveWatchId = null;
  let livePollTimer = null;
  let activeCameraStream = null;
  let capturedHandoverDataUrl = '';
  const renderedMiniMaps = new Map();

  const isMobileViewport = () => window.innerWidth <= 768;

  const getToken = () =>
    localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';

  const getCurrentUser = () => {
    try {
      return JSON.parse(
        localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null'
      );
    } catch (_) {
      return null;
    }
  };

  const stopLiveTracking = () => {
    if (liveWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(liveWatchId);
      liveWatchId = null;
    }
    if (livePollTimer) {
      clearInterval(livePollTimer);
      livePollTimer = null;
    }
  };

  const stopCameraStream = () => {
    if (activeCameraStream) {
      activeCameraStream.getTracks().forEach((t) => t.stop());
      activeCameraStream = null;
    }
  };

  const destroyMiniMaps = () => {
    renderedMiniMaps.forEach((mapInst) => {
      try {
        mapInst.remove();
      } catch (_) {}
    });
    renderedMiniMaps.clear();
  };

  const compressImageFile = (file, maxDim = 900, quality = 0.66) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

  const compressCanvasToDataUrl = (videoEl, maxDim = 900, quality = 0.68) => {
    let { videoWidth: width, videoHeight: height } = videoEl;
    if (!width || !height) return '';

    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/webp', quality);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  };

  const getQuestionsForItem = (item) => {
    if (Array.isArray(item?.proofQuestions) && item.proofQuestions.length > 0) {
      return item.proofQuestions.map((q) =>
        typeof q === 'string'
          ? { question: q, expectedAnswer: '' }
          : { question: q.question || '', expectedAnswer: q.expectedAnswer || '' }
      );
    }
    if (item?.proofQuestion) {
      return [{ question: item.proofQuestion, expectedAnswer: '' }];
    }
    return [{ question: 'Describe a unique mark or detail on this item.', expectedAnswer: '' }];
  };

  const ensureModalRoot = () => {
    let backdrop = document.getElementById('cfClaimBackdrop');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.id = 'cfClaimBackdrop';
    backdrop.className = 'cf-modal-backdrop';
    backdrop.innerHTML = `
      <div class="cf-modal-card" role="dialog" aria-modal="true" id="cfClaimModalCard">
        <div class="cf-modal-head">
          <h3 id="cfClaimModalTitle">Submit Claim</h3>
          <button type="button" class="cf-modal-close" id="cfClaimModalClose" aria-label="Close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="cf-modal-body" id="cfClaimModalBody"></div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const closeModal = () => {
      stopLiveTracking();
      stopCameraStream();
      destroyMiniMaps();
      backdrop.classList.remove('open');
    };

    document.getElementById('cfClaimModalClose')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    return backdrop;
  };

  const openClaimModal = async (item, onSuccess) => {
    if (!item) return;
    const token = getToken();
    if (!token) {
      window.location.href = '/auth.html?mode=login';
      return;
    }

    const backdrop = ensureModalRoot();
    const titleEl = document.getElementById('cfClaimModalTitle');
    const bodyEl = document.getElementById('cfClaimModalBody');

    const me = getCurrentUser();
    const meId = String(me?._id || me?.id || '');
    const reporterId = String(item.reporter?._id || item.reporter || '');
    const isOwnItem = Boolean(meId && reporterId && meId === reporterId);

    titleEl.textContent = `Claim: ${item.title}`;

    if (isOwnItem) {
      bodyEl.innerHTML = `
        <div class="cf-claim-item-banner">
          <strong>${item.title}</strong>
          <span><i class="fa-solid fa-location-dot"></i> ${item.locationName || 'SEU Campus'} • ${
        item.type === 'found' ? 'Found Item' : 'Lost Item'
      }</span>
        </div>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:14px;color:#1e3a8a;font-size:13px;line-height:1.55;">
          <strong><i class="fa-solid fa-circle-info"></i> This is your own report</strong>
          <p style="margin-top:6px;">
            You cannot submit a claim on an item you reported yourself. Open <strong>My Claims</strong> to review claims or chat.
          </p>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <a href="/claims.html" class="cf-btn-primary" style="flex:1;min-width:180px;text-decoration:none;">
            <i class="fa-regular fa-comments"></i> Open My Claims
          </a>
          <button
            type="button"
            id="cfSwitchAccountBtn"
            style="flex:1;min-width:180px;border:1px solid #cbd5e1;background:#ffffff;color:#082B59;border-radius:12px;padding:12px 16px;font-size:13.5px;font-weight:800;cursor:pointer;"
          >
            <i class="fa-solid fa-right-left"></i> Switch Account
          </button>
        </div>
      `;
      backdrop.classList.add('open');

      document.getElementById('cfSwitchAccountBtn')?.addEventListener('click', () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        window.location.href = '/auth.html?mode=login';
      });
      return;
    }

    let alreadyClaimedClaim = null;
    try {
      const myRes = await fetch('/api/claims/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const myData = await myRes.json();
      if (myData.success && Array.isArray(myData.claims)) {
        alreadyClaimedClaim =
          myData.claims.find(
            (c) =>
              String(c.item?._id || c.item) === String(item._id) &&
              String(c.claimant?._id || c.claimant) === meId
          ) || null;
      }
    } catch (_) {}

    if (alreadyClaimedClaim || item.claimedByMe) {
      bodyEl.innerHTML = `
        <div class="cf-claim-item-banner">
          <strong>${item.title}</strong>
          <span><i class="fa-solid fa-location-dot"></i> ${item.locationName || 'SEU Campus'} • ${
        item.type === 'found' ? 'Found Item' : 'Lost Item'
      }</span>
        </div>

        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px;color:#9a3412;font-size:13px;line-height:1.55;">
          <strong><i class="fa-solid fa-circle-check"></i> Already Claimed</strong>
          <p style="margin-top:6px;">
            You have already claimed this post. You cannot claim the same post again. Open your existing claim to continue the chat or check status.
          </p>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${
            alreadyClaimedClaim
              ? `<button type="button" class="cf-btn-primary" id="cfOpenExistingClaimBtn" style="flex:1;min-width:180px;">
              <i class="fa-regular fa-comments"></i> Open Existing Claim &amp; Chat
            </button>`
              : ''
          }
          <a
            href="/claims.html"
            style="flex:1;min-width:180px;text-align:center;text-decoration:none;border:1px solid #cbd5e1;background:#ffffff;color:#082B59;border-radius:12px;padding:12px 16px;font-size:13.5px;font-weight:800;"
          >
            <i class="fa-solid fa-hand-holding"></i> Go to My Claims
          </a>
        </div>
      `;
      backdrop.classList.add('open');

      document.getElementById('cfOpenExistingClaimBtn')?.addEventListener('click', () => {
        backdrop.classList.remove('open');
        openReviewModal(alreadyClaimedClaim);
      });
      return;
    }

    const questions = getQuestionsForItem(item);

    bodyEl.innerHTML = `
      <div class="cf-claim-item-banner">
        <strong>${item.title}</strong>
        <span><i class="fa-solid fa-location-dot"></i> ${item.locationName || 'SEU Campus'} • ${
      item.type === 'found' ? 'Found Item' : 'Lost Item'
    }</span>
      </div>

      <form id="cfClaimSubmitForm">
        <div class="cf-pq-list">
          ${questions
            .map(
              (q, idx) => `
            <div class="cf-pq-card">
              <label>Question ${idx + 1}: ${q.question}</label>
              <input
                type="text"
                class="cf-input cf-pq-input"
                data-question="${encodeURIComponent(q.question)}"
                required
                placeholder="Type your answer to verify ownership..."
              />
            </div>`
            )
            .join('')}
        </div>

        <div class="cf-form-group" style="margin-top:12px;">
          <label>Message to Founder (Optional)</label>
          <textarea
            id="cfClaimNote"
            class="cf-input"
            rows="2"
            placeholder="Add extra ownership details..."
          ></textarea>
        </div>

        <button type="submit" class="cf-btn-primary" id="cfSubmitClaimBtn">
          <i class="fa-solid fa-paper-plane"></i> Submit Claim &amp; Check Match Score
        </button>
      </form>
    `;

    backdrop.classList.add('open');

    document.getElementById('cfClaimSubmitForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('cfSubmitClaimBtn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Evaluating Answers...';

      try {
        const answers = Array.from(bodyEl.querySelectorAll('.cf-pq-input')).map((inp) => ({
          question: decodeURIComponent(inp.dataset.question || ''),
          answer: inp.value.trim()
        }));

        const note = document.getElementById('cfClaimNote')?.value.trim() || '';

        const res = await fetch('/api/claims', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            itemId: item._id,
            answers,
            note
          })
        });

        const data = await res.json();
        if (!data.success) {
          window.CfToast?.show(data.message || 'Could not submit claim', 'error');
          return;
        }

        window.CfToast?.show(
          `Claim sent! Answer Match Score: ${data.claim?.answerMatchScore ?? 0}%`,
          'success'
        );
        backdrop.classList.remove('open');
        if (typeof onSuccess === 'function') onSuccess(data.claim);
        openReviewModal(data.claim);
      } catch (_) {
        window.CfToast?.show('Network error submitting claim', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Claim &amp; Check Match Score';
      }
    });
  };

  const renderDeliveryTicks = (msg, isMine) => {
    if (!isMine) return '';
    const st = msg.deliveryStatus || 'sent';
    if (st === 'seen') {
      return `<span class="cf-tick seen" title="Seen"><i class="fa-solid fa-check-double"></i> Seen</span>`;
    }
    if (st === 'delivered') {
      return `<span class="cf-tick delivered" title="Delivered"><i class="fa-solid fa-check-double"></i> Delivered</span>`;
    }
    return `<span class="cf-tick sent" title="Sent (Unseen)"><i class="fa-solid fa-check"></i> Sent • Unseen</span>`;
  };

  const renderConversationHtml = (claim, meId) => {
    const msgs = Array.isArray(claim.messages) ? claim.messages : [];
    if (msgs.length === 0) {
      return '<p class="cf-chat-empty">No messages yet. Start chatting below.</p>';
    }

    return msgs
      .map((m, idx) => {
        if (m.messageType === 'system' || m.messageType === 'reminder') {
          const isRem = m.messageType === 'reminder';
          return `
            <div class="cf-chat-system ${isRem ? 'reminder' : ''}">
              <i class="fa-solid ${isRem ? 'fa-bell' : 'fa-circle-info'}"></i> ${m.text}
            </div>
          `;
        }

        const isMine = String(m.sender?._id || m.sender) === String(meId);
        const timeStr = m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';

        let mediaHtml = '';
        if (m.imageUrl) {
          mediaHtml += `<a href="${m.imageUrl}" target="_blank" rel="noopener"><img src="${m.imageUrl}" alt="Photo" class="cf-chat-img" /></a>`;
        }

        let locHtml = '';
        if (
          (m.messageType === 'location' || m.messageType === 'live_location') &&
          m.location &&
          Number.isFinite(Number(m.location.lat)) &&
          Number.isFinite(Number(m.location.lng)) &&
          !(
            m.location.isLive &&
            m.location.liveActive === false &&
            Number(m.location.lat) === 0 &&
            Number(m.location.lng) === 0
          )
        ) {
          const lat = Number(m.location.lat);
          const lng = Number(m.location.lng);
          const gmapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
          const isLive = m.messageType === 'live_location' || Boolean(m.location.isLive);
          const isActive = Boolean(m.location.liveActive);
          const mapDomId = `cfMiniMap_${m._id || idx}`;
          const upd = m.location.updatedAt
            ? new Date(m.location.updatedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })
            : timeStr;

          locHtml = `
            <div class="cf-loc-card ${isLive ? 'live' : ''}">
              <div class="cf-loc-head">
                <i class="fa-solid ${isLive ? 'fa-satellite-dish' : 'fa-location-dot'}"></i>
                <strong>${m.location.label || (isLive ? 'Live Location' : 'Current Location')}</strong>
                ${
                  isLive
                    ? `<span class="cf-live-badge ${isActive ? 'on' : 'off'}">${
                        isActive ? 'LIVE' : 'ENDED'
                      }</span>`
                    : ''
                }
              </div>
              <div id="${mapDomId}" class="cf-mini-map" data-lat="${lat}" data-lng="${lng}">
                <div class="cf-map-fallback">
                  <div class="cf-map-pin"><i class="fa-solid fa-location-dot"></i></div>
                  <span>${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
                </div>
              </div>
              <small>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)} • ${upd}</small>
              <a href="${gmapsUrl}" target="_blank" rel="noopener" class="cf-map-link">
                <i class="fa-solid fa-map-location-dot"></i> Open in Google Maps
              </a>
            </div>
          `;
        }

        return `
          <div class="cf-chat-bubble ${isMine ? 'mine' : 'theirs'}">
            <div class="cf-chat-meta">
              <strong>${m.senderName || (isMine ? 'You' : 'Member')}</strong>
              <span>${timeStr}</span>
            </div>
            ${m.text ? `<p>${m.text}</p>` : ''}
            ${mediaHtml}
            ${locHtml}
            ${
              isMine
                ? `<div class="cf-chat-status-line">${renderDeliveryTicks(m, isMine)}</div>`
                : ''
            }
          </div>
        `;
      })
      .join('');
  };

  const mountLocationMiniMaps = () => {
    destroyMiniMaps();
    if (!window.L) return;

    document.querySelectorAll('.cf-mini-map[data-lat][data-lng]').forEach((el) => {
      const lat = Number(el.dataset.lat);
      const lng = Number(el.dataset.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      try {
        const mapInst = window.L.map(el, {
          center: [lat, lng],
          zoom: 16,
          zoomControl: false,
          attributionControl: false
        });
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(mapInst);
        window.L.marker([lat, lng]).addTo(mapInst);
        renderedMiniMaps.set(el.id, mapInst);
        setTimeout(() => {
          try {
            mapInst.invalidateSize();
          } catch (_) {}
        }, 120);
      } catch (_) {}
    });
  };

  const openReviewModal = async (initialClaim) => {
    if (!initialClaim?._id) return;

    const isDedicatedPage = Boolean(document.getElementById('waChatMount'));

    if (!isDedicatedPage && isMobileViewport()) {
      window.location.href = `/chat.html?claimId=${encodeURIComponent(initialClaim._id)}`;
      return;
    }

    stopLiveTracking();
    stopCameraStream();
    capturedHandoverDataUrl = '';

    const token = getToken();
    const me = getCurrentUser();
    const meId = me?._id || me?.id || '';

    const backdrop = isDedicatedPage ? null : ensureModalRoot();
    const titleEl = document.getElementById('cfClaimModalTitle');
    const bodyEl = isDedicatedPage
      ? document.getElementById('waChatMount')
      : document.getElementById('cfClaimModalBody');

    const fetchFreshClaim = async () => {
      try {
        const res = await fetch('/api/claims/my', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.claims)) {
          return data.claims.find((c) => String(c._id) === String(initialClaim._id)) || null;
        }
      } catch (_) {}
      return null;
    };

    let claim = (await fetchFreshClaim()) || initialClaim;
    const founderId = String(claim.founder?._id || claim.founder || '');
    const isFounder = meId && founderId === String(meId);
    const isLocked = Boolean(claim.chatLocked || claim.status === 'resolved');
    const isApproved = claim.status === 'approved';
    const hasMeetupSet = Boolean(claim.meetupPlan?.address && claim.meetupPlan?.meetupTime);
    const showApproveButton = !isApproved && !hasMeetupSet;

    const score = Number(claim.answerMatchScore ?? 0);
    const scoreTone = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
    const qaList = Array.isArray(claim.proofAnswers) ? claim.proofAnswers : [];

    const meetupTimeVal = claim.meetupPlan?.meetupTime
      ? new Date(
          new Date(claim.meetupPlan.meetupTime).getTime() -
            new Date().getTimezoneOffset() * 60000
        )
          .toISOString()
          .slice(0, 16)
      : '';

    if (titleEl) {
      titleEl.textContent = `Claim Review — ${claim.item?.title || 'Item'}`;
    }

    bodyEl.innerHTML = `
      <div class="cf-review-compact-bar">
        <div class="cf-review-person">
          <strong>${claim.claimant?.name || 'Student'}</strong>
          <span>${claim.claimant?.studentId || ''} ${
      claim.claimant?.department ? `• ${claim.claimant.department}` : ''
    }</span>
        </div>
        <div class="cf-compact-badges">
          <div class="cf-score-pill ${scoreTone}">
            <span>Match</span>
            <strong>${score}%</strong>
          </div>
          <span class="cf-status-tag status-${claim.status || 'pending'}">${(
      claim.status || 'pending'
    ).toUpperCase()}</span>
        </div>
      </div>

      ${
        isLocked
          ? `<div class="cf-archive-notice"><i class="fa-solid fa-lock"></i> Handover completed — conversation is archived and read-only.</div>`
          : ''
      }

      ${
        claim.status === 'rejected' && claim.rejectionReason
          ? `
        <div class="cf-reject-reason-box">
          <strong><i class="fa-solid fa-circle-exclamation"></i> Rejection Reason:</strong> ${claim.rejectionReason}
        </div>
      `
          : ''
      }

      <div class="cf-qa-dropdown">
        <button type="button" class="cf-qa-toggle-btn" id="cfToggleQaBtn" aria-expanded="false">
          <span><i class="fa-solid fa-circle-question"></i> Proof Questions &amp; Answers (${qaList.length})</span>
          <i class="fa-solid fa-chevron-down" id="cfQaChevron"></i>
        </button>
        <div class="cf-qa-dropdown-body" id="cfQaDropdownBody">
          ${qaList
            .map(
              (qa, idx) => `
            <div class="cf-qa-review-card">
              <div class="cf-qa-q">Q${idx + 1}: ${qa.question}</div>
              <div class="cf-qa-a"><strong>Answer:</strong> ${qa.answer || '—'}</div>
              ${
                isFounder && qa.expectedAnswer
                  ? `<div class="cf-qa-exp">Expected: ${qa.expectedAnswer}</div>`
                  : ''
              }
              <span class="cf-match-flag ${qa.matched ? 'ok' : 'no'}">
                ${qa.matched ? 'Matched' : 'Needs Check'}
              </span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      ${
        isApproved || hasMeetupSet
          ? `
        <div class="cf-meetup-box">
          <h4><i class="fa-solid fa-calendar-check"></i> Agreed Meetup Address &amp; Time</h4>
          ${
            !isLocked
              ? `
            <div class="cf-meetup-grid">
              <input
                type="text"
                id="cfMeetupAddressInput"
                class="cf-input"
                value="${claim.meetupPlan?.address || ''}"
                placeholder="Meetup address (e.g. SEU Main Gate / Library Lobby)"
              />
              <input
                type="datetime-local"
                id="cfMeetupTimeInput"
                class="cf-input"
                value="${meetupTimeVal}"
              />
            </div>
            <button type="button" class="cf-save-meetup-btn" id="cfSaveMeetupBtn">
              <i class="fa-solid fa-clock"></i> ${
                hasMeetupSet ? 'Update Meetup & Email' : 'Save Meetup Time & Enable Reminder'
              }
            </button>
          `
              : `
            <p class="item-meta">
              <strong>Address:</strong> ${claim.meetupPlan?.address || 'N/A'} •
              <strong>Time:</strong> ${
                claim.meetupPlan?.meetupTime
                  ? new Date(claim.meetupPlan.meetupTime).toLocaleString()
                  : 'N/A'
              }
            </p>
          `
          }
        </div>
      `
          : ''
      }

      <div class="cf-chat-box">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
          <h4 style="margin:0;"><i class="fa-regular fa-comments"></i> Conversation</h4>
          <button type="button" id="cfRefreshChatBtn" class="cf-mini-tool-btn">
            <i class="fa-solid fa-rotate"></i> Sync Seen Status
          </button>
        </div>

        <div class="cf-chat-thread" id="cfChatThread">
          ${renderConversationHtml(claim, meId)}
        </div>

        ${
          !isLocked
            ? `
          <div class="cf-composer-wrap">
            <div class="cf-plus-menu" id="cfPlusMenu">
              <label class="cf-plus-option" title="Send Compressed Image">
                <i class="fa-solid fa-image" style="color:#1261D6;"></i>
                <span>Photo (Auto-Compress)</span>
                <input type="file" id="cfChatImgInput" accept="image/*" hidden />
              </label>
              <button type="button" class="cf-plus-option" id="cfSendCurrentLocBtn">
                <i class="fa-solid fa-location-crosshairs" style="color:#16a34a;"></i>
                <span>Current Location</span>
              </button>
              <button type="button" class="cf-plus-option" id="cfToggleLiveLocBtn">
                <i class="fa-solid fa-satellite-dish" style="color:#dc2626;"></i>
                <span id="cfLiveBtnLabel">Live Location</span>
              </button>
            </div>

            <form class="cf-chat-form" id="cfChatForm">
              <button type="button" class="cf-plus-trigger" id="cfPlusToggleBtn" aria-label="Attach photo or location">
                <i class="fa-solid fa-plus"></i>
              </button>
              <input
                type="text"
                id="cfChatInput"
                class="cf-input"
                placeholder="Type a message..."
              />
              <button type="submit" class="cf-btn-primary cf-chat-send">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </form>
          </div>
        `
            : ''
        }
      </div>

      ${
        isFounder && !isLocked
          ? `
        <div class="cf-founder-actions ${showApproveButton ? 'three-col' : 'two-col'}">
          ${
            showApproveButton
              ? `<button type="button" class="cf-btn-approve" id="cfApproveClaimBtn">
              <i class="fa-solid fa-check"></i> Approve Claim
            </button>`
              : ''
          }
          <button type="button" class="cf-btn-reject" id="cfOpenRejectBoxBtn">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
          <button type="button" class="cf-btn-resolve" id="cfOpenHandoverProofBtn">
            <i class="fa-solid fa-camera"></i> Handover Proof &amp; Complete
          </button>
        </div>
      `
          : ''
      }

      ${
        isLocked && claim.handoverProof?.photoUrl
          ? `
        <div class="cf-handover-proof-box">
          <h4><i class="fa-solid fa-circle-check" style="color:#15803d;"></i> Handover Proof &amp; Person Verified</h4>
          <p class="item-meta">
            <strong>Received By:</strong> ${claim.handoverProof.recipientName || 'Claimant'}
            ${
              claim.handoverProof.recipientStudentId
                ? `(${claim.handoverProof.recipientStudentId})`
                : ''
            } •
            <strong>Real Person Confirmed:</strong> ${
              claim.handoverProof.confirmedRealPerson ? 'Yes' : 'No'
            }
          </p>
          ${
            claim.handoverProof.notes
              ? `<p class="item-meta"><strong>Note:</strong> ${claim.handoverProof.notes}</p>`
              : ''
          }
          <img src="${claim.handoverProof.photoUrl}" alt="Handover Proof" class="cf-handover-img" />
        </div>
      `
          : ''
      }
    `;

    if (backdrop) backdrop.classList.add('open');
    mountLocationMiniMaps();
    const threadEl = document.getElementById('cfChatThread');
    if (threadEl) threadEl.scrollTop = threadEl.scrollHeight;

    document.getElementById('cfToggleQaBtn')?.addEventListener('click', () => {
      const qaBody = document.getElementById('cfQaDropdownBody');
      const chev = document.getElementById('cfQaChevron');
      const btn = document.getElementById('cfToggleQaBtn');
      const opened = qaBody?.classList.toggle('open');
      btn?.setAttribute('aria-expanded', String(Boolean(opened)));
      if (chev) {
        chev.className = opened ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
      }
    });

    const plusBtn = document.getElementById('cfPlusToggleBtn');
    const plusMenu = document.getElementById('cfPlusMenu');
    plusBtn?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      plusMenu?.classList.toggle('open');
    });

    const sendPayload = async (payload) => {
      const res = await fetch(`/api/claims/${claim._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        window.CfToast?.show(data.message || 'Could not send message', 'error');
        return false;
      }
      claim = { ...claim, ...data.claim };
      if (threadEl) {
        threadEl.innerHTML = renderConversationHtml(claim, meId);
        mountLocationMiniMaps();
        threadEl.scrollTop = threadEl.scrollHeight;
      }
      return true;
    };

    livePollTimer = setInterval(async () => {
      if (!isDedicatedPage && !backdrop?.classList.contains('open')) {
        stopLiveTracking();
        return;
      }
      const updated = await fetchFreshClaim();
      if (updated && threadEl) {
        claim = updated;
        threadEl.innerHTML = renderConversationHtml(claim, meId);
        mountLocationMiniMaps();
      }
    }, 5000);

    document.getElementById('cfRefreshChatBtn')?.addEventListener('click', async () => {
      const updated = await fetchFreshClaim();
      if (updated && threadEl) {
        claim = updated;
        threadEl.innerHTML = renderConversationHtml(claim, meId);
        mountLocationMiniMaps();
        threadEl.scrollTop = threadEl.scrollHeight;
        window.CfToast?.show('Messages & seen status synced', 'success');
      }
    });

    document.getElementById('cfSaveMeetupBtn')?.addEventListener('click', async () => {
      const address = document.getElementById('cfMeetupAddressInput')?.value.trim() || '';
      const meetupTime = document.getElementById('cfMeetupTimeInput')?.value || '';
      if (!address || !meetupTime) {
        return window.CfToast?.show('Please enter both meetup address and time', 'error');
      }

      try {
        const res = await fetch(`/api/claims/${claim._id}/meetup`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ address, meetupTime })
        });
        const data = await res.json();
        if (!data.success) {
          return window.CfToast?.show(data.message || 'Could not save meetup', 'error');
        }
        if (data.mailResult?.sent) {
          window.CfToast?.show('Meetup saved & confirmation email sent!', 'success');
        } else {
          window.CfToast?.show(
            `Meetup saved, but email not sent (${data.mailResult?.reason || 'check SMTP in .env'}).`,
            'info'
          );
        }
        openReviewModal({ ...claim, ...data.claim });
      } catch (_) {
        window.CfToast?.show('Network error saving meetup', 'error');
      }
    });

    document.getElementById('cfChatImgInput')?.addEventListener('change', async (e) => {
      plusMenu?.classList.remove('open');
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressedDataUrl = await compressImageFile(file, 900, 0.66);
        const ok = await sendPayload({
          messageType: 'image',
          text: '',
          compressedImage: compressedDataUrl
        });
        if (ok) window.CfToast?.show('Compressed image sent', 'success');
      } catch (err) {
        window.CfToast?.show(err.message || 'Image compression failed', 'error');
      } finally {
        e.target.value = '';
      }
    });

    document.getElementById('cfSendCurrentLocBtn')?.addEventListener('click', () => {
      plusMenu?.classList.remove('open');
      if (!navigator.geolocation) {
        return window.CfToast?.show('Geolocation not supported in this browser', 'error');
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const ok = await sendPayload({
            messageType: 'location',
            text: 'Shared current location',
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              label: 'Current Location',
              isLive: false
            }
          });
          if (ok) window.CfToast?.show('Current location & map preview sent', 'success');
        },
        () => window.CfToast?.show('Please allow location permission', 'error'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    document.getElementById('cfToggleLiveLocBtn')?.addEventListener('click', async () => {
      plusMenu?.classList.remove('open');
      const labelEl = document.getElementById('cfLiveBtnLabel');

      if (liveWatchId !== null) {
        stopLiveTracking();
        if (labelEl) labelEl.textContent = 'Live Location';
        await sendPayload({
          messageType: 'live_location',
          location: { lat: 0, lng: 0, isLive: true, liveActive: false }
        });
        window.CfToast?.show('Live location stopped', 'info');
        return;
      }

      if (!navigator.geolocation) {
        return window.CfToast?.show('Geolocation not supported in this browser', 'error');
      }

      if (labelEl) labelEl.textContent = 'Stop Live Location';
      window.CfToast?.show('Live location sharing started', 'success');

      liveWatchId = navigator.geolocation.watchPosition(
        async (pos) => {
          await sendPayload({
            messageType: 'live_location',
            text: 'Live location update',
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              label: 'Live Location',
              isLive: true,
              liveActive: true
            }
          });
        },
        () => window.CfToast?.show('Unable to read live location', 'error'),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
      );
    });

    document.getElementById('cfChatForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      plusMenu?.classList.remove('open');
      const input = document.getElementById('cfChatInput');
      const text = input?.value.trim();
      if (!text) return;

      const ok = await sendPayload({ messageType: 'text', text });
      if (ok && input) input.value = '';
    });

    document.getElementById('cfApproveClaimBtn')?.addEventListener('click', async () => {
      try {
        const res = await fetch(`/api/claims/${claim._id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'approved' })
        });
        const data = await res.json();
        if (!data.success) {
          return window.CfToast?.show(data.message || 'Could not approve claim', 'error');
        }
        window.CfToast?.show('Claim approved! Set meetup address & time now.', 'success');
        openReviewModal({ ...claim, ...data.claim });
      } catch (_) {
        window.CfToast?.show('Network error approving claim', 'error');
      }
    });

    document.getElementById('cfOpenRejectBoxBtn')?.addEventListener('click', () => {
      document.getElementById('cfHandoverProofForm')?.remove();
      stopCameraStream();
      if (document.getElementById('cfRejectReasonForm')) return;

      const form = document.createElement('form');
      form.id = 'cfRejectReasonForm';
      form.className = 'cf-reject-form';
      form.innerHTML = `
        <h4><i class="fa-solid fa-ban"></i> Rejection Reason (Mandatory)</h4>
        <div class="cf-form-group">
          <textarea
            id="cfRejectReasonInput"
            class="cf-input"
            rows="2"
            required
            placeholder="Explain why this claim is being rejected..."
          ></textarea>
        </div>
        <button type="submit" class="cf-btn-reject" style="width:100%;padding:10px 14px;">
          Submit Rejection with Reason
        </button>
      `;

      bodyEl.appendChild(form);
      form.scrollIntoView({ behavior: 'smooth', block: 'end' });

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const reason = document.getElementById('cfRejectReasonInput')?.value.trim() || '';
        if (reason.length < 3) {
          return window.CfToast?.show('Please enter a valid rejection reason.', 'error');
        }

        try {
          const res = await fetch(`/api/claims/${claim._id}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'rejected', reason })
          });
          const data = await res.json();
          if (!data.success) {
            return window.CfToast?.show(data.message || 'Could not reject claim', 'error');
          }
          window.CfToast?.show('Claim rejected with reason.', 'success');
          openReviewModal({ ...claim, ...data.claim });
        } catch (_) {
          window.CfToast?.show('Network error rejecting claim', 'error');
        }
      });
    });

    document.getElementById('cfOpenHandoverProofBtn')?.addEventListener('click', async () => {
      document.getElementById('cfRejectReasonForm')?.remove();
      if (document.getElementById('cfHandoverProofForm')) return;
      capturedHandoverDataUrl = '';

      const form = document.createElement('form');
      form.id = 'cfHandoverProofForm';
      form.className = 'cf-handover-form';
      form.innerHTML = `
        <h4><i class="fa-solid fa-camera"></i> Live Camera Handover Verification</h4>

        <div class="cf-camera-box">
          <video id="cfHandoverVideo" autoplay playsinline muted class="cf-camera-video"></video>
          <img id="cfHandoverSnapshotImg" alt="Captured Proof" class="cf-camera-preview" style="display:none;" />
          <div class="cf-camera-actions">
            <button type="button" class="cf-cam-btn capture" id="cfCapturePhotoBtn">
              <i class="fa-solid fa-camera"></i> Capture Live Photo
            </button>
            <button type="button" class="cf-cam-btn retake" id="cfRetakePhotoBtn" style="display:none;">
              <i class="fa-solid fa-rotate-left"></i> Retake
            </button>
          </div>
          <small id="cfCameraStatusText" class="cf-cam-status">Starting live camera...</small>
        </div>

        <label class="cf-real-person-check">
          <input type="checkbox" id="cfConfirmRealPerson" required />
          <span>
            I confirm I am handing over the item to the real person (<strong>${
              claim.claimant?.name || 'Claimant'
            }</strong>) I chatted with.
          </span>
        </label>

        <div class="cf-form-group" style="margin-top:10px;">
          <label>Handover Notes (Optional)</label>
          <input type="text" id="cfHandoverNotes" class="cf-input" placeholder="e.g. Handed over at library gate" />
        </div>

        <button type="submit" class="cf-btn-primary" id="cfCompleteHandoverBtn" style="background:#16a34a;">
          <i class="fa-solid fa-lock"></i> Confirm Handover &amp; Lock Chat
        </button>
      `;

      bodyEl.appendChild(form);
      form.scrollIntoView({ behavior: 'smooth', block: 'end' });

      const videoEl = document.getElementById('cfHandoverVideo');
      const snapImgEl = document.getElementById('cfHandoverSnapshotImg');
      const captureBtn = document.getElementById('cfCapturePhotoBtn');
      const retakeBtn = document.getElementById('cfRetakePhotoBtn');
      const statusTxt = document.getElementById('cfCameraStatusText');

      try {
        stopCameraStream();
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Live camera is not supported on this device/browser.');
        }
        activeCameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        if (videoEl) {
          videoEl.srcObject = activeCameraStream;
          videoEl.style.display = 'block';
        }
        if (statusTxt) statusTxt.textContent = 'Live camera active — capture handover photo.';
      } catch (camErr) {
        if (statusTxt) {
          statusTxt.textContent = camErr.message || 'Camera permission denied or unavailable.';
        }
        window.CfToast?.show(camErr.message || 'Please allow camera access', 'error');
      }

      captureBtn?.addEventListener('click', () => {
        if (!videoEl || !videoEl.videoWidth) {
          return window.CfToast?.show('Camera frame not ready yet', 'error');
        }
        const shot = compressCanvasToDataUrl(videoEl, 900, 0.68);
        if (!shot) {
          return window.CfToast?.show('Could not capture photo', 'error');
        }
        capturedHandoverDataUrl = shot;
        if (snapImgEl) {
          snapImgEl.src = shot;
          snapImgEl.style.display = 'block';
        }
        if (videoEl) videoEl.style.display = 'none';
        if (captureBtn) captureBtn.style.display = 'none';
        if (retakeBtn) retakeBtn.style.display = 'inline-flex';
        if (statusTxt) statusTxt.textContent = 'Live photo captured & compressed.';
        stopCameraStream();
      });

      retakeBtn?.addEventListener('click', async () => {
        capturedHandoverDataUrl = '';
        if (snapImgEl) snapImgEl.style.display = 'none';
        if (retakeBtn) retakeBtn.style.display = 'none';
        if (captureBtn) captureBtn.style.display = 'inline-flex';
        try {
          activeCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
          });
          if (videoEl) {
            videoEl.srcObject = activeCameraStream;
            videoEl.style.display = 'block';
          }
          if (statusTxt) statusTxt.textContent = 'Live camera active — capture handover photo.';
        } catch (_) {
          if (statusTxt) statusTxt.textContent = 'Unable to restart camera.';
        }
      });

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const confirmedRealPerson = Boolean(document.getElementById('cfConfirmRealPerson')?.checked);
        const notes = document.getElementById('cfHandoverNotes')?.value.trim() || '';

        if (!capturedHandoverDataUrl) {
          return window.CfToast?.show('Please capture a live photo from camera first.', 'error');
        }
        if (!confirmedRealPerson) {
          return window.CfToast?.show('Please confirm the real person check.', 'error');
        }

        const submitBtn = document.getElementById('cfCompleteHandoverBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Completing...';

        try {
          const res = await fetch(`/api/claims/${claim._id}/handover`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              compressedPhoto: capturedHandoverDataUrl,
              capturedViaCamera: true,
              confirmedRealPerson,
              notes
            })
          });
          const data = await res.json();
          if (!data.success) {
            return window.CfToast?.show(data.message || 'Could not complete handover', 'error');
          }
          stopLiveTracking();
          stopCameraStream();
          if (data.mailResult?.sent) {
            window.CfToast?.show('Handover completed & congratulation email sent!', 'success');
          } else {
            window.CfToast?.show(
              `Handover completed! Email skipped (${data.mailResult?.reason || 'check SMTP in .env'}).`,
              'info'
            );
          }
          openReviewModal({ ...claim, ...data.claim });
        } catch (err) {
          window.CfToast?.show(err.message || 'Error completing handover', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirm Handover &amp; Lock Chat';
        }
      });
    });
  };

  const renderClaimsPanel = async (containerId = 'cfClaimsPanelMount', roleFilter = 'all') => {
    const mountEl = document.getElementById(containerId);
    if (!mountEl) return;

    const token = getToken();
    const me = getCurrentUser();
    const meId = me?._id || me?.id || '';

    if (!token) {
      mountEl.innerHTML = '<p class="item-meta">Please log in to view claims and conversations.</p>';
      return;
    }

    mountEl.innerHTML = '<p class="item-meta">Loading claims &amp; match scores...</p>';

    try {
      const res = await fetch('/api/claims/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      let claims = (data.success && data.claims) || [];

      if (roleFilter === 'claimant') {
        claims = claims.filter((c) => String(c.claimant?._id || c.claimant) === String(meId));
      } else if (roleFilter === 'founder') {
        claims = claims.filter((c) => String(c.founder?._id || c.founder) === String(meId));
      }

      if (claims.length === 0) {
        mountEl.innerHTML =
          '<p class="item-meta">No claims in this category yet. Inspect a reported item to submit proof answers and start a review chat.</p>';
        return;
      }

      mountEl.innerHTML = `
        <div class="cf-claims-grid">
          ${claims
            .map((c) => {
              const isFounder = meId && String(c.founder?._id || c.founder) === String(meId);
              const score = Number(c.answerMatchScore ?? 0);
              const scoreTone = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
              const unseenCount = (c.messages || []).filter(
                (m) => String(m.sender?._id || m.sender) !== String(meId) && m.deliveryStatus !== 'seen'
              ).length;

              return `
                <article class="cf-claim-card">
                  <div class="cf-claim-card-head">
                    <div>
                      <span class="cf-role-pill">${isFounder ? 'Founder Review' : 'My Claim'}</span>
                      <strong>${c.item?.title || 'Reported Item'}</strong>
                      <small>${
                        isFounder
                          ? `Claimant: ${c.claimant?.name || 'Student'}`
                          : `Location: ${c.item?.locationName || 'SEU Campus'}`
                      }</small>
                    </div>
                    <div class="cf-score-pill ${scoreTone}">
                      <span>Score</span>
                      <strong>${score}%</strong>
                    </div>
                  </div>
                  <div class="cf-claim-card-foot">
                    <span class="cf-status-tag status-${c.status || 'pending'}">${(
                c.status || 'pending'
              ).toUpperCase()}</span>
                    <button type="button" class="cf-open-chat-btn" data-claim-id="${c._id}">
                      <i class="fa-regular fa-comments"></i> ${
                        c.chatLocked ? 'View History' : 'Review & Chat'
                      } ${unseenCount > 0 ? `(${unseenCount} new)` : ''}
                    </button>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `;

      mountEl.querySelectorAll('.cf-open-chat-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const found = claims.find((item) => String(item._id) === String(btn.dataset.claimId));
          if (found) openReviewModal(found);
        });
      });
    } catch (_) {
      mountEl.innerHTML = '<p class="item-meta">Could not load claims right now.</p>';
    }
  };

  return {
    openClaimModal,
    openReviewModal,
    renderClaimsPanel
  };
})();