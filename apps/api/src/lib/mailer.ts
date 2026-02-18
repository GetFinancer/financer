import nodemailer from 'nodemailer';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function isMailerConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendPasswordReset(options: {
  to: string;
  tenantName: string;
  tempPassword: string;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) throw new Error('SMTP not configured');

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const baseDomain = process.env.BASE_DOMAIN;
  const appUrl = process.env.APP_URL || (baseDomain ? `https://${baseDomain}` : '');

  await transport.sendMail({
    from,
    to: options.to,
    subject: 'Financer – Temporäres Passwort / Temporary Password',
    text: [
      `Hallo,`,
      ``,
      `Dein Passwort für Financer (${options.tenantName}) wurde vom Administrator zurückgesetzt.`,
      ``,
      `Temporäres Passwort: ${options.tempPassword}`,
      ``,
      `Bitte melde dich unter ${appUrl} an und ändere dein Passwort sofort unter Einstellungen.`,
      ``,
      `---`,
      ``,
      `Hi,`,
      ``,
      `Your Financer password (${options.tenantName}) was reset by an administrator.`,
      ``,
      `Temporary password: ${options.tempPassword}`,
      ``,
      `Please log in at ${appUrl} and change your password immediately in Settings.`,
      ``,
      `---`,
      ``,
      `Fragen? admin@getfinancer.com`,
      `Questions? admin@getfinancer.com`,
    ].join('\n'),
  });
}
