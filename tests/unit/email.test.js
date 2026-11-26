import { smtpConfig, verificationEmail } from "infra/email.js";

describe("smtpConfig", () => {
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"];
  afterEach(() => keys.forEach((key) => delete process.env[key]));

  it("ignora espaços e tabulações coladas junto com os valores", () => {
    process.env.SMTP_HOST = "\tsmtp.resend.com ";
    process.env.SMTP_PORT = " 465\n";
    process.env.SMTP_USER = " resend\t";
    process.env.SMTP_PASSWORD = "\tre_chave \n";

    const config = smtpConfig();

    expect(config.host).toBe("smtp.resend.com");
    expect(config.port).toBe(465);
    expect(config.secure).toBe(true);
    expect(config.auth).toEqual({ user: "resend", pass: "re_chave" });
  });

  it("sem usuário, não envia credenciais (Mailpit local)", () => {
    process.env.SMTP_HOST = "localhost";
    process.env.SMTP_PORT = "1025";

    const config = smtpConfig();

    expect(config.secure).toBe(false);
    expect(config.auth).toBeUndefined();
  });
});

describe("verificationEmail", () => {
  it("traz o link no texto e no HTML", () => {
    const url = "https://nublue.test/verificar-email?token=abc";
    const { subject, text, html } = verificationEmail("aluno_1", url);

    expect(subject).toBe("Confirme seu e-mail na Nublue");
    expect(text).toContain(url);
    expect(text).toContain("Olá, aluno_1!");
    expect(html).toContain(url);
  });

  it("escapa o apelido e o link no HTML", () => {
    const { html } = verificationEmail(
      "<b>",
      'https://x.test/verificar-email?token=1&a="2"',
    );

    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;a=&quot;2&quot;");
  });
});
