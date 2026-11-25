// Erros da API. O corpo de resposta é sempre { error: <code>, message: <texto> },
// e o front traduz pelo code (ver lib/api.js).

export class ApiError extends Error {
  constructor(statusCode, code, message = code) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }

  toJSON() {
    return { error: this.code, message: this.message };
  }
}

export class ValidationError extends ApiError {
  constructor(code = "invalid_payload", message = code) {
    super(400, code, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(
    code = "authentication_required",
    message = "Sua sessão expirou. Entre novamente.",
  ) {
    super(401, code, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(code = "forbidden", message = code) {
    super(403, code, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(code = "not_found", message = code) {
    super(404, code, message);
  }
}

export class MethodNotAllowedError extends ApiError {
  constructor() {
    super(405, "method_not_allowed", "Método não permitido.");
  }
}

export class ConflictError extends ApiError {
  constructor(code, message = code) {
    super(409, code, message);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor() {
    super(
      429,
      "too_many_attempts",
      "Muitas tentativas. Aguarde um pouco e tente novamente.",
    );
  }
}

export class InternalServerError extends ApiError {
  constructor({ cause } = {}) {
    super(500, "internal_error", "Erro interno. Tente novamente.");
    this.cause = cause;
  }
}

export class ServiceError extends ApiError {
  constructor(code = "service_unavailable", message = code, { cause } = {}) {
    super(503, code, message);
    this.cause = cause;
  }
}
