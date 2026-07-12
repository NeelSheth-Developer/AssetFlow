import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { config } from '../config.js';
import { logger } from './logger.js';

const subject = 'Your verification code';
const buildText = (otp: string): string =>
  `Your verification code is ${otp}. It expires in 5 minutes.`;
const buildHtml = (otp: string): string =>
  `<p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${otp}</p><p>It expires in 5 minutes.</p>`;

let gmailTransporter: Transporter | undefined;
function getGmailTransporter(): Transporter {
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: config.gmail.user, pass: config.gmail.appPassword },
      // Fail fast instead of hanging when the host network throttles SMTP.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return gmailTransporter;
}

async function sendViaGmail(email: string, otp: string): Promise<void> {
  await getGmailTransporter().sendMail({
    from: `${config.appName} <${config.gmail.user}>`,
    to: email,
    subject,
    text: buildText(otp),
    html: buildHtml(otp),
  });
  logger.info({ to: email, provider: 'gmail' }, 'OTP email delivered');
}

async function sendViaResend(email: string, otp: string): Promise<void> {
  const { error } = await new Resend(config.resend.apiKey).emails.send({
    from: config.resend.from!,
    to: [email],
    subject,
    text: buildText(otp),
    html: buildHtml(otp),
  });
  if (error) throw new Error(`Resend email failed: ${error.message}`);
  logger.info({ to: email, provider: 'resend' }, 'OTP email delivered');
}

// Tries Gmail SMTP first (sends to any address); if Gmail is not configured
// or fails (e.g. SMTP blocked/throttled on the host), falls back to Resend.
export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const gmailReady = Boolean(config.gmail.user && config.gmail.appPassword);
  const resendReady = Boolean(config.resend.apiKey && config.resend.from);
  if (!gmailReady && !resendReady) {
    throw new Error('Configure GMAIL_USER/GMAIL_APP_PASSWORD or RESEND_API_KEY/EMAIL_FROM');
  }

  if (gmailReady) {
    // Gmail SMTP can be flaky from cloud hosts — try twice before giving up.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await sendViaGmail(email, otp);
        return;
      } catch (error) {
        logger.error({ err: error, to: email, attempt }, 'Gmail send failed');
        if (attempt === 2 && !resendReady) throw error;
      }
    }
    logger.warn({ to: email }, 'Falling back to Resend');
  }
  await sendViaResend(email, otp);
}
