import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set(['.git', '.idea', '.mint-export-check', 'node_modules']);
const allowedExtensions = new Set(['.md', '.mdx', '.json', '.mjs', '.txt']);

const checks = [
  {
    name: 'mojibake',
    pattern: /(\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|�|â€“|â€”|â€œ|â€|â€˜|â€™)/,
  },
  {
    name: 'texto quebrado',
    pattern:
      /(Deascri[cç][aã]o|Hist[oó]rco|Profissonal|estrnahos|caracetres|toas as paginas|consutla|mensallidade|perioddos|dee empresas|stutus|carrinerName|Complice|Antecedenes|Fderal)/i,
  },
  {
    name: 'placeholder inseguro',
    pattern: /(jwt_token_real|client_secret|secret_real|token real)/i,
  },
  {
    name: 'frase duplicada comum',
    pattern: /(Example RequestExample Request|Example Response\s+json\s+[\s\S]{0,80}Example Response\s+json)/,
  },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name), files);
      continue;
    }

    const ext = path.extname(entry.name);
    if (allowedExtensions.has(ext)) files.push(path.join(dir, entry.name));
  }

  return files;
}

const findings = [];
const internalLinks = [];
const openApiRequestExamples = new Set();
const openApiResponseExamples = new Set();

for (const file of walk(root)) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  if (relative === 'scripts/check-text-quality.mjs') continue;

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const match of content.matchAll(/\]\((\/(?:guides|api-reference)[^)#\s]+)(?:#[^)]+)?\)/g)) {
    internalLinks.push({ file: relative, target: match[1] });
  }

  for (const [index, line] of lines.entries()) {
    for (const check of checks) {
      if (check.pattern.test(line)) {
        findings.push({
          file: relative,
          line: index + 1,
          check: check.name,
          text: line.trim().slice(0, 180),
        });
      }
    }
  }
}

const openApiPath = path.join(root, 'api-reference', 'openapi.json');
if (fs.existsSync(openApiPath)) {
  const openApi = fs.readFileSync(openApiPath, 'utf8');
  const requestBlock = openApi.split(/\n\s{6}responses:/)[0] || '';
  const responseBlock = openApi.split(/\n\s{6}responses:/)[1] || '';

  for (const match of requestBlock.matchAll(/^\s{14}([A-Za-z0-9_]+):\s*$/gm)) openApiRequestExamples.add(match[1]);
  for (const match of responseBlock.matchAll(/^\s{16}([A-Za-z0-9_]+):\s*$/gm)) openApiResponseExamples.add(match[1]);

  for (const requestKey of openApiRequestExamples) {
    if (!openApiResponseExamples.has(requestKey)) {
      findings.push({
        file: 'api-reference/openapi.json',
        line: 1,
        check: 'request sem response example',
        text: requestKey,
      });
    }
  }
}

for (const link of internalLinks) {
  const normalized = link.target.replace(/^\/+/, '');
  if (normalized.startsWith('api-reference/')) continue;

  const targetPath = path.join(root, `${decodeURIComponent(normalized)}.mdx`);
  if (!fs.existsSync(targetPath)) {
    findings.push({
      file: link.file,
      line: 1,
      check: 'link interno quebrado',
      text: link.target,
    });
  }
}

if (findings.length) {
  console.error('Text quality check failed:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.check}] ${finding.text}`);
  }
  process.exit(1);
}

console.log('Text quality check ok.');
