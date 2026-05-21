import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://react-it.github.io/api-docs-idcerberus';
const docsJsonPath = path.join(root, 'docs.json');
const openApiPath = path.join(root, 'api-reference', 'openapi.json');

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content.replace(/\r?\n/g, '\n'), 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function slugToFile(slug) {
  return path.join(root, `${slug}.mdx`);
}

function slugToUrl(slug) {
  if (slug === 'index') return `${siteUrl}/`;
  return `${siteUrl}/${slug}`;
}

function csvParse(content, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    const next = content[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, files);
    else files.push(fullPath);
  }

  return files;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const frontmatter = {};
  if (!match) return { frontmatter, body: content };

  for (const line of match[1].split('\n')) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) frontmatter[field[1]] = field[2].trim().replace(/^["']|["']$/g, '');
  }

  return {
    frontmatter,
    body: content.slice(match[0].length),
  };
}

function cleanMdx(content) {
  return content
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/<CardGroup[^>]*>/g, '')
    .replace(/<\/CardGroup>/g, '')
    .replace(/<Card[^>]*>/g, '')
    .replace(/<\/Card>/g, '')
    .replace(/<AccordionGroup[^>]*>/g, '')
    .replace(/<\/AccordionGroup>/g, '')
    .replace(/<Accordion[^>]*>/g, '')
    .replace(/<\/Accordion>/g, '')
    .replace(/<Tabs[^>]*>/g, '')
    .replace(/<\/Tabs>/g, '')
    .replace(/<Tab[^>]*>/g, '')
    .replace(/<\/Tab>/g, '')
    .replace(/<Steps[^>]*>/g, '')
    .replace(/<\/Steps>/g, '')
    .replace(/<Step[^>]*>/g, '')
    .replace(/<\/Step>/g, '')
    .replace(/<Tip>/g, '> Nota: ')
    .replace(/<\/Tip>/g, '')
    .replace(/<Warning>/g, '> Atencao: ')
    .replace(/<\/Warning>/g, '')
    .replace(/<Info>/g, '> Info: ')
    .replace(/<\/Info>/g, '')
    .replace(/<Note>/g, '> Nota: ')
    .replace(/<\/Note>/g, '')
    .replace(/<[^>\n]+\/>/g, '')
    .replace(/<[^>\n]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function flattenPages(navigation) {
  const items = [];
  for (const tab of navigation?.tabs ?? []) {
    for (const group of tab.groups ?? []) {
      if (group.pages) {
        for (const page of group.pages) {
          items.push({
            tab: tab.tab,
            group: group.group,
            slug: page,
          });
        }
      }
      if (group.openapi) {
        items.push({
          tab: tab.tab,
          group: group.group,
          slug: group.openapi,
          openapi: true,
        });
      }
    }
  }
  return items;
}

function getPageMeta(slug) {
  const filePath = slugToFile(slug);
  const content = read(filePath);
  const { frontmatter, body } = parseFrontmatter(content);
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();

  return {
    slug,
    filePath,
    title: frontmatter.title || h1 || slug,
    description: frontmatter.description || '',
    body: cleanMdx(content),
  };
}

function extractOpenApiSummary(content) {
  const lines = [];
  const services = [];
  const seen = new Set();
  let lastSummary = '';
  const sourceLines = content.split(/\r?\n/);

  function leadingSpaces(line) {
    return line.match(/^\s*/)?.[0].length ?? 0;
  }

  function collectYamlBlock(startIndex, parentIndent) {
    const block = [];

    for (let i = startIndex; i < sourceLines.length; i++) {
      const line = sourceLines[i];
      if (!line.trim()) {
        block.push('');
        continue;
      }

      const indent = leadingSpaces(line);
      if (indent <= parentIndent) break;

      block.push(line.slice(parentIndent + 2));
    }

    return block.join('\n').trim();
  }

  for (let index = 0; index < sourceLines.length; index++) {
    const line = sourceLines[index];
    const summaryMatch = line.match(/^\s*summary:\s*(.+?)\s*$/);
    if (summaryMatch) {
      lastSummary = summaryMatch[1].trim().replace(/^["']|["']$/g, '');
      continue;
    }

    const serviceMatch = line.match(/^\s*service:\s*([A-Za-z0-9_]+)\s*$/);
    if (!serviceMatch) continue;

    const service = serviceMatch[1].trim();
    const key = service.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let requestBody = '';
    for (let back = index - 1; back >= Math.max(0, index - 20); back--) {
      if (/^\s*value:\s*$/.test(sourceLines[back])) {
        requestBody = collectYamlBlock(back + 1, leadingSpaces(sourceLines[back]));
        break;
      }
    }

    services.push({
      summary: lastSummary || 'Servico de API',
      service,
      requestBody,
    });
  }

  lines.push('## API Reference - services');
  lines.push('');
  lines.push('A maioria das consultas usa `POST /api/service-api` e seleciona o produto pelo campo `service` no body.');
  lines.push('');
  for (const item of services.sort((a, b) => a.summary.localeCompare(b.summary))) {
    lines.push(`- ${item.summary}: \`${item.service}\``);
    if (item.requestBody) {
      lines.push('');
      lines.push('  ```yaml');
      lines.push(item.requestBody.split('\n').map((line) => `  ${line}`).join('\n'));
      lines.push('  ```');
      lines.push('');
    }
  }

  return {
    services,
    markdown: lines.join('\n'),
  };
}

function serviceCategory(summary, service) {
  if (/^PJ\s+-/i.test(summary)) return 'Pessoa Jurídica';
  if (/^PF\s+-/i.test(summary)) return 'Pessoa Física';
  if (/CUSTOMER|changeStatusOfCustomer/i.test(service)) return 'Customers';
  if (/onboarding/i.test(service)) return 'Onboarding';
  return 'Geral';
}

function requestFieldsFromYaml(requestBody) {
  const fields = [];
  for (const line of requestBody.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+):/);
    if (!match || match[1] === 'service') continue;
    if (!fields.includes(match[1])) fields.push(match[1]);
  }
  return fields;
}

function buildServicesCatalog(openApiServices) {
  return openApiServices
    .slice()
    .sort((a, b) => a.summary.localeCompare(b.summary))
    .map((item) => {
      return {
        service: item.service,
        documentedAlias: item.service,
        name: item.summary.replace(/^(PF|PJ)\s+-\s+/i, ''),
        category: serviceCategory(item.summary, item.service),
        documented: true,
        endpoint: 'POST /api/service-api',
        method: 'POST',
        requiresAuth: true,
        environments: {
          homologation: 'https://backoffice-hml.idcerberus.com',
          production: 'https://backoffice.idcerberus.com',
        },
        requestFields: requestFieldsFromYaml(item.requestBody),
        requestExample: item.requestBody || `service: ${item.service}`,
        documentationUrl: apiReferenceServiceUrl(item),
        guideUrl: guideUrlForCategory(serviceCategory(item.summary, item.service)),
        apiReferenceSection: item.summary,
        searchTerms: buildSearchTerms(item),
      };
    });
}

function buildSearchTerms(item) {
  const terms = new Set([
    item.service,
    item.summary,
    item.summary.replace(/^(PF|PJ)\s+-\s+/i, ''),
  ]);
  const text = `${item.summary} ${item.service}`.toLowerCase();
  if (text.includes('rfb') || text.includes('receita') || text.includes('cpf')) terms.add('CPF Receita Federal');
  if (text.includes('cnpj') || text.includes('corporate')) terms.add('CNPJ Receita Federal');
  if (text.includes('ocr')) terms.add('extração de documento');
  if (text.includes('face')) terms.add('comparação facial');
  if (text.includes('kyc')) terms.add('compliance');
  if (text.includes('debt') || text.includes('débito')) terms.add('dívida ativa');
  if (text.includes('electoral') || text.includes('eleitoral')) terms.add('dados eleitorais');
  return [...terms].sort();
}

function apiReferenceServiceUrl(item) {
  const base = `${siteUrl}/api-reference/servi%C3%A7os--pessoas/executar-servi%C3%A7o-de-dados-risco-ou-compliance`;
  return base;
}

function guideUrlForCategory(category) {
  const map = {
    'Pessoa Física': `${siteUrl}/guides/servicos-pessoa-fisica`,
    'Pessoa Jurídica': `${siteUrl}/guides/servicos-pessoa-juridica`,
    Customers: `${siteUrl}/guides/customers`,
    Onboarding: `${siteUrl}/guides/onboarding-sdk`,
  };
  return map[category] || `${siteUrl}/guides/matriz-de-servicos`;
}

function jsonBodyFromRequestExample(requestExample) {
  const entries = [];
  for (const line of requestExample.split(/\r?\n/).filter(Boolean)) {
    const field = line.match(/^\s*([A-Za-z0-9_]+):\s*(.*)$/);
    if (!field) continue;
    entries.push([field[1], field[2].replace(/^["']|["']$/g, '')]);
  }
  return Object.fromEntries(entries);
}

function renderCurl({ baseUrl, path: endpointPath, body, method = 'POST', bearer = true }) {
  const headers = ["--header 'Content-Type: application/json'"];
  if (bearer) headers.push("--header 'Authorization: Bearer {jwt_token}'");
  const lines = [`curl --location '${baseUrl}${endpointPath}' \\`, ...headers.map((header) => `${header} \\`)];
  if (body) {
    lines.push(`--data '${JSON.stringify(body, null, 2)}'`);
  }
  if (method !== 'POST') {
    lines[0] = `curl --location --request ${method} '${baseUrl}${endpointPath}' \\`;
  }
  return lines.join('\n');
}

function writeExampleFiles(catalog) {
  const examplesDir = path.join(root, 'examples');
  ensureDir(examplesDir);

  const examples = [
    {
      file: 'auth.hml.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/token-generate',
        bearer: false,
        body: { client: '{client}', secret: '{secret}' },
      }),
    },
    {
      file: 'auth.prod.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice.idcerberus.com',
        path: '/api/token-generate',
        bearer: false,
        body: { client: '{client}', secret: '{secret}' },
      }),
    },
    {
      file: 'service-api-cpf.hml.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'service_rfb_pf', cpf: 'cpf', dataDeNascimento: 'yyyy-MM-dd (opcional)' },
      }),
    },
    {
      file: 'service-api-cpf.prod.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'service_rfb_pf', cpf: 'cpf', dataDeNascimento: 'yyyy-MM-dd (opcional)' },
      }),
    },
    {
      file: 'service-api-cnpj.hml.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'service_rfb_pj', cnpj: 'cnpj' },
      }),
    },
    {
      file: 'service-api-cnpj.prod.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'service_rfb_pj', cnpj: 'cnpj' },
      }),
    },
    {
      file: 'facematch.hml.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'service_face_match', image1: 'base64', image2: 'base64' },
      }),
    },
    {
      file: 'documentoscopia.hml.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'service_digital_documentoscopy', key: '{key}', image1: 'base64', image2: 'base64', selfie1: 'base64' },
      }),
    },
  ];

  for (const example of examples) write(path.join(examplesDir, example.file), `${example.content}\n`);

  return examples.map((example) => ({
    file: example.file,
    url: `${siteUrl}/examples/${example.file}`,
  }));
}

