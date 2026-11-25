// Carrega .env.development nos testes (mesmo banco do `npm run dev`).
// O `process` do Jest não expõe process.loadEnvFile, então lemos à mão.
const { readFileSync } = require("node:fs");

for (const line of readFileSync(".env.development", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2];
  }
}
