import { allowedOrigins, appUrl, clientAddress } from "infra/request.js";

describe("appUrl", () => {
  afterEach(() => {
    delete process.env.APP_URL;
  });

  it("aceita APP_URL sem https:// (erro comum ao cadastrar na Vercel)", () => {
    process.env.APP_URL = "nublue.vercel.app/";
    expect(appUrl()).toBe("https://nublue.vercel.app");
  });

  it("mantém uma URL completa e tira a barra final", () => {
    process.env.APP_URL = " https://nublue.vercel.app/ ";
    expect(appUrl()).toBe("https://nublue.vercel.app");
  });

  it("a checagem de origem não quebra com APP_URL sem protocolo", () => {
    process.env.APP_URL = "nublue.vercel.app";
    const origins = allowedOrigins({ headers: {}, socket: {} });
    expect(origins.has("https://nublue.vercel.app")).toBe(true);
  });
});

const req = {
  headers: { "x-forwarded-for": "6.6.6.6, 10.0.0.5" },
  socket: { remoteAddress: "10.0.0.1" },
};

describe("clientAddress", () => {
  afterEach(() => {
    delete process.env.VERCEL;
    delete process.env.TRUST_PROXY_HOPS;
  });

  it("ignora x-forwarded-for fora da Vercel", () => {
    expect(clientAddress(req)).toBe("10.0.0.1");
  });

  it("usa o primeiro x-forwarded-for na Vercel, que reescreve o cabeçalho", () => {
    process.env.VERCEL = "1";
    expect(clientAddress(req)).toBe("6.6.6.6");
  });

  it("atrás de N proxies próprios (TRUST_PROXY_HOPS) usa o N-ésimo da direita", () => {
    process.env.TRUST_PROXY_HOPS = "1";
    expect(clientAddress(req)).toBe("10.0.0.5");
    process.env.TRUST_PROXY_HOPS = "2";
    expect(clientAddress(req)).toBe("6.6.6.6");
  });

  it("com menos entradas que proxies confiáveis, usa o endereço da conexão", () => {
    process.env.TRUST_PROXY_HOPS = "3";
    expect(clientAddress(req)).toBe("10.0.0.1");
  });
});
