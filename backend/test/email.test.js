import { test } from "node:test";
import assert from "node:assert/strict";
import { createMailer, verificationEmail } from "../src/email.js";

const message = { to: "aluno@example.com", nickname: "aluno_1", url: "https://nublue.test/?verify=abc" };

test("the Resend mailer posts the confirmation e-mail with the API key", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200 };
  };
  const mailer = createMailer({ resendApiKey: "re_test", from: "Nublue <oi@nublue.test>", fetchImpl });
  await mailer.sendVerificationEmail(message);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].init.headers.authorization, "Bearer re_test");
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.to, ["aluno@example.com"]);
  assert.equal(body.from, "Nublue <oi@nublue.test>");
  assert.match(body.text, /https:\/\/nublue\.test\/\?verify=abc/);
});

test("the Resend mailer reports a failed delivery", async () => {
  const mailer = createMailer({ resendApiKey: "re_test", from: "x@nublue.test", fetchImpl: async () => ({ ok: false, status: 422 }) });
  await assert.rejects(() => mailer.sendVerificationEmail(message), /422/);
});

test("the HTML body escapes the nickname and the link", () => {
  const { html } = verificationEmail("<b>", "https://x.test/?verify=1&a=\"2\"");
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("&lt;b&gt;"));
  assert.ok(html.includes("&amp;a=&quot;2&quot;"));
});
