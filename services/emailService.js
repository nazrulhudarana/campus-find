const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const LOGO_PATH = path.join(__dirname, '..', 'uploads', 'logo.png');

const createTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const getFromAddress = () => {
  const senderEmail = process.env.SMTP_USER || 'nazrulhudarana@gmail.com';
  return `"CampusFind" <${senderEmail}>`;
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

const renderBrandHeader = (subtitle = 'Southeast University • Find • Claim • Reconnect') => {
  const hasLogo = fs.existsSync(LOGO_PATH);
  const brandVisual = hasLogo
    ? `<img src="cid:campusfindlogo" alt="CampusFind" style="max-height:64px;max-width:240px;width:auto;object-fit:contain;border-radius:10px;display:inline-block;" />`
    : `<div style="font-size:26px;font-weight:900;letter-spacing:-0.4px;color:#ffffff;">Campus<span style="color:#fb923c;">Find</span></div>`;

  return `
    <tr>
      <td style="background:linear-gradient(135deg,#061636 0%,#0e3478 58%,#1d4ed8 100%);padding:26px 24px;text-align:center;color:#ffffff;">
        ${brandVisual}
        <div style="font-size:12px;opacity:0.9;margin-top:8px;letter-spacing:0.2px;">
          ${subtitle}
        </div>
      </td>
    </tr>
  `;
};

const renderEmailFooter = () => {
  const iconStyle =
    'display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:999px;background:#14112b;border:1px solid rgba(255,255,255,0.14);margin:0 5px;text-decoration:none;';

  return `
    <tr>
      <td style="background:#07041c;padding:24px 20px;text-align:center;color:#cbd5e1;">
        <div style="margin-bottom:14px;">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook" style="${iconStyle}">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" width="16" height="16" style="vertical-align:middle;border:0;" />
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style="${iconStyle}">
            <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" width="16" height="16" style="vertical-align:middle;border:0;" />
          </a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" style="${iconStyle}">
            <img src="https://cdn-icons-png.flaticon.com/512/3536/3536505.png" alt="LinkedIn" width="16" height="16" style="vertical-align:middle;border:0;" />
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub" style="${iconStyle}">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733553.png" alt="GitHub" width="16" height="16" style="vertical-align:middle;border:0;filter:invert(1);" />
          </a>
        </div>

        <div style="font-size:13px;font-weight:800;color:#ffffff;margin-bottom:4px;">
          CampusFind by <span style="color:#fb923c;">Nazrul Huda</span>
        </div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">
          <a href="mailto:nazrulhudarana@gmail.com" style="color:#cbd5e1;text-decoration:none;">nazrulhudarana@gmail.com</a>
        </div>
        <div style="font-size:11px;color:#64748b;">
          &copy; 2026 CampusFind • Southeast University (@seu.edu.bd)
        </div>
      </td>
    </tr>
  `;
};

const buildOtpHtml = ({ otp, purpose, name, email }) => {
  const displayName = (name && name.trim()) || email.split('@')[0];
  const badgeText =
    purpose === 'signup'
      ? 'Account Verification'
      : purpose === 'reset'
      ? 'Password Reset Request'
      : 'Login Verification';

  const actionSentence =
    purpose === 'signup'
      ? 'complete your <strong>CampusFind</strong> student registration'
      : purpose === 'reset'
      ? 'reset your <strong>CampusFind</strong> account password'
      : 'complete your <strong>CampusFind</strong> sign-in';

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CampusFind Verification</title>
  </head>
  <body style="margin:0;padding:0;background:#eef3f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;background:#eef3f9;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 44px rgba(15,23,42,0.12);">
            ${renderBrandHeader()}

            <tr>
              <td style="padding:28px 26px;color:#0f172a;">
                <span style="display:inline-block;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px;margin-bottom:12px;">
                  ${badgeText}
                </span>
                <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#0b2559;">
                  Your One-Time Password (OTP)
                </h2>
                <p style="margin:0 0 18px;font-size:14.5px;line-height:1.65;color:#334155;">
                  Hello <strong style="color:#0b2559;">${displayName}</strong>, use the 6-digit verification code below to ${actionSentence}.
                </p>

                <div style="background:linear-gradient(180deg,#fff7ed 0%,#ffffff 100%);border:2px dashed #fb923c;border-radius:18px;padding:20px;text-align:center;margin:18px 0;">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.4px;color:#64748b;margin-bottom:8px;font-weight:800;">
                    6-Digit Verification Code
                  </div>
                  <div style="font-size:36px;font-weight:900;letter-spacing:9px;color:#ea580c;">
                    ${otp}
                  </div>
                  <div style="margin-top:10px;font-size:12px;color:#9a3412;font-weight:700;">
                    Valid for 5 minutes
                  </div>
                </div>

                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:14px;padding:12px 14px;margin-bottom:16px;">
                  <tr>
                    <td style="font-size:12.5px;color:#475569;line-height:1.55;">
                      <strong>Security Tip:</strong> Never share this code with anyone. CampusFind only verifies official <strong>@seu.edu.bd</strong> accounts.
                    </td>
                  </tr>
                </table>

                <p style="margin:0;font-size:12.5px;line-height:1.6;color:#64748b;">
                  If you did not request this verification, you can safely ignore this email.
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
};

const buildWelcomeManualHtml = ({ name, studentId, email, department, phone }) => {
  const displayName = (name && name.trim()) || email.split('@')[0];

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to CampusFind — Student User Manual</title>
  </head>
  <body style="margin:0;padding:0;background:#eef3f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;background:#eef3f9;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 44px rgba(15,23,42,0.12);">
            ${renderBrandHeader('Welcome to Southeast University Lost & Found Portal')}

            <tr>
              <td style="padding:28px 26px;color:#0f172a;">
                <span style="display:inline-block;background:#ecfdf5;color:#047857;font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px;margin-bottom:12px;">
                  Account Created Successfully
                </span>
                <h2 style="margin:0 0 10px;font-size:23px;font-weight:900;color:#0b2559;">
                  Welcome aboard, ${displayName}!
                </h2>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#334155;">
                  Your <strong>CampusFind</strong> student account is now active. Below is your registered profile summary and quick <strong>Student User Manual</strong>.
                </p>

                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#1e293b;">
                  <tr>
                    <td style="padding:4px 0;"><strong>Student ID:</strong> ${studentId || 'N/A'}</td>
                    <td style="padding:4px 0;"><strong>Email:</strong> ${email}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;"><strong>Department:</strong> ${department || 'N/A'}</td>
                    <td style="padding:4px 0;"><strong>WhatsApp:</strong> ${phone || 'N/A'}</td>
                  </tr>
                </table>

                <h3 style="margin:0 0 12px;font-size:17px;font-weight:800;color:#0b2559;">
                  Quick Student User Manual
                </h3>

                <div style="border-left:4px solid #1d4ed8;padding:6px 0 6px 14px;margin-bottom:12px;">
                  <div style="font-size:14px;font-weight:800;color:#0f172a;">1. Report Lost or Found Items</div>
                  <div style="font-size:13px;color:#475569;line-height:1.55;">
                    Open <strong>Report Lost/Found</strong> from your dashboard, add photos, select the campus location on the map, and enter item details.
                  </div>
                </div>

                <div style="border-left:4px solid #ea580c;padding:6px 0 6px 14px;margin-bottom:12px;">
                  <div style="font-size:14px;font-weight:800;color:#0f172a;">2. Smart Matching &amp; Alerts</div>
                  <div style="font-size:13px;color:#475569;line-height:1.55;">
                    CampusFind automatically compares lost and found reports by category, building/spot, and keywords so potential matches appear fast.
                  </div>
                </div>

                <div style="border-left:4px solid #0d9488;padding:6px 0 6px 14px;margin-bottom:12px;">
                  <div style="font-size:14px;font-weight:800;color:#0f172a;">3. 4-Digit Security Desk PIN Handover</div>
                  <div style="font-size:13px;color:#475569;line-height:1.55;">
                    Use a 4-digit PIN when handing over or collecting items via the Security Desk for verified, safe returns.
                  </div>
                </div>

                <div style="border-left:4px solid #f59e0b;padding:6px 0 6px 14px;margin-bottom:18px;">
                  <div style="font-size:14px;font-weight:800;color:#0f172a;">4. Earn Campus Hero Points</div>
                  <div style="font-size:13px;color:#475569;line-height:1.55;">
                    Help students reconnect with lost belongings to earn <strong>Hero Points</strong> and climb the leaderboard.
                  </div>
                </div>

                <div style="text-align:center;margin-top:10px;">
                  <a href="http://127.0.0.1:5050/" style="display:inline-block;background:linear-gradient(135deg,#fb923c,#ea580c);color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 24px;border-radius:12px;">
                    Open CampusFind Dashboard &rarr;
                  </a>
                </div>
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
};

const sendOtpEmail = async ({ to, otp, purpose, name }) => {
  const transporter = createTransporter();
  const subject =
    purpose === 'signup'
      ? 'CampusFind — Account Verification Code'
      : purpose === 'reset'
      ? 'CampusFind — Password Reset Verification'
      : 'CampusFind — Sign-In Verification Code';

  const html = buildOtpHtml({ otp, purpose, name, email: to });
  const attachments = getLogoAttachment();

  if (!transporter) {
    console.log(`[DEV OTP EMAIL] To: ${to} | Name: ${name || '-'} | Purpose: ${purpose} | OTP: ${otp}`);
    return { devFallback: true };
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
    attachments
  });

  return { sent: true };
};

const sendWelcomeManualEmail = async ({ to, name, studentId, department, phone }) => {
  const transporter = createTransporter();
  const html = buildWelcomeManualHtml({ name, studentId, email: to, department, phone });
  const attachments = getLogoAttachment();

  if (!transporter) {
    console.log(`[DEV WELCOME MANUAL EMAIL] Sent to ${to} (${name || 'Student'})`);
    return { devFallback: true };
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject: 'CampusFind — Welcome & Student User Manual',
    html,
    attachments
  });

  return { sent: true };
};

module.exports = { sendOtpEmail, sendWelcomeManualEmail };