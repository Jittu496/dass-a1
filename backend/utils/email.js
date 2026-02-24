import nodemailer from "nodemailer";

/**
 * Reusable email sender.
 *
 * Priority:
 *  1) Use EMAIL_USER + EMAIL_PASS from .env → real Gmail / SMTP delivery
 *  2) Auto-create an Ethereal test account → emails captured at ethereal.email
 *     (no real creds needed; logs a preview URL to the console)
 *
 * Required .env variables for real delivery:
 *   EMAIL_HOST  (default: smtp.gmail.com)
 *   EMAIL_PORT  (default: 587)
 *   EMAIL_USER  (sender email)
 *   EMAIL_PASS  (Gmail App Password)
 *   EMAIL_FROM  (optional display name, default: EMAIL_USER)
 */

let _transport = null;

async function getTransport() {
  if (_transport) return _transport;

  // Real SMTP (Gmail, etc.)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS &&
    !process.env.EMAIL_USER.includes("your_gmail")) {
    _transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT || 587),
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log("✉️  Using real SMTP for email:", process.env.EMAIL_USER);
    return _transport;
  }

  // Fallback: Ethereal test account (visible at ethereal.email)
  console.warn("⚠️  No real EMAIL_USER/PASS found — creating Ethereal test account");
  const testAccount = await nodemailer.createTestAccount();
  _transport = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  _transport._ethereal = true;
  console.log("✉️  Ethereal test account:", testAccount.user, "/ pass:", testAccount.pass);
  return _transport;
}

/**
 * sendMail({ to, subject, html })
 * Returns { ok: true } or { ok: false, error }
 * Never throws — ticket/order is already saved before calling this.
 */
export async function sendMail({ to, subject, html }) {
  try {
    const transport = await getTransport();
    const from = process.env.EMAIL_FROM || `"Felicity EMS" <${process.env.EMAIL_USER || "noreply@felicity.ems"}>`;
    const info = await transport.sendMail({ from, to, subject, html });
    if (transport._ethereal) {
      const url = nodemailer.getTestMessageUrl(info);
      console.log(`📬  Email preview (open in browser): ${url}`);
    } else {
      console.log(`✉️  Email sent to ${to}: ${subject}`);
    }
    return { ok: true };
  } catch (err) {
    console.error("❌ Email send failed:", err.message || err);
    return { ok: false, error: err.message };
  }
}

/**
 * HTML template for ticket confirmation email (Normal Events & Merch).
 */
export function ticketEmailHtml({
  firstName, eventName, ticketId, qrDataUrl,
  eventDate, organizer, isMerch = false,
  variants = [],   // [{name, qty, price}] for merch
  totalAmount,
}) {
  const variantRows = variants.length > 0
    ? variants.map(v => `
      <tr>
        <td style="padding:6px 0;color:#374151;font-size:13px;">${v.name}</td>
        <td style="padding:6px 0;text-align:center;color:#6b7280;font-size:13px;">×${v.qty}</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;color:#374151;font-size:13px;">₹${v.price * v.qty}</td>
      </tr>`).join("")
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f1e8; margin: 0; padding: 20px; }
    .card { background: #fff; border-radius: 16px; max-width: 560px; margin: 0 auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.10); overflow: hidden; }
    .header { background: linear-gradient(135deg, #c9a227, #e8d07a); padding: 24px 28px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; color: #3b2700; }
    .header p  { margin: 4px 0 0; font-size: 13px; color: #6b4c00; }
    .body { padding: 24px 28px; }
    .label { font-size: 11px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { font-weight: 600; color: #111; font-size: 14px; margin-top: 2px; margin-bottom: 12px; }
    .ticket-id { font-family: monospace; background: #f0f4ff; border: 1px solid #c7d2fe;
                 border-radius: 8px; padding: 8px 16px; font-size: 18px;
                 font-weight: 800; color: #4338ca; display: inline-block; margin: 10px 0 16px; }
    .qr-wrap { text-align: center; margin: 16px 0; }
    .qr-wrap img { border: 2px solid #e5e7eb; border-radius: 12px; padding: 6px; background: #fff; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { font-size: 11px; color: #9ca3af; font-weight: 700; text-align: left; padding-bottom: 6px; border-bottom: 1px solid #f3f4f6; }
    .total { font-size: 15px; font-weight: 900; color: #374151; border-top: 2px solid #e5e7eb; padding-top: 8px; }
    .footer { border-top: 1px solid #f3f4f6; padding: 14px 28px; font-size: 11px; color: #9ca3af; text-align: center; }
    .notice { background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #92400e; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${isMerch ? "🛍️ Order Confirmed" : "🎫 Ticket Confirmed"}</h1>
      <p>Felicity Event Management System</p>
    </div>
    <div class="body">
      <p>Hi <strong>${firstName || "Participant"}</strong>,</p>
      <p>${isMerch
      ? `Your merchandise order for <strong>${eventName}</strong> has been approved!`
      : `Your registration for <strong>${eventName}</strong> is confirmed. Present the QR code at entry.`
    }</p>

      <div class="label">EVENT</div>
      <div class="value">${eventName}</div>

      ${eventDate ? `<div class="label">DATE</div><div class="value">${eventDate}</div>` : ""}
      ${organizer ? `<div class="label">ORGANIZER</div><div class="value">${organizer}</div>` : ""}

      ${isMerch && variantRows ? `
      <div class="label">ORDER DETAILS</div>
      <table>
        <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${variantRows}</tbody>
        ${totalAmount ? `<tfoot><tr><td colspan="2" class="total">Total</td><td class="total" style="text-align:right">₹${totalAmount}</td></tr></tfoot>` : ""}
      </table>` : ""}

      <div class="label">TICKET ID</div>
      <div class="ticket-id">${ticketId}</div>

      ${qrDataUrl ? `
      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="QR Code" width="180" height="180"/>
        <p style="font-size:11px;color:#9ca3af;margin-top:8px;">
          ${isMerch ? "Show this QR code at the merchandise pickup counter" : "Show this QR code at the event entrance"}
        </p>
      </div>` : ""}

      <div class="notice">
        ${isMerch
      ? "Please bring this email (or the QR code) when collecting your merchandise."
      : "This ticket is valid for one entry. Do not share the QR code."}
      </div>
    </div>
    <div class="footer">Automated message from Felicity EMS · Do not reply</div>
  </div>
</body>
</html>`;
}
