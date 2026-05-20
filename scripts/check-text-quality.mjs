import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set([
  '.git',
  '.idea',
  '.mint-export-check',
  'node_modules',
]);
const allowedExtensions = new Set([
  '.md',
  '.mdx',
  '.json',
  '.mjs',
  '.txt',
]);

const checks = [
  { name: 'mojibake', pattern: /(Ã§|Ã£|Ã¡|Ã©|Ãª|Ã­|Ã³|Ãº|Ãµ|Ã‡|Ã‰|Â|�|â€“|â€”|â€œ|â€|â€˜|â€™)/ },
  { name: 'texto quebrado', pattern: /(Deascri[cç][aã]o|Hist[oó]rco|Profissonal|estrnahos|caracetres|toas as paginas|consutla|mensallidade|perioddos|dee empresas|stutus|carrinerName)/i },
  { name: 'placeholder inseguro', pattern: /(jwt_token_real|client_secret|secret_real|token real)/i },
  { name: 'frase duplicada comum', pattern: /(Example RequestExample Request|Example Response\s+json\s+[\s\S]{0,80}Example Response\s+json)/ },
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

for (const file of walk(root)) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  if (relative === 'scripts/check-text-quality.mjs') continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

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

if (findings.length) {
  console.error('Text quality check failed:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.check}] ${finding.text}`);
  }
  process.exit(1);
}

console.log('Text quality check ok.');
