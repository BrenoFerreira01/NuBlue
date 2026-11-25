import { request, waitForWebServer } from "tests/orchestrator.js";

beforeAll(waitForWebServer);

describe("GET /api/v1/status", () => {
  it("informa que a aplicação e o banco estão saudáveis", async () => {
    const response = await request("/api/v1/status");

    expect(response.status).toBe(200);
    expect(response.data.status).toBe("ok");
    expect(response.data.dependencies.database.status).toBe("healthy");
    expect(response.data.dependencies.database.schema).toBe("ok");
    expect(typeof response.data.updated_at).toBe("string");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
