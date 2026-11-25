import nodemailer from "nodemailer";

// Envio de e-mails por SMTP (nodemailer):
// - desenvolvimento: Mailpit em localhost:1025 (veja http://localhost:8025);
// - produção: o SMTP configurado (ex.: Resend em smtp.resend.com:465);
// - sem SMTP_HOST, ou em preview da Vercel: só escreve o link no log.

let transporter;

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10_000,
    });
  }
  return transporter;
}

function shouldOnlyLog() {
  return !process.env.SMTP_HOST || process.env.VERCEL_ENV === "preview";
}

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function verificationEmail(nickname, url) {
  const subject = "Confirme seu e-mail na Nublue";
  const text = [
    `Olá, ${nickname}!`,
    "",
    "Para ativar sua conta na Nublue, abra o link abaixo:",
    url,
    "",
    "O link vale por 24 horas. Se você não criou esta conta, ignore este e-mail.",
  ].join("\n");
  const html = `<p>Olá, ${escapeHtml(nickname)}!</p>
<p>Para ativar sua conta na Nublue, clique no botão abaixo:</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#2563eb;color:#fff;font-weight:700;text-decoration:none">Confirmar e-mail</a></p>
<p>Ou copie este link: ${escapeHtml(url)}</p>
<p>O link vale por 24 horas. Se você não criou esta conta, ignore este e-mail.</p>`;
  return { subject, text, html };
}

/**
 * A conta já existe quando isto roda: uma falha de envio só vai para o log, e o
 * aluno pode pedir um novo link na tela de login.
 */
export async function sendVerificationEmail({ to, nickname, url }) {
  if (shouldOnlyLog()) {
    console.log(`[email] Confirmation link for ${to}: ${url}`);
    return;
  }
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      ...verificationEmail(nickname, url),
    });
  } catch (error) {
    console.error("[email] falha no envio:", error.message);
  }
}
