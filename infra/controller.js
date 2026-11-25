import { ZodError } from "zod";
import {
  ApiError,
  ForbiddenError,
  InternalServerError,
  MethodNotAllowedError,
  UnauthorizedError,
  ValidationError,
} from "infra/errors.js";
import { allowedOrigins } from "infra/request.js";
import session from "models/session.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Proteção contra CSRF (além do cookie SameSite=Lax): requisições que alteram
 * estado devem vir da própria origem e, se tiverem corpo, em JSON.
 */
function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins(req).has(origin)) {
    throw new ForbiddenError(
      "origin_not_allowed",
      "Origem da requisição não permitida.",
    );
  }
  const hasBody =
    Number(req.headers["content-length"] || 0) > 0 ||
    req.headers["transfer-encoding"] !== undefined;
  const contentType = String(req.headers["content-type"] || "");
  if (hasBody && !contentType.startsWith("application/json")) {
    throw new ValidationError(
      "invalid_payload",
      "Envie os dados no formato JSON.",
    );
  }
}

const MESSAGES = {
  invalid_nickname: "Use de 3 a 24 letras, números, _ ou -.",
  invalid_password: "A senha precisa ter entre 8 e 128 caracteres.",
  invalid_email: "Informe um e-mail válido.",
};

/** Erros do Zod carregam o code da API na mensagem do primeiro problema. */
function fromZodError(error) {
  const code = error.issues[0]?.message || "invalid_payload";
  return new ValidationError(code, MESSAGES[code] || code);
}

function toApiError(error) {
  if (error instanceof ZodError) return fromZodError(error);
  if (error instanceof ApiError) return error;
  return new InternalServerError({ cause: error });
}

export function handleError(error, res) {
  const apiError = toApiError(error);

  if (apiError.statusCode >= 500) {
    console.error(
      `[api] ${apiError.name}:`,
      apiError.cause?.message || error?.message || error,
    );
  }
  res.status(apiError.statusCode).json(apiError);
}

/**
 * Cria um handler de API com roteamento por método:
 *   export default createHandler({ GET: async (req, res) => {...} })
 */
export function createHandler(handlers) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    const method = req.method === "HEAD" ? "GET" : req.method;
    const fn = handlers[method];
    try {
      if (!fn) {
        res.setHeader("Allow", Object.keys(handlers).join(", "));
        throw new MethodNotAllowedError();
      }
      if (!SAFE_METHODS.has(method)) assertSameOrigin(req);
      await fn(req, res);
    } catch (error) {
      handleError(error, res);
    }
  };
}

/** Aluno da sessão atual; 401 se não houver sessão válida. */
export async function requireStudent(req) {
  const student = await session.findStudent(req);
  if (!student) throw new UnauthorizedError();
  return student;
}
