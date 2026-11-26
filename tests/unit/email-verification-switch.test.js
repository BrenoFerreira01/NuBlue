import { emailVerificationRequired } from "infra/email.js";

describe("emailVerificationRequired", () => {
  afterEach(() => {
    delete process.env.EMAIL_VERIFICATION;
  });

  it("exige confirmação por padrão", () => {
    expect(emailVerificationRequired()).toBe(true);
  });

  it("EMAIL_VERIFICATION=off desliga a confirmação", () => {
    process.env.EMAIL_VERIFICATION = " off ";
    expect(emailVerificationRequired()).toBe(false);
  });

  it("qualquer outro valor mantém a confirmação ligada", () => {
    process.env.EMAIL_VERIFICATION = "on";
    expect(emailVerificationRequired()).toBe(true);
  });
});
