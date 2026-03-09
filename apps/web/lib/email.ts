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

const sendWithResend = async ({ to, subject, html, text, attachments }: SendEmailInput) => {
  const recipients = Array.isArray(to) ? to : [to];
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'HOSTEA <contacto@gohostea.com>',
      to: recipients,
      subject,
      html,
      text,
      attachments:
        attachments?.map((item) => ({
          filename: item.filename,
          content:
            typeof item.content === 'string'
              ? item.content
              : Buffer.from(item.content).toString('base64')
        })) || undefined
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend error ${response.status}: ${body}`);
  }

  return response.json();
};

export const sendEmail = async ({ to, subject, html, text, attachments }: SendEmailInput) => {
  if (resendApiKey) {
    return sendWithResend({ to, subject, html, text, attachments });
  }
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'HOSTEA <contacto@gohostea.com>',
    to,
    subject,
    html,
    text,
    attachments
  });
};
