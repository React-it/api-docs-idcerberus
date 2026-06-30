import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://api-docs.idcerberus.com';
const requiredFiles = [
  'llms.txt',
  'llms-small.txt',
  'llms-full.txt',
  'llms-api-reference.txt',
  'services-catalog.json',
  'services-catalog.min.json',
  'mcp-manifest.json',
];

const findings = [];

function readJson(file) {
  const filePath = path.join(root, file);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    findings.push(`${file}: JSON inválido ou ausente (${error.message})`);
    return null;
  }
}

function requireFile(file) {
  if (!fs.existsSync(path.join(root, file))) findings.push(`${file}: arquivo obrigatório não encontrado`);
}

function requireField(file, item, field, label) {
  if (item[field] === undefined || item[field] === null || item[field] === '') {
    findings.push(`${file}: ${label} sem campo obrigatório ${field}`);
  }
}

function localPathFromUrl(url) {
  if (!url.startsWith(`${siteUrl}/`)) return null;
  return url.slice(`${siteUrl}/`.length);
}

function validatePublicUrl(file, url) {
  const local = localPathFromUrl(url);
  if (!local) return;
  if (local.startsWith('api-reference/')) return;

  if (local === 'examples/' || local === 'examples/*.curl') {
    const examplesDir = path.join(root, 'examples');
    const examples = fs.existsSync(examplesDir) ? fs.readdirSync(examplesDir).filter((entry) => entry.endsWith('.curl')) : [];
    if (examples.length === 0) findings.push(`${file}: nenhum exemplo curl encontrado em examples/`);
    return;
  }

  if (!fs.existsSync(path.join(root, local))) findings.push(`${file}: URL aponta para arquivo ausente ${url}`);
}

for (const file of requiredFiles) requireFile(file);

const catalogArtifact = readJson('services-catalog.json') || {};
const minCatalogArtifact = readJson('services-catalog.min.json') || {};
const manifest = readJson('mcp-manifest.json') || {};
const catalog = Array.isArray(catalogArtifact) ? catalogArtifact : catalogArtifact.services || [];
const minCatalog = Array.isArray(minCatalogArtifact) ? minCatalogArtifact : minCatalogArtifact.services || [];

for (const artifact of [
  ['services-catalog.json', catalogArtifact],
  ['services-catalog.min.json', minCatalogArtifact],
  ['mcp-manifest.json', manifest],
]) {
  requireField(artifact[0], artifact[1], 'generatedBy', 'artefato');
  requireField(artifact[0], artifact[1], 'artifactVersion', 'artefato');
}

if (catalog.length !== minCatalog.length) {
  findings.push(`services-catalog.min.json: total ${minCatalog.length} diferente do catálogo completo ${catalog.length}`);
}

if (catalogArtifact.totalServices !== catalog.length) {
  findings.push(`services-catalog.json: totalServices ${catalogArtifact.totalServices} diferente da lista ${catalog.length}`);
}

if (minCatalogArtifact.totalServices !== minCatalog.length) {
  findings.push(`services-catalog.min.json: totalServices ${minCatalogArtifact.totalServices} diferente da lista ${minCatalog.length}`);
}

for (const service of catalog) {
  const label = service.service || service.name || 'service sem identificação';
  for (const field of ['service', 'name', 'callingAlias', 'category', 'documentationUrl']) {
    requireField('services-catalog.json', service, field, label);
  }
  if (!Array.isArray(service.tags) || service.tags.length === 0) findings.push(`services-catalog.json: ${label} sem tags`);
  if (!Array.isArray(service.requiredFields)) findings.push(`services-catalog.json: ${label} sem requiredFields`);
  if (!service.payloadExample || typeof service.payloadExample !== 'object') findings.push(`services-catalog.json: ${label} sem payloadExample`);
  if (!service.successResponseExample?.result) findings.push(`services-catalog.json: ${label} sem successResponseExample.result`);
  if (!Array.isArray(service.commonErrors) || service.commonErrors.length === 0) findings.push(`services-catalog.json: ${label} sem commonErrors`);
  if (!service.mcpHints?.publicResponseField) findings.push(`services-catalog.json: ${label} sem mcpHints.publicResponseField`);
  validatePublicUrl('services-catalog.json', service.documentationUrl);
  for (const url of service.curlExampleUrls || []) validatePublicUrl('services-catalog.json', url);
}

for (const service of minCatalog) {
  const label = service.service || service.name || 'service sem identificação';
  for (const field of ['service', 'name', 'callingAlias', 'category', 'documentationUrl']) {
    requireField('services-catalog.min.json', service, field, label);
  }
  if (!Array.isArray(service.tags) || service.tags.length === 0) findings.push(`services-catalog.min.json: ${label} sem tags`);
  validatePublicUrl('services-catalog.min.json', service.documentationUrl);
}

for (const file of requiredFiles) {
  const resource = manifest.resources?.find((item) => item.name === file);
  if (!resource) findings.push(`mcp-manifest.json: recurso ausente para ${file}`);
}

for (const resource of manifest.resources || []) validatePublicUrl('mcp-manifest.json', resource.url);
for (const url of manifest.recommendedReadOrder || []) validatePublicUrl('mcp-manifest.json', url);

for (const field of ['recommendedReadOrder', 'suggestedTools', 'safetyRules', 'doNotAnswerAs', 'troubleshootingByStatus']) {
  if (!manifest[field] || (Array.isArray(manifest[field]) && manifest[field].length === 0)) {
    findings.push(`mcp-manifest.json: campo ${field} ausente ou vazio`);
  }
}

const families = manifest.catalogSummary?.serviceFamilies || {};
for (const family of ['ocr', 'faceBiometrics', 'cpf', 'cnpj', 'creditRisk']) {
  if (!Array.isArray(families[family]) || families[family].length === 0) {
    findings.push(`mcp-manifest.json: família ${family} ausente ou vazia`);
  }
}

if (findings.length) {
  console.error('Generated artifact validation failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Generated artifact validation ok.');
