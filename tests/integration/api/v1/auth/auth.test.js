import {
  PASSWORD,
  createStudent,
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
const login = (body) => request("/api/v1/auth/login", { method: "POST", body });

describe("POST /api/v1/auth/register", () => {
  it("cria a conta sem sessão e envia o link de confirmação", async () => {
    const nickname = uniqueNickname();
    const email = `${nickname}@Example.com`;

    const response = await register({ nickname, email, password: PASSWORD });

    expect(response.status).toBe(201);
    expect(response.data.student.nickname).toBe(nickname);
    expect(response.data.verificationRequired).toBe(true);
    expect(response.setCookie).toBeUndefined();
    const token = await lastVerificationToken(email.toLowerCase());
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // Só o hash do token fica no banco.
    const rows = await query("SELECT token_hash FROM email_verifications");
    expect(rows.every((row) => row.token_hash !== token)).toBe(true);
  });

  it("exige um e-mail válido", async () => {
    const invalid = [
      undefined,
      "",
      "sem-arroba",
      "a@b",
      `${"x".repeat(250)}@example.com`,
      7,
    ];
    for (const email of invalid) {
      const response = await register({
        nickname: uniqueNickname(),
        email,
        password: PASSWORD,
      });
      expect(response.status).toBe(400);
      expect(response.data.error).toBe("invalid_email");
    }
  });

  it("permite várias contas com o mesmo e-mail", async () => {
    for (let i = 0; i < 2; i += 1) {
      const response = await register({
        nickname: uniqueNickname(),
        email: "responsavel@example.com",
        password: PASSWORD,
      });
      expect(response.status).toBe(201);
    }
  });

  it("recusa apelido repetido, sem diferenciar maiúsculas", async () => {
    const { nickname } = await createStudent({
      nickname: uniqueNickname("Dup"),
    });

    const response = await register({
      nickname: nickname.toLowerCase(),
      email: "outro@example.com",
      password: "outra-senha-2",
    });

    expect(response.status).toBe(409);
    expect(response.data.error).toBe("nickname_taken");
  });

  it("recusa apelido inválido e senha curta", async () => {
    const badNick = await register({
      nickname: "a b",
      email: "a@example.com",
      password: PASSWORD,
    });
    expect(badNick.status).toBe(400);
    expect(badNick.data.error).toBe("invalid_nickname");

    const badPassword = await register({
      nickname: uniqueNickname(),
      email: "a@example.com",
      password: "curta",
    });
    expect(badPassword.status).toBe(400);
    expect(badPassword.data.error).toBe("invalid_password");
  });
});

describe("POST /api/v1/auth/login", () => {
  it("só entra depois de confirmar o e-mail", async () => {
    const nickname = uniqueNickname();
    const email = `${nickname}@example.com`;
    await register({ nickname, email, password: PASSWORD });

    const blocked = await login({ nickname, password: PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.data.error).toBe("email_not_verified");
    expect(blocked.setCookie).toBeUndefined();

    const verified = await request("/api/v1/auth/email-verification", {
      method: "PATCH",
      body: { token: await lastVerificationToken(email) },
    });
    expect(verified.status).toBe(200);
    expect(verified.data).toEqual({ verified: true });

    const ok = await login({ nickname, password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.data.student).toEqual({
      id: expect.any(String),
      nickname,
      leaderboardOptIn: false,
      difficulty: "medium",
    });
    expect(ok.setCookie).toMatch(
      /^nublue_session=[0-9a-f]{64}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000$/,
    );
    const me = await request("/api/v1/users/me", { cookie: ok.cookie });
    expect(me.data.student.nickname).toBe(nickname);
    expect(me.data.progress.completedLevels).toEqual([]);
    expect(me.data.progress.totalXp).toBe(0);
  });

  it("recusa senha errada", async () => {
    const { nickname } = await createStudent();

    const wrong = await login({ nickname, password: "senha-errada-9" });

    expect(wrong.status).toBe(401);
    expect(wrong.data.error).toBe("invalid_credentials");
    expect(wrong.setCookie).toBeUndefined();
  });

  it("contas criadas antes do e-mail continuam entrando", async () => {
    const { nickname, id } = await createStudent();
    await query(
      "UPDATE students SET email = NULL, email_verified_at = NULL WHERE id = $1",
      [id],
    );

    const response = await login({ nickname, password: PASSWORD });

    expect(response.status).toBe(200);
  });
});

describe("sessão", () => {
  it("rotas protegidas respondem 401 sem sessão ou com token desconhecido", async () => {
    const anonymous = await request("/api/v1/users/me");
    expect(anonymous.status).toBe(401);
    expect(anonymous.data.error).toBe("authentication_required");

    const forged = await request("/api/v1/users/me", {
      cookie: `nublue_session=${"f".repeat(64)}`,
    });
    expect(forged.status).toBe(401);
  });

  it("sessões expiradas são recusadas", async () => {
    const { cookie, id } = await createStudent();
    await query(
      "UPDATE student_sessions SET expires_at = now() - interval '1 second' WHERE student_id = $1",
      [id],
    );

    expect((await request("/api/v1/users/me", { cookie })).status).toBe(401);
  });

  it("logout invalida a sessão no servidor", async () => {
    const { cookie } = await createStudent();

    const logout = await request("/api/v1/auth/logout", {
      method: "POST",
      cookie,
    });

    expect(logout.status).toBe(200);
    expect(logout.setCookie).toMatch(/^nublue_session=; .*Max-Age=0/);
    expect((await request("/api/v1/users/me", { cookie })).status).toBe(401);
  });
});
