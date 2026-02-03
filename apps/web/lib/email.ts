import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 1025,
  secure: false
});

export const sendEmail = async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
  return transporter.sendMail({
    from: 'HOSTEA <no-reply@hostea.local>',
    to,
    subject,
    html
  });
};
