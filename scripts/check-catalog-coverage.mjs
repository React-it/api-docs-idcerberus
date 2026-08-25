import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readFile(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const catalog = JSON.parse(readFile('services-catalog.json'));
const services = catalog.services || [];

const indexFiles = ['guides/service-api/familias-de-servicos.mdx', 'guides/matriz-de-servicos.mdx'];

const categoryFileMap = {
  'Pessoa Física': 'guides/servicos-pessoa-fisica.mdx',
  'Pessoa Jurídica': 'guides/servicos-pessoa-juridica.mdx',
};

const filesToRead = [...new Set([...indexFiles, ...Object.values(categoryFileMap)])];
const contents = Object.fromEntries(filesToRead.map((file) => [file, readFile(file)]));

const findings = [];

for (const service of services) {
  const alias = service.service;
  if (!alias || service.documented === false) continue;

  for (const file of indexFiles) {
    if (!contents[file].includes(alias)) {
      findings.push(`${file}: falta o service ${alias} (${service.name})`);
    }
  }

  const categoryFile = categoryFileMap[service.category];
  if (categoryFile && !contents[categoryFile].includes(alias)) {
    findings.push(`${categoryFile}: falta o service ${alias} (${service.name})`);
  }
}

function findDuplicateRowsInTables(file, content) {
  const lines = content.split('\n');
  let table = [];

  const flushTable = () => {
    const seen = new Map();
    for (const { alias, line } of table) {
      if (!seen.has(alias)) {
        seen.set(alias, line);
        continue;
      }
      findings.push(`${file}: ${alias} aparece em mais de uma linha da mesma tabela (linhas ${seen.get(alias)} e ${line})`);
    }
    table = [];
  };

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    const isTableRow = line.startsWith('|') && !/^\|[\s-:|]+\|$/.test(line);

    if (!isTableRow) {
      if (table.length) flushTable();
      return;
    }

    const match = line.match(/`(SERVICE_[A-Z0-9_]+)`/);
    if (match) table.push({ alias: match[1], line: lineNumber });
  });

  if (table.length) flushTable();
}

for (const file of filesToRead) {
  findDuplicateRowsInTables(file, contents[file]);
}

if (findings.length) {
  console.error(`Cobertura/consistência do catálogo com pendências (${findings.length}):`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Catalog coverage ok: ${services.length} services presentes e sem linhas duplicadas nos guias-índice.`);
