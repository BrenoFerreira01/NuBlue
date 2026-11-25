// Roda a limpeza contra um servidor no ar (ex.: produção), como a Vercel Cron faz.
// Uso: APP_URL=https://... CRON_SECRET=... node infra/scripts/maintenance.mjs
const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

const response = await fetch(`${baseUrl}/api/v1/cron/maintenance`, {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
});
console.log(response.status, await response.text());
if (!response.ok) process.exitCode = 1;
