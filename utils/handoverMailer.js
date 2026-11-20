const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const LOGO_PATH = path.join(__dirname, '..', 'uploads', 'logo.png');

let cachedTransporter = null;

const getMailConfig = () => {
  const host = String(process.env.SMTP_HOST || process.env.EMAIL_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const user = String(process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = String(
    process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.SMTP_APP_PASSWORD || ''
  )
    .replace(/\s+/g, '')
    .trim();
  const from = String(
    process.env.SMTP_FROM ||
      process.env.MAIL_FROM ||
      process.env.EMAIL_FROM ||
      `"CampusFind" <${user || 'nazrulhudarana@gmail.com'}>`
  ).trim();

  return { host, port, user, pass, from };
};

const getTransporter = () => {
  const { host, port, user, pass } = getMailConfig();
  if (!host || !user || !pass) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  return cachedTransporter;
};

const getLogoAttachment = () => {
  if (fs.existsSync(LOGO_PATH)) {
    return [
      {
        filename: 'logo.png',
        path: LOGO_PATH,
        cid: 'campusfindlogo'
      }
    ];
  }
  return [];
};

const formatDateTime = (dt) => {
  if (!dt) return 'To be confirmed';
  return new Date(dt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const renderBrandHeader = (subtitle = 'Southeast University • Find • Claim • Reconnect') => {
  const hasLogo = fs.existsSync(LOGO_PATH);
  const brandVisual = hasLogo
    ? `
      <div style="display:inline-block;background:#ffffff;padding:10px 20px;border-radius:16px;box-shadow:0 8px 20px rgba(0,0,0,0.22);">
        <img src="cid:campusfindlogo" alt="CampusFind Logo" style="height:92px;max-width:290px;width:auto;object-fit:contain;display:block;" />
      </div>
    `
    : `
      <div style="display:inline-block;background:#ffffff;padding:12px 22px;border-radius:16px;">
        <span style="font-size:28px;font-weight:900;letter-spacing:-0.4px;color:#061636;">Campus<span style="color:#ea580c;">Find</span></span>
      </div>
    `;

  return `
    <tr>
      <td style="background:linear-gradient(135deg,#061636 0%,#0e3478 58%,#1d4ed8 100%);padding:26px 22px;text-align:center;color:#ffffff;">
        ${brandVisual}
        <div style="font-size:13px;font-weight:600;color:#e2e8f0;margin-top:10px;letter-spacing:0.2px;">
          ${subtitle}
        </div>
      </td>
    </tr>
  `;
};

const renderEmailFooter = () => {
  const iconStyle =
    'display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;border-radius:999px;background:#1e293b;border:1px solid rgba(255,255,255,0.22);margin:0 5px;text-decoration:none;';

  return `
    <tr>
      <td style="background:#07041c;padding:24px 20px;text-align:center;color:#e2e8f0;">
        <div style="margin-bottom:14px;">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" style="${iconStyle}">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width="17" height="17" style="vertical-align:middle;border:0;" />
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style="${iconStyle}">
            <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" width="17" height="17" style="vertical-align:middle;border:0;" />
          </a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" style="${iconStyle}">
            <img src="https://cdn-icons-png.flaticon.com/512/3536/3536505.png" alt="LinkedIn" width="17" height="17" style="vertical-align:middle;border:0;" />
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub" style="${iconStyle}">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733553.png" alt="GitHub" width="17" height="17" style="vertical-align:middle;border:0;filter:invert(1);" />
          </a>
        </div>

        <div style="font-size:13.5px;font-weight:800;color:#ffffff;margin-bottom:4px;">
          CampusFind by <span style="color:#fb923c;">Nazrul Huda</span>
        </div>
        <div style="font-size:12px;color:#cbd5e1;margin-bottom:8px;">
          <a href="mailto:nazrulhudarana@gmail.com" style="color:#f8fafc;text-decoration:none;">nazrulhudarana@gmail.com</a>
        </div>
        <div style="font-size:11px;color:#94a3b8;">
          &copy; 2026 CampusFind • Southeast University (@seu.edu.bd)
        </div>
      </td>
    </tr>
  `;
};

const buildHandoverCardHtml = ({
  headerSubtitle,
  badgeText,
  badgeBg,
  badgeColor,
  heading,
  leadText,
  sectionsHtml,
  footerNoteHtml
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#eef3f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:26px 12px;background:#eef3f9;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 44px rgba(15,23,42,0.12);border:1px solid #cbd5e1;">
          ${renderBrandHeader(headerSubtitle)}

          <tr>
            <td style="padding:26px 24px;background:#ffffff;color:#0f172a;">
              <span style="display:inline-block;background:${badgeBg};color:${badgeColor};font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px;margin-bottom:12px;border:1px solid rgba(15,23,42,0.08);">
                ${badgeText}
              </span>

              <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#0b2559;line-height:1.3;">
                ${heading}
              </h2>

              <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#1e293b;">
                ${leadText}
              </p>

              ${sectionsHtml}

              <p style="margin:14px 0 0;font-size:12.5px;line-height:1.6;color:#334155;">
                ${footerNoteHtml}
              </p>
            </td>
          </tr>

          ${renderEmailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendHtmlMail = async ({ to, subject, html }) => {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { sent: false, mode: 'no_recipient', reason: 'No valid recipient email found' };
  }

  const transporter = getTransporter();
  const { from, user } = getMailConfig();
  const attachments = getLogoAttachment();

  if (!transporter) {
    console.warn(
      `[SMTP Not Configured] Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to deliver emails. To: ${recipients.join(
        ', '
      )} | Subject: ${subject}`
    );
    return {
      sent: false,
      mode: 'smtp_unconfigured',
      reason: 'SMTP_HOST, SMTP_USER, or SMTP_PASS missing in .env'
    };
  }

  try {
    const senderHeader = from.includes('<') ? from : `"CampusFind" <${from || user}>`;
    const info = await transporter.sendMail({
      from: senderHeader,
      to: recipients.join(', '),
      subject,
      html,
      attachments
    });
    console.log(`[SMTP Sent] To: ${recipients.join(', ')} | MessageId: ${info.messageId}`);
    return { sent: true, mode: 'smtp', messageId: info.messageId };
  } catch (err) {
    cachedTransporter = null;
    console.error(`[SMTP Error] To: ${recipients.join(', ')} | Error: ${err.message}`);
    return { sent: false, mode: 'smtp_error', reason: err.message };
  }
};

const sendMeetupScheduledEmail = async ({ claim, item, founder, claimant }) => {
  const recipients = [founder?.email, claimant?.email].filter(Boolean);
  const itemTitle = item?.title || 'Reported Campus Item';
  const itemType = String(item?.type || 'item').toUpperCase();
  const itemLocation = item?.locationName || 'SEU Campus';
  const meetupAddress = claim?.meetupPlan?.address || 'Campus Meetup Point';
  const meetupTimeStr = formatDateTime(claim?.meetupPlan?.meetupTime);

  const sectionsHtml = `
    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;padding:15px 16px;margin-bottom:14px;color:#0f172a;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:#1d4ed8;margin-bottom:6px;">
        Post &amp; Item Details
      </div>
      <div style="font-size:16px;font-weight:800;color:#0b2559;margin-bottom:5px;">${itemTitle}</div>
      <div style="font-size:13px;color:#1e293b;line-height:1.6;">
        <strong>Type:</strong> ${itemType}<br />
        <strong>Reported Spot:</strong> ${itemLocation}
      </div>
    </div>

    <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:16px;padding:15px 16px;margin-bottom:14px;color:#0f172a;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:#1d4ed8;margin-bottom:6px;">
        Meetup Schedule Details
      </div>
      <div style="font-size:13.5px;color:#0f172a;line-height:1.65;">
        <strong>Meetup Address:</strong> ${meetupAddress}<br />
        <strong>Scheduled Time:</strong> ${meetupTimeStr}
      </div>
    </div>

    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:16px;padding:14px 16px;font-size:12.5px;color:#7c2d12;line-height:1.6;">
      <strong style="color:#9a3412;">Participants:</strong><br />
      Founder: <strong>${founder?.name || 'Founder'}</strong> (${founder?.studentId || 'SEU'})<br />
      Claimant: <strong>${claimant?.name || 'Claimant'}</strong> (${claimant?.studentId || 'SEU'})
    </div>
  `;

  const html = buildHandoverCardHtml({
    headerSubtitle: 'Handover Meetup Confirmation • Southeast University',
    badgeText: 'Meetup Scheduled',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    heading: `Meetup Set: ${itemTitle}`,
    leadText:
      'A handover meetup location and time have been set. An automatic reminder email will also be sent <strong>15 minutes before</strong> the scheduled meetup.',
    sectionsHtml,
    footerNoteHtml:
      'Please meet in a safe, visible campus spot and complete handover with live camera proof and real-person confirmation.'
  });

  return sendHtmlMail({
    to: recipients,
    subject: `[CampusFind] Meetup Scheduled — "${itemTitle}"`,
    html
  });
};

const sendMeetupReminderEmail = async ({ claim, item, founder, claimant }) => {
  const recipients = [founder?.email, claimant?.email].filter(Boolean);
  const itemTitle = item?.title || 'Reported Campus Item';
  const itemType = String(item?.type || 'item').toUpperCase();
  const itemLocation = item?.locationName || 'SEU Campus';
  const meetupAddress = claim?.meetupPlan?.address || 'Campus Meetup Point';
  const meetupTimeStr = formatDateTime(claim?.meetupPlan?.meetupTime);

  const sectionsHtml = `
    <div style="background:#fff7ed;border:2px dashed #fb923c;border-radius:16px;padding:16px;margin-bottom:14px;color:#0f172a;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:#c2410c;margin-bottom:6px;">
        15-Minute Countdown Alert
      </div>
      <div style="font-size:14px;color:#0f172a;line-height:1.65;">
        <strong>Item:</strong> ${itemTitle} (${itemType})<br />
        <strong>Reported Spot:</strong> ${itemLocation}<br />
        <strong>Meetup Address:</strong> ${meetupAddress}<br />
        <strong>Scheduled Time:</strong> ${meetupTimeStr}
      </div>
    </div>

    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;padding:14px 16px;font-size:12.5px;color:#1e293b;line-height:1.6;">
      <strong>Participants:</strong><br />
      Founder: <strong>${founder?.name || 'Founder'}</strong> (${founder?.studentId || 'SEU'})<br />
      Claimant: <strong>${claimant?.name || 'Claimant'}</strong> (${claimant?.studentId || 'SEU'})
    </div>
  `;

  const html = buildHandoverCardHtml({
    headerSubtitle: '15-Minute Handover Reminder • Southeast University',
    badgeText: '15-Minute Reminder',
    badgeBg: '#fff7ed',
    badgeColor: '#c2410c',
    heading: `Meetup Starting in 15 Minutes: ${itemTitle}`,
    leadText:
      'This is your automatic <strong>15-minute reminder</strong> ahead of your scheduled handover meetup.',
    sectionsHtml,
    footerNoteHtml:
      'Head toward the agreed meetup spot on time and verify handover in CampusFind.'
  });

  return sendHtmlMail({
    to: recipients,
    subject: `[CampusFind Reminder] 15 Mins Left for Meetup — "${itemTitle}"`,
    html
  });
};

const sendHandoverCongratulationEmail = async ({ claim, item, founder, claimant }) => {
  const ownerEmail = claimant?.email;
  const itemTitle = item?.title || 'Campus Item';
  const itemLocation = item?.locationName || 'SEU Campus';
  const meetupAddress = claim?.meetupPlan?.address || itemLocation;
  const completedAtStr = formatDateTime(claim?.handoverProof?.completedAt || new Date());
  const ownerName = claimant?.name || 'Owner';

  const sectionsHtml = `
    <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:16px;padding:15px 16px;margin-bottom:14px;color:#0f172a;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:#047857;margin-bottom:6px;">
        Returned Item Summary
      </div>
      <div style="font-size:16px;font-weight:800;color:#0b2559;margin-bottom:5px;">${itemTitle}</div>
      <div style="font-size:13px;color:#1e293b;line-height:1.6;">
        <strong>Reported Spot:</strong> ${itemLocation}<br />
        <strong>Handover Spot:</strong> ${meetupAddress}<br />
        <strong>Completed At:</strong> ${completedAtStr}
      </div>
    </div>

    <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:16px;padding:15px 16px;margin-bottom:14px;color:#0f172a;">
      <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:#1d4ed8;margin-bottom:8px;">
        Giver / Founder Details
      </div>
      <div style="font-size:13.5px;color:#0f172a;line-height:1.65;">
        <strong>Name:</strong> ${founder?.name || 'Campus Founder'}<br />
        <strong>Student ID:</strong> ${founder?.studentId || 'SEU Member'}<br />
        <strong>Department:</strong> ${founder?.department || 'Southeast University'}<br />
        <strong>Email:</strong> ${founder?.email || 'N/A'}${
          founder?.phone ? `<br /><strong>Phone:</strong> ${founder.phone}` : ''
        }
      </div>
    </div>
  `;

  const html = buildHandoverCardHtml({
    headerSubtitle: 'Handover Completed • Southeast University',
    badgeText: 'Congratulations',
    badgeBg: '#ecfdf5',
    badgeColor: '#047857',
    heading: `Congratulations, ${ownerName}!`,
    leadText:
      'Your item handover has been completed with live camera proof and identity verification. Below are the return and giver details.',
    sectionsHtml,
    footerNoteHtml:
      'Your claim chat is now archived as read-only for future reference. Thank you for being part of CampusFind!'
  });

  return sendHtmlMail({
    to: ownerEmail,
    subject: `[CampusFind] Congratulations! "${itemTitle}" Returned`,
    html
  });
};

module.exports = {
  sendMeetupScheduledEmail,
  sendMeetupReminderEmail,
  sendHandoverCongratulationEmail
};