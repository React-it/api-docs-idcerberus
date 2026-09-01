import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set(['.git', '.idea', '.mint-export-check', 'node_modules']);
const allowedExtensions = new Set(['.md', '.mdx', '.json', '.mjs', '.txt']);
const mojibakeFragments = [
  'Ã§',
  'Ã£',
  'Ã¡',
  'Ã©',
  'Ãª',
  'Ã­',
  'Ã³',
  'Ãº',
  'Ãµ',
  'Ã‡',
  'Ãƒ',
  'Ã‰',
  'Ãš',
  'Â´',
  'Âº',
  'Âª',
  'â€™',
  'â€œ',
  'â€�',
  'â€',
  '�',
];

const checks = [
  {
    name: 'mojibake',
    test: (line) => mojibakeFragments.some((fragment) => line.includes(fragment)),
  },
  {
    name: 'acentuacao quebrada',
    ptOnly: true,
    pattern:
      /(n\?o|est\?|p\?blico|cat\?logo|pr\?tica|requisi\?\?o|documenta\?\?o|integra\?\?o|autentica\?\?o|b\?sico|cr\?dito|cart\?o|endere\?o|identifica\?\?o|varia\?\?es|al\?m|p\?gina|fam\?lia|descri\?\?o|servi\?o|valida\?\?o|produ\?\?o|homologa\?\?o)/i,
  },
  {
    name: 'texto quebrado',
    ptOnly: true,
    pattern:
      /(Deascri[cç][aã]o|Hist[oó]rco|Profissonal|estrnahos|caracetres|toas as paginas|consutla|mensallidade|perioddos|dee empresas|stutus|carrinerName|Complice|Antecedenes|Fderal)/i,
  },
  {
    name: 'placeholder inseguro',
    pattern: /(jwt_token_real|client_secret|secret_real|token real)/i,
  },
  {
    name: 'placeholder ruim',
    pattern:
      /(FULANINHO DA SILVA|FULANO DA SILVA|FULANA DA SILVA|CICLANO DA SILVA|MARIO SOUSA|FRANCISCA SOUSA|FULANINHO DE TAL|FULANA DE TAL|Fulano de Tal|TEM FE PUBLICA|Tem f[eé]|fahtername|fatherName":\s*"")/i,
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

function failsCheck(check, line) {
  if (check.test) return check.test(line);
  return check.pattern.test(line);
}

function hasUnescapedApostrophe(text) {
  return text.replaceAll(String.raw`'\''`, '').includes("'");
}

function markdownTableCellCount(line) {
  return line.trim().split('|').filter((_, index, cells) => index !== 0 && index !== cells.length - 1).length;
}

function isMarkdownTableSeparator(line) {
  const cells = line.trim().split('|').filter((_, index, parts) => index !== 0 && index !== parts.length - 1).map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
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

  if (!relative.startsWith('scripts/')) {
    for (const match of content.matchAll(/\]\((\/(?:guides|api-reference)[^)#\s]+)(?:#[^)]+)?\)/g)) {
      internalLinks.push({ file: relative, target: match[1], line: content.slice(0, match.index).split(/\r?\n/).length });
    }

    for (const match of content.matchAll(/\bhref=["'](\/(?:guides|api-reference)[^"'\s#]+)(?:#[^"']*)?["']/g)) {
      internalLinks.push({ file: relative, target: match[1], line: content.slice(0, match.index).split(/\r?\n/).length });
    }
  }

  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1];
    if (line.trim().startsWith('|') && isMarkdownTableSeparator(nextLine)) {
      const headerColumns = markdownTableCellCount(line);
      const separatorColumns = markdownTableCellCount(nextLine);
      if (headerColumns !== separatorColumns) {
        findings.push({
          file: relative,
          line: index + 1,
          check: 'tabela markdown quebrada',
          text: line.trim().slice(0, 180),
        });
      }
    }
  }

  const isEnglishContent = relative === 'en' || relative.startsWith('en/');

  for (const [index, line] of lines.entries()) {
    for (const check of checks) {
      if (check.ptOnly && isEnglishContent) continue;
      if (failsCheck(check, line)) {
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

const openApiHrefs = new Set();

for (const openApiRelative of ['api-reference/openapi.json', 'en/api-reference/openapi.json']) {
  const openApiPath = path.join(root, openApiRelative);
  if (!fs.existsSync(openApiPath)) continue;

  const openApi = fs.readFileSync(openApiPath, 'utf8');
  const requestBlock = openApi.split(/\n\s{6}responses:/)[0] || '';
  const responseBlock = openApi.split(/\n\s{6}responses:/)[1] || '';

  for (const match of requestBlock.matchAll(/^\s{14}([A-Za-z0-9_]+):\s*$/gm)) openApiRequestExamples.add(match[1]);
  for (const match of responseBlock.matchAll(/^\s{16}([A-Za-z0-9_]+):\s*$/gm)) openApiResponseExamples.add(match[1]);

  for (const match of openApi.matchAll(/href:\s*(\S+)/g)) openApiHrefs.add(decodeURIComponent(match[1]));

  if (openApiRelative === 'api-reference/openapi.json') {
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
}

for (const link of internalLinks) {
  const normalized = link.target.replace(/^\/+/, '');
  const isEnglishFile = link.file === 'en' || link.file.startsWith('en/');
  const isEnglishTarget = normalized === 'en' || normalized.startsWith('en/');

  if (isEnglishFile && !isEnglishTarget) {
    findings.push({
      file: link.file,
      line: link.line,
      check: 'link sem prefixo /en/',
      text: link.target,
    });
    continue;
  }

  const withoutLanguage = isEnglishTarget ? normalized.slice('en/'.length) : normalized;
  const targetPath = path.join(root, `${decodeURIComponent(normalized)}.mdx`);
  if (fs.existsSync(targetPath)) continue;
  if (withoutLanguage.startsWith('api-reference/') && (!isEnglishTarget || openApiHrefs.has(`/${normalized}`))) continue;

  findings.push({
    file: link.file,
    line: link.line,
    check: 'link interno quebrado',
    text: link.target,
  });
}

for (const file of walk(root)) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  if (relative === 'scripts/check-text-quality.mjs') continue;
  if (path.extname(file) !== '.mdx' && path.extname(file) !== '.md') continue;

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let inBashBlock = false;
  let inDataLiteral = false;

  for (const [index, line] of lines.entries()) {
    if (/^```bash/.test(line.trim())) {
      inBashBlock = true;
      continue;
    }
    if (inBashBlock && line.trim() === '```') {
      inBashBlock = false;
      inDataLiteral = false;
      continue;
    }
    if (!inBashBlock) continue;

    const singleLineData = line.match(/--data\s+'(\{[\s\S]*\})'/);
    if (!inDataLiteral && singleLineData) {
      if (hasUnescapedApostrophe(singleLineData[1])) {
        findings.push({
          file: relative,
          line: index + 1,
          check: 'aspas simples quebrando bloco bash',
          text: line.trim().slice(0, 180),
        });
      }
      continue;
    }

    if (!inDataLiteral && /--data\s+'\{/.test(line)) {
      inDataLiteral = true;
      continue;
    }

    if (inDataLiteral) {
      if (/^\s*\}'/.test(line)) {
        inDataLiteral = false;
        continue;
      }
      if (hasUnescapedApostrophe(line)) {
        findings.push({
          file: relative,
          line: index + 1,
          check: 'aspas simples quebrando bloco bash',
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
