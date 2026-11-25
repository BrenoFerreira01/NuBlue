/**
 * Sends the e-mail confirmation link. Every mailer exposes
 * `sendVerificationEmail({ to, nickname, url })`.
 * - With an API key: Resend (https://resend.com) over HTTPS, no extra dependency.
 * - Without one (development, CI): writes the link to stdout.
 */
export function createMailer({ resendApiKey, from, fetchImpl = fetch } = {}) {
  if (!resendApiKey) return createLogMailer();

  return {
    async sendVerificationEmail({ to, nickname, url }) {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resendApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [to], ...verificationEmail(nickname, url) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Resend responded with ${response.status}`);
    },
  };
}

function createLogMailer() {
  return {
    async sendVerificationEmail({ to, url }) {
      process.stdout.write(`[email] Confirmation link for ${to}: ${url}\n`);
    },
  };
}

const htmlEscapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => htmlEscapes[char]);
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
