import {
  prepare,
  query,
  request,
  resetRateLimits,
  uniqueNickname,
} from "tests/orchestrator.js";

beforeAll(prepare);
beforeEach(resetRateLimits);

const login = (body, headers = {}) =>
  request("/api/v1/auth/login", { method: "POST", body, headers });

describe("rate limit da autenticação", () => {
  it("bloqueia o 9º login errado no mesmo apelido em 15 minutos", async () => {
    const body = {
      nickname: uniqueNickname("limite"),
      password: "senha-errada-1",
    };
    for (let i = 0; i < 8; i += 1) {
      expect((await login(body)).status).toBe(401);
    }

    const limited = await login(body);

    expect(limited.status).toBe(429);
    expect(limited.data.error).toBe("too_many_attempts");
    expect(limited.data.message).toBe(
      "Muitas tentativas. Aguarde um pouco e tente novamente.",
    );
  });

  it("um x-forwarded-for forjado não escapa do limite fora da Vercel", async () => {
    const body = {
      nickname: uniqueNickname("forja"),
      password: "senha-errada-1",
    };
    for (let i = 0; i < 8; i += 1) {
      await login(body, { "x-forwarded-for": `203.0.113.${i}` });
    }

    const limited = await login(body, { "x-forwarded-for": "203.0.113.99" });

    expect(limited.status).toBe(429);
  });

  it("um endereço não consegue espalhar tentativas por muitos apelidos", async () => {
    // Senhas curtas falham na validação depois do limite: sem custo de scrypt.
    const attempt = () =>
      request("/api/v1/auth/register", {
        method: "POST",
        body: { nickname: uniqueNickname("spray"), password: "curta" },
      });
    for (let i = 0; i < 100; i += 1) {
      expect((await attempt()).status).toBe(400);
    }

    expect((await attempt()).status).toBe(429);
  });

  it("guarda só o hash das chaves", async () => {
    await login({ nickname: uniqueNickname(), password: "senha-errada-1" });

    const rows = await query("SELECT bucket_key FROM rate_limit_buckets");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => /^[0-9a-f]{64}$/.test(row.bucket_key))).toBe(
      true,
    );
  });
});
