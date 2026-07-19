import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT ?? 587),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});
