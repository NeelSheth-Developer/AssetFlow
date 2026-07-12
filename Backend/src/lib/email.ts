import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { config } from '../config.js';
import { logger } from './logger.js';

const subject = `${config.appName} password reset code`;
const buildText = (code: string): string =>
  `Your ${config.appName} password reset code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`;
const buildHtml = (code: string): string =>
  `<p>Your ${config.appName} password reset code is:</p>` +
  `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>` +
  `<p>It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`;

let smtpTransporter: Transporter | undefined;
function getSmtpTransporter(): Transporter {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
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
  return smtpTransporter;
}

async function sendViaSmtp(email: string, code: string): Promise<void> {
  await getSmtpTransporter().sendMail({
    from: `${config.appName} <${config.mail.user}>`,
    to: email,
    subject,
    text: buildText(code),
    html: buildHtml(code),
  });
  logger.info({ to: email, provider: 'gmail' }, 'Password reset email delivered');
}

async function sendViaResend(email: string, code: string): Promise<void> {
  const { error } = await new Resend(config.resend.apiKey).emails.send({
    from: config.resend.from!,
    to: [email],
    subject,
    text: buildText(code),
    html: buildHtml(code),
  });
  if (error) throw new Error(`Resend email failed: ${error.message}`);
  logger.info({ to: email, provider: 'resend' }, 'Password reset email delivered');
}

// Tries Gmail SMTP first (delivers to any address); if SMTP is not configured
// or fails, falls back to Resend.
export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const smtpReady = Boolean(config.mail.user && config.mail.pass);
  const resendReady = Boolean(config.resend.apiKey && config.resend.from);
  if (!smtpReady && !resendReady) {
    throw new Error('Configure MAIL_USER/MAIL_PASS or RESEND_API_KEY/EMAIL_FROM');
  }

  if (smtpReady) {
    // Gmail SMTP can be flaky from cloud hosts — try twice before giving up.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await sendViaSmtp(email, code);
        return;
      } catch (error) {
        logger.error({ err: error, to: email, attempt }, 'Gmail send failed');
        if (attempt === 2 && !resendReady) throw error;
      }
    }
    logger.warn({ to: email }, 'Falling back to Resend');
  }
  await sendViaResend(email, code);
}