function renderApiReferenceText(servicesCatalog) {
  const lines = [];
  lines.push('# idCerberus API Reference - resumo operacional para LLM');
  lines.push('');
  lines.push('Use este arquivo para gerar exemplos de request, explicar chamadas da API e escolher o `service` correto sem depender do OpenAPI completo.');
  lines.push('');
  lines.push('## Regras obrigatórias');
  lines.push('');
  lines.push('- Não invente endpoints, parâmetros ou services.');
  lines.push('- Para consultas externas, use `POST /api/service-api` e envie o campo `service` no body.');
  lines.push('- Use homologação para testes: `https://backoffice-hml.idcerberus.com`.');
  lines.push('- Use produção somente quando o usuário pedir explicitamente: `https://backoffice.idcerberus.com`.');
  lines.push('- Nunca exponha `client`, `secret`, JWT real, CPF real, CNPJ real ou imagens reais em exemplos.');
  lines.push('- Quando faltar um service no catálogo, diga que ele precisa ser confirmado antes de documentar ou integrar.');
  lines.push('');
  lines.push('## Autenticação');
  lines.push('');
  lines.push('```bash');
  lines.push("curl --location 'https://backoffice-hml.idcerberus.com/api/token-generate' \\");
  lines.push("--header 'Content-Type: application/json' \\");
  lines.push("--data '{");
  lines.push('  "client": "{client}",');
  lines.push('  "secret": "{secret}"');
  lines.push("}'");
  lines.push('```');
  lines.push('');

  let currentCategory = '';
  for (const service of servicesCatalog) {
    if (service.category !== currentCategory) {
      currentCategory = service.category;
      lines.push(`## ${currentCategory}`);
      lines.push('');
    }

    lines.push(`### ${service.name}`);
    lines.push('');
    lines.push(`- Service: \`${service.service}\``);
    lines.push(`- Endpoint: \`${service.endpoint}\``);
    lines.push(`- Campos do request: ${service.requestFields.length ? service.requestFields.map((field) => `\`${field}\``).join(', ') : 'sem campos adicionais mapeados'}`);
    lines.push('');
    lines.push('```bash');
    lines.push("curl --location 'https://backoffice-hml.idcerberus.com/api/service-api' \\");
    lines.push("--header 'Content-Type: application/json' \\");
    lines.push("--header 'Authorization: Bearer {jwt_token}' \\");
    lines.push("--data '{");
    const requestLines = service.requestExample.split(/\r?\n/).filter(Boolean);
    const requestFields = requestLines
      .map((line) => line.match(/^\s*([A-Za-z0-9_]+):\s*(.*)$/))
      .filter((field) => field && field[1] !== 'service');
    for (const [index, field] of requestFields.entries()) {
      if (!field) continue;
      const comma = index === requestFields.length - 1 ? '' : ',';
      lines.push(`  "${field[1]}": "${field[2].replace(/^["']|["']$/g, '')}"${comma}`);
    }
    lines.push("}'");
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function renderServicesIndex(catalog) {
  const lines = [];
  lines.push('---');
  lines.push('title: Índice de services');
  lines.push('description: Lista operacional dos services já documentados no API Reference');
  lines.push('---');
  lines.push('');
  lines.push('# Índice de services');
  lines.push('');
  lines.push('Use este índice quando já souber qual produto precisa executar e quiser confirmar o nome exato do `service` antes de montar a chamada.');
  lines.push('');
  lines.push('<Info>');
  lines.push('Todas as consultas abaixo usam `POST /api/service-api`. O produto executado é definido pelo campo `service` no body.');
  lines.push('</Info>');
  lines.push('');

  let currentCategory = '';
  for (const service of catalog) {
    if (service.category !== currentCategory) {
      currentCategory = service.category;
      lines.push(`## ${currentCategory}`);
      lines.push('');
  lines.push('| Nome | Service | Campos principais |');
      lines.push('| --- | --- | --- |');
    }
    const fields = service.requestFields.length ? service.requestFields.map((field) => `\`${field}\``).join(', ') : '-';
    lines.push(`| [${service.name}](${service.documentationUrl}) | \`${service.service}\` | ${fields} |`);
  }

  lines.push('');
  lines.push('## Arquivos para IA');
  lines.push('');
  lines.push('- [`/services-catalog.json`](/services-catalog.json): catálogo estruturado em JSON.');
  lines.push('- [`/llms-api-reference.txt`](/llms-api-reference.txt): resumo operacional do API Reference.');
  return lines.join('\n');
}

const docsConfig = JSON.parse(read(docsJsonPath));
const pages = flattenPages(docsConfig.navigation);
const mdxPages = pages.filter((page) => !page.openapi).map((page) => ({
  ...page,
  ...getPageMeta(page.slug),
}));
const openApiContent = read(openApiPath);
const openApiSummary = extractOpenApiSummary(openApiContent);
const servicesCatalog = buildServicesCatalog(openApiSummary.services);
const exampleFiles = writeExampleFiles(servicesCatalog);
const llmRules = [
  '## Regras para assistentes de IA',
  '',
  '- Use a documentação como fonte principal e não invente endpoints, parâmetros ou services.',
  '- Para consultas externas, use `POST /api/service-api` e selecione o produto pelo campo `service`.',
  '- Use `Authorization: Bearer {jwt_token}` em chamadas protegidas.',
  '- Use homologação para testes e produção somente quando o usuário pedir explicitamente.',
  '- Nunca exponha tokens, secrets, CPFs, CNPJs ou imagens reais em exemplos.',
  '- Se um service não aparecer no catálogo, informe que ele precisa ser confirmado antes de documentar ou integrar.',
  '',
].join('\n');

write(path.join(root, 'services-catalog.json'), `${JSON.stringify(servicesCatalog, null, 2)}\n`);
write(path.join(root, 'llms-api-reference.txt'), renderApiReferenceText(servicesCatalog));
write(path.join(root, 'guides', 'indice-de-services.mdx'), renderServicesIndex(servicesCatalog));

const llmsLines = [];
llmsLines.push('# idCerberus API Docs');
llmsLines.push('');
llmsLines.push('> Documentação da API idCerberus para onboarding digital, KYC, biometria, FaceMatch, Liveness, análise de risco, compliance, enriquecimento cadastral e consultas de pessoa física e pessoa jurídica.');
llmsLines.push('');
llmsLines.push('Base URLs:');
llmsLines.push('');
llmsLines.push('- Homologação: `https://backoffice-hml.idcerberus.com`');
llmsLines.push('- Produção: `https://backoffice.idcerberus.com`');
llmsLines.push('- Documentação publicada: `https://react-it.github.io/api-docs-idcerberus/`');
llmsLines.push('');
llmsLines.push(llmRules);
llmsLines.push('## Conteúdo principal');
llmsLines.push('');

let currentGroup = '';
for (const page of mdxPages) {
  const groupName = `${page.tab} / ${page.group}`;
  if (groupName !== currentGroup) {
    currentGroup = groupName;
    llmsLines.push(`### ${groupName}`);
    llmsLines.push('');
  }
  const desc = page.description ? `: ${page.description}` : '';
  llmsLines.push(`- [${page.title}](${slugToUrl(page.slug)})${desc}`);
}

llmsLines.push('');
llmsLines.push('## API Reference');
llmsLines.push('');
llmsLines.push(`- [OpenAPI reference](${slugToUrl('api-reference/boas-vindas')}): endpoints, exemplos de request/response e schemas.`);
llmsLines.push('- Endpoint principal de consultas: `POST /api/service-api`.');
llmsLines.push('- Autenticação: `POST /api/token-generate` retorna `access_token`; use `Authorization: Bearer {jwt_token}` nas chamadas protegidas.');
llmsLines.push('');
llmsLines.push('## Arquivo completo para LLM');
llmsLines.push('');
llmsLines.push(`- [llms-small.txt](${siteUrl}/llms-small.txt): resumo operacional com fluxos, autenticação, service-api e services documentados.`);
llmsLines.push(`- [llms-full.txt](${siteUrl}/llms-full.txt): versão consolidada dos guias e da API Reference.`);
llmsLines.push(`- [llms-api-reference.txt](${siteUrl}/llms-api-reference.txt): referência operacional dos services com exemplos de curl.`);
llmsLines.push(`- [services-catalog.json](${siteUrl}/services-catalog.json): catálogo estruturado para ferramentas e automações.`);
llmsLines.push('');
llmsLines.push('## Exemplos curl');
llmsLines.push('');
for (const example of exampleFiles) llmsLines.push(`- [${example.file}](${example.url})`);

write(path.join(root, 'llms.txt'), llmsLines.join('\n'));

const smallLines = [];
smallLines.push('# idCerberus API Docs - resumo operacional para LLM');
smallLines.push('');
smallLines.push('Use este arquivo quando precisar de contexto rápido para integrar com a API idCerberus.');
smallLines.push('');
smallLines.push(llmRules);
smallLines.push('## Ambientes');
smallLines.push('');
smallLines.push('- Homologação: `https://backoffice-hml.idcerberus.com`');
smallLines.push('- Produção: `https://backoffice.idcerberus.com`');
smallLines.push('');
smallLines.push('## Autenticação');
smallLines.push('');
smallLines.push('- Gere token em `POST /api/token-generate` com `client` e `secret`.');
smallLines.push('- Envie o token nas chamadas protegidas com `Authorization: Bearer {jwt_token}`.');
smallLines.push('- Quando expirar, gere um novo token.');
smallLines.push('');
smallLines.push('## Endpoint principal');
smallLines.push('');
smallLines.push('- Use `POST /api/service-api` para consultas de dados, risco, compliance, biometria e enriquecimento.');
smallLines.push('- O campo `service` define qual produto será executado.');
smallLines.push('- Os demais campos variam conforme o serviço escolhido.');
smallLines.push('');
smallLines.push('## Fluxos principais');
smallLines.push('');
for (const slug of [
  'guides/quickstart',
  'guides/autenticacao',
  'guides/primeira-consulta-cpf',
  'guides/primeira-consulta-cnpj',
  'guides/onboarding-sdk',
  'guides/matriz-de-servicos',
]) {
  const page = mdxPages.find((item) => item.slug === slug);
  if (page) smallLines.push(`- [${page.title}](${slugToUrl(page.slug)}): ${page.description || 'Guia da documentação idCerberus.'}`);
}
smallLines.push('');
smallLines.push('## Services documentados no API Reference');
smallLines.push('');
for (const item of openApiSummary.services.sort((a, b) => a.summary.localeCompare(b.summary))) {
  smallLines.push(`- ${item.summary}: \`${item.service}\``);
}
smallLines.push('');
smallLines.push('## Arquivos auxiliares');
smallLines.push('');
smallLines.push(`- Catálogo JSON: ${siteUrl}/services-catalog.json`);
smallLines.push(`- API Reference para LLM: ${siteUrl}/llms-api-reference.txt`);
smallLines.push(`- Exemplos curl: ${siteUrl}/examples/auth.hml.curl`);

write(path.join(root, 'llms-small.txt'), smallLines.join('\n'));

const fullLines = [];
fullLines.push('# idCerberus API Docs - conteúdo completo para LLM');
fullLines.push('');
fullLines.push('Este arquivo consolida os guias e a referência da API idCerberus em texto simples para uso por LLMs, agentes e assistentes de desenvolvimento.');
fullLines.push('');
fullLines.push('Base URLs:');
fullLines.push('');
fullLines.push('- Homologação: `https://backoffice-hml.idcerberus.com`');
fullLines.push('- Produção: `https://backoffice.idcerberus.com`');
fullLines.push('');
fullLines.push(llmRules);

for (const page of mdxPages) {
  fullLines.push('---');
  fullLines.push('');
  fullLines.push(`# ${page.title}`);
  fullLines.push('');
  fullLines.push(`URL: ${slugToUrl(page.slug)}`);
  fullLines.push(`Fonte: ${page.slug}.mdx`);
  if (page.description) fullLines.push(`Descrição: ${page.description}`);
  fullLines.push('');
  fullLines.push(page.body);
  fullLines.push('');
}

fullLines.push('---');
fullLines.push('');
fullLines.push('# API Reference');
fullLines.push('');
fullLines.push(`URL: ${slugToUrl('api-reference/boas-vindas')}`);
fullLines.push('Fonte: api-reference/openapi.json');
fullLines.push('');
fullLines.push(openApiSummary.markdown);
fullLines.push('');
fullLines.push('## API Reference operacional para LLM');
fullLines.push('');
fullLines.push(read(path.join(root, 'llms-api-reference.txt')).trim());
fullLines.push('');
fullLines.push('## OpenAPI bruto');
fullLines.push('');
fullLines.push('```yaml');
fullLines.push(openApiContent.trim());
fullLines.push('```');

write(path.join(root, 'llms-full.txt'), fullLines.join('\n'));

console.log(`Generated llms.txt with ${mdxPages.length} pages.`);
console.log('Generated llms-small.txt.');
console.log(`Generated llms-full.txt with ${openApiSummary.services.length} service examples.`);
console.log('Generated llms-api-reference.txt.');
console.log('Generated services-catalog.json.');
console.log('Generated guides/indice-de-services.mdx.');
console.log(`Generated ${exampleFiles.length} curl examples.`);


