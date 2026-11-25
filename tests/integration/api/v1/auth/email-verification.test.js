import {
  PASSWORD,
  getLastEmail,
  lastVerificationToken,
  prepare,
  query,
  request,
  resetRateLimits,
  uniqueNickname,
} from "tests/orchestrator.js";

beforeAll(prepare);
beforeEach(resetRateLimits);

const register = (body) =>
  request("/api/v1/auth/register", { method: "POST", body });
const confirm = (token) =>
  request("/api/v1/auth/email-verification", {
    method: "PATCH",
    body: { token },
  });
const resend = (body) =>
  request("/api/v1/auth/email-verification", { method: "POST", body });

describe("/api/v1/auth/email-verification", () => {
  it("o e-mail traz o link para /verificar-email", async () => {
    const nickname = uniqueNickname();
    const email = `${nickname}@example.com`;
    await register({ nickname, email, password: PASSWORD });

    const message = await getLastEmail(email);

    expect(message.Subject).toBe("Confirme seu e-mail na Nublue");
    expect(message.Text).toMatch(
      /http:\/\/localhost:3000\/verificar-email\?token=[0-9a-f]{64}/,
    );
    expect(message.Text).toContain(`Olá, ${nickname}!`);
  });

  it("o token vale uma vez e expira", async () => {
    const nickname = uniqueNickname();
    const email = `${nickname}@example.com`;
    await register({ nickname, email, password: PASSWORD });
    const token = await lastVerificationToken(email);
    await query(
      "UPDATE email_verifications SET expires_at = now() - interval '1 second'",
    );

    const expired = await confirm(token);
    expect(expired.status).toBe(400);
    expect(expired.data.error).toBe("invalid_verification_token");

    for (const bad of ["", "xyz", "f".repeat(64), 42]) {
      const response = await confirm(bad);
      expect(response.status).toBe(400);
      expect(response.data.error).toBe("invalid_verification_token");
    }
  });

  it("reenviar exige a senha e substitui o link anterior", async () => {
    const nickname = uniqueNickname();
    const email = `${nickname}@example.com`;
    const credentials = { nickname, password: PASSWORD };
    await register({ ...credentials, email });
    const first = await lastVerificationToken(email);

    const wrong = await resend({ nickname, password: "senha-errada-9" });
    expect(wrong.status).toBe(401);
    expect(await lastVerificationToken(email)).toBe(first);

    const resent = await resend(credentials);
    expect(resent.status).toBe(200);
    const second = await lastVerificationToken(email);
    expect(second).not.toBe(first);

    expect((await confirm(first)).status).toBe(400);
    expect((await confirm(second)).status).toBe(200);
    expect((await confirm(second)).status).toBe(400);

    // Já confirmado: nada novo é enviado.
    expect((await resend(credentials)).status).toBe(200);
    expect(await lastVerificationToken(email)).toBe(second);
  });

  it("corrige o e-mail digitado errado enquanto a conta não foi confirmada", async () => {
    const nickname = uniqueNickname();
    const credentials = { nickname, password: PASSWORD };
    const typo = `${nickname}@gmial.com`;
    const right = `${nickname}@gmail.com`;
    await register({ ...credentials, email: typo });
    const typoToken = await lastVerificationToken(typo);

    const invalid = await resend({ ...credentials, email: "sem-arroba" });
    expect(invalid.status).toBe(400);
    expect(invalid.data.error).toBe("invalid_email");

    const wrongPassword = await resend({
      nickname,
      password: "senha-errada-9",
      email: right,
    });
    expect(wrongPassword.status).toBe(401);
    expect(await lastVerificationToken(right)).toBeNull();

    const fixed = await resend({
      ...credentials,
      email: ` ${right.toUpperCase()} `,
    });
    expect(fixed.status).toBe(200);
    const token = await lastVerificationToken(right);
    expect(token).not.toBeNull();
    expect((await confirm(typoToken)).status).toBe(400);
    expect((await confirm(token)).status).toBe(200);

    // Depois de confirmado, o e-mail não muda mais por esta rota.
    await resend({ ...credentials, email: `outro-${right}` });
    const [student] = await query(
      "SELECT email FROM students WHERE nickname = $1",
      [nickname],
    );
    expect(student.email).toBe(right);
  });
});
