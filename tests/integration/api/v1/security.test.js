import { request, waitForWebServer } from "tests/orchestrator.js";

beforeAll(waitForWebServer);

describe("proteções das rotas que alteram estado", () => {
  it("recusa requisições de outra origem", async () => {
    const response = await request("/api/v1/auth/logout", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    });

    expect(response.status).toBe(403);
    expect(response.data.error).toBe("origin_not_allowed");
  });

  it("recusa corpo que não é JSON", async () => {
    const response = await fetch("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "oi",
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_payload");
  });

  it("responde 405 para método não suportado", async () => {
    const response = await request("/api/v1/status", { method: "DELETE" });

    expect(response.status).toBe(405);
    expect(response.data.error).toBe("method_not_allowed");
  });
});
