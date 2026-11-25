import { request, waitForWebServer } from "tests/orchestrator.js";

beforeAll(waitForWebServer);

describe("links de confirmação antigos", () => {
  it("/?verify=<token> redireciona para /verificar-email", async () => {
    const token = "a".repeat(64);

    const response = await request(`/?verify=${token}`, { redirect: "manual" });

    expect([307, 308]).toContain(response.status);
    const location = new URL(response.headers.get("location"), "http://x");
    expect(location.pathname).toBe("/verificar-email");
    expect(location.searchParams.get("token")).toBe(token);
  });

  it("/ sem token continua abrindo a página inicial", async () => {
    const response = await request("/", { redirect: "manual" });

    expect(response.status).toBe(200);
  });
});
