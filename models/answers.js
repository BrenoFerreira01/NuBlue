import { ConflictError, ValidationError } from "infra/errors.js";

// Regras comuns às tentativas do curso e do desafio diário.

/** { inputId: inteiro de 0 a 100000 }, no máximo 64 entradas. */
export function normalizeAnswers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("invalid_answers");
  }
  const entries = Object.entries(value);
  if (entries.length > 64) throw new ValidationError("invalid_answers");
  for (const [key, answer] of entries) {
    if (
      !/^[a-zA-Z0-9_-]{1,40}$/.test(key) ||
      !Number.isInteger(answer) ||
      answer < 0 ||
      answer > 100_000
    ) {
      throw new ValidationError("invalid_answers");
    }
  }
  return Object.fromEntries(entries);
}

/** Vem no corpo ou no header Idempotency-Key. */
export function idempotencyKeyFrom(req) {
  const value = req.body?.idempotencyKey ?? req.headers["idempotency-key"];
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    throw new ValidationError("invalid_idempotency_key");
  }
  return value;
}

export function answersMatch(submitted, answerKey) {
  const submittedKeys = Object.keys(submitted).sort();
  const expectedKeys = Object.keys(answerKey).sort();
  return (
    submittedKeys.length === expectedKeys.length &&
    submittedKeys.every(
      (key, index) =>
        key === expectedKeys[index] && submitted[key] === answerKey[key],
    )
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const fields = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${fields.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A mesma chave só pode repetir exatamente as mesmas respostas. */
export function assertSameAnswers(stored, submitted) {
  if (canonicalJson(stored) !== canonicalJson(submitted)) {
    throw new ConflictError("idempotency_key_reused");
  }
}
