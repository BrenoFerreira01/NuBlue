import { verificationEmail } from "infra/email.js";

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
