import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';
import { logger } from './logger.js';

const subject = `${config.appName} password reset code`;
const buildText = (code: string): string =>
  `Your ${config.appName} password reset code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`;

// Table-based layout with inline styles — the only markup email clients render reliably.
const buildHtml = (code: string): string => `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);background-color:#0f172a;padding:28px 40px;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">Asset<span style="color:#60a5fa;">Flow</span></span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 8px;">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Password reset code</h1>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">
              We received a request to reset your ${config.appName} password. Enter the code below to continue:
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:22px 0;">
                  <span style="font-size:34px;font-weight:800;letter-spacing:12px;color:#1e3a8a;font-family:'SF Mono',Menlo,Consolas,monospace;padding-left:12px;">${code}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 8px;">
            <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">
              This code expires in <strong style="color:#0f172a;">10 minutes</strong> and can only be used once.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 32px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
              Didn't request this? You can safely ignore this email — your password will stay unchanged, and no one can reset it without this code.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} ${config.appName} · Asset Management System<br>This is an automated message — please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

let transporter: Transporter | undefined;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: config.mail.user, pass: config.mail.pass },
      // Fail fast instead of hanging when the host network throttles SMTP.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

// Gmail SMTP via Nodemailer — delivers to any address. Needs MAIL_USER +
// MAIL_PASS (a Gmail App Password, not the account password).
export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  if (!config.mail.user || !config.mail.pass) {
    throw new Error('Email is not configured — set MAIL_USER and MAIL_PASS (Gmail App Password)');
  }

  // Gmail SMTP can be flaky from cloud hosts — try twice before giving up.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await getTransporter().sendMail({
        from: `${config.appName} <${config.mail.user}>`,
        to: email,
        subject,
        text: buildText(code),
        html: buildHtml(code),
      });
      logger.info({ to: email, provider: 'gmail' }, 'Password reset email delivered');
      return;
    } catch (error) {
      lastError = error;
      logger.error({ err: error, to: email, attempt }, 'Gmail send failed');
    }
  }
  throw lastError;
}
