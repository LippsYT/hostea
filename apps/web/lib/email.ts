import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST || 'localhost';
const smtpPort = Number(process.env.SMTP_PORT || 1025);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpSecure = String(process.env.SMTP_SECURE || 'false') === 'true';

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
});

const resendApiKey = process.env.RESEND_API_KEY || '';
const defaultFrom = process.env.EMAIL_FROM || 'HOSTEA <contacto@gohostea.com>';
const resendFallbackFrom = process.env.RESEND_FALLBACK_FROM || 'HOSTEA <onboarding@resend.dev>';
const hasCustomSmtpHost = Boolean(process.env.SMTP_HOST && process.env.SMTP_HOST !== 'localhost');

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
};

const sendWithResendRequest = async (payload: Record<string, unknown>) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend error ${response.status}: ${body}`);
  }

  return response.json();
};

const sendWithResend = async ({ to, subject, html, text, attachments }: SendEmailInput) => {
  const recipients = Array.isArray(to) ? to : [to];
  const payload = {
    to: recipients,
    subject,
    html,
    text,
    reply_to: process.env.EMAIL_FROM_CONTACT || undefined,
    attachments:
      attachments?.map((item) => ({
        filename: item.filename,
        content:
          typeof item.content === 'string'
            ? item.content
            : Buffer.from(item.content).toString('base64')
      })) || undefined
  };

  try {
    return await sendWithResendRequest({
      ...payload,
      from: defaultFrom
    });
  } catch (firstError: any) {
    if (!resendFallbackFrom || resendFallbackFrom === defaultFrom) {
      throw firstError;
    }

    console.warn('email-resend-primary-from-failed', {
      reason: firstError?.message || 'unknown'
    });

    return sendWithResendRequest({
      ...payload,
      from: resendFallbackFrom
    });
  }
};

export const sendEmail = async ({ to, subject, html, text, attachments }: SendEmailInput) => {
  if (resendApiKey) {
    try {
      return await sendWithResend({ to, subject, html, text, attachments });
    } catch (resendError: any) {
      if (!hasCustomSmtpHost) {
        throw resendError;
      }
      console.warn('email-resend-fallback-to-smtp', {
        reason: resendError?.message || 'unknown'
      });
    }
  }

  return transporter.sendMail({
    from: defaultFrom,
    to,
    subject,
    html,
    text,
    attachments
  });
};
