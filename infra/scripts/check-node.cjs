const major = Number(process.versions.node.split(".")[0]);

if (major < 24) {
  console.error(
    `Nublue precisa do Node.js 24 ou mais novo (encontrado ${process.versions.node}).`,
  );
  process.exit(1);
}
