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
    .replace(/<Info>/g, '> Info:')
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

const partnerApiServices = [
  ['SERVICE_ACTIVE_DEBT_PF_BIGDATACORP', 'Débitos ativos PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ACTIVE_DEBT_PF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_ADDRESS_BIGDATACORP', 'Endereços (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ADDRESS_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_CPF_ADDRESS_VALIDATION_BIGDATACORP', 'Validação de CPF com endereço (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_CPF_ADDRESS_VALIDATION_BIGDATACORP', cpf: 'cpf', zipcode: '00000-000', numberAddress: 13 }],
  ['SERVICE_CPF_PHONE_VALIDATION_BIGDATACORP', 'Validação de CPF com telefone (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_CPF_PHONE_VALIDATION_BIGDATACORP', cpf: 'cpf', phone: '11900000000' }],
  ['SERVICE_CPF_PHONE_VALIDATION_FACETEC', 'Validação de CPF com telefone (Facetec)', 'Pessoa Física', { service: 'SERVICE_CPF_PHONE_VALIDATION_FACETEC', cpf: 'cpf', phone: '11900000000' }],
  ['SERVICE_CONFIRM_PHONE_FACETEC', 'Obtenção de dados pelo telefone (Facetec)', 'Pessoa Física', { service: 'SERVICE_CONFIRM_PHONE_FACETEC', phone: '+5561123456789' }],
  ['SERVICE_CRIMINAL_RECORD_CIVIL_BIGDATACORP', 'Antecedentes criminais civis (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_CIVIL_BIGDATACORP', cpf: 'cpf', rg: 'rg', uf: 'uf' }],
  ['SERVICE_CRIMINAL_RECORD_FEDERAL_BIGDATACORP', 'Antecedentes criminais federais (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_FEDERAL_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_DEFAULT_RISK_SCORE_BIGDATACORP', 'Score de inadimplência (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_DEFAULT_RISK_SCORE_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX', 'Documentoscopia digital (Acertpix)', 'Pessoa Física', { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX', key: '{key}', image1: 'base64', image2: 'base64', selfie1: 'base64' }],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT_ACERTPIX', 'Consulta da documentoscopia digital (Acertpix)', 'Pessoa Física', { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT_ACERTPIX', key: '{key}' }],
  ['SERVICE_ECONOMIC_RELATIONSHIP_BIGDATACORP', 'Relacionamentos econômicos (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ECONOMIC_RELATIONSHIP_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_ELECTION_CANDIDATE_DATA_CPF_BIGDATACORP', 'Dados eleitorais de candidato PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ELECTION_CANDIDATE_DATA_CPF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_ELECTORAL_DONORS_CPF_BIGDATACORP', 'Doações eleitorais PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ELECTORAL_DONORS_CPF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_ELECTORAL_PROVIDERS_CPF_BIGDATACORP', 'Prestadores de serviços eleitorais PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ELECTORAL_PROVIDERS_CPF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_EMAILS_EXTENDED_BIGDATACORP', 'Histórico de e-mails (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_EMAILS_EXTENDED_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_EMAIL_VALIDATION_BIGDATACORP', 'Validação de e-mail (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_EMAIL_VALIDATION_BIGDATACORP', email: 'email@email.com' }],
  ['SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION_BIGDATACORP', 'Qualificação cadastral no eSocial (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION_BIGDATACORP', cpf: 'cpf', nit: 'nit (opcional)' }],
  ['SERVICE_FACE_MATCH_AWS', 'FaceMatch (AWS)', 'Pessoa Física', { service: 'SERVICE_FACE_MATCH_AWS', image1: 'base64', image2: 'base64' }],
  ['SERVICE_FACE_MATCH_BIGDATACORP', 'FaceMatch (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_FACE_MATCH_BIGDATACORP', image1: 'base64', image2: 'base64' }],
  ['SERVICE_FAMILY_POLITICAL_HISTORY_CPF_BIGDATACORP', 'Histórico político familiar PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_FAMILY_POLITICAL_HISTORY_CPF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_FINANCIAL_INFORMATION_BIGDATACORP', 'Informações financeiras (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_FINANCIAL_INFORMATION_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_FRAUD_RISK_SCORE_BIGDATACORP', 'Score de risco de fraude (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_FRAUD_RISK_SCORE_BIGDATACORP', cpf: 'cpf', factor: 'minRisk or minattrition' }],
  ['SERVICE_JURIDICAL_PROCESSES_BIGDATACORP', 'Processos jurídicos e administrativos (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_JURIDICAL_PROCESSES_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_LIVENESS_2D_FACETEC', 'Liveness 2D (Facetec)', 'Pessoa Física', { service: 'SERVICE_LIVENESS_2D_FACETEC', image1: 'selfie' }],
  ['SERVICE_MEDIA_PROFILE_EXPOSURE_PF_BIGDATACORP', 'Exposição e perfil na mídia PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_MEI_BIGDATACORP', 'Consulta de MEI (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_MEI_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_NOTHING_RECORD_LAWSUITS_BIGDATACORP', 'Nada consta de ações judiciais (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_NOTHING_RECORD_LAWSUITS_BIGDATACORP', cpf: 'cpf', court: 'TRF1', uf: 'uf', sphere: 'CIVIL' }],
  ['SERVICE_OCR_BIGDATACORP', 'OCR de documentos (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_OCR_BIGDATACORP', image1: 'base64', image2: 'base64', image1Url: 'url_image', image2Url: 'urlImageMatch' }],
  ['SERVICE_PEP', 'Pessoa politicamente exposta', 'Pessoa Física', { service: 'SERVICE_PEP', cpf: 'cpf' }],
  ['SERVICE_PERSON_DATA_ENRICHMENT_BIGDATACORP', 'Enriquecimento de dados PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_PERSON_DATA_ENRICHMENT_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_PHONE_HISTORY_BIGDATACORP', 'Histórico de telefones (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_PHONE_HISTORY_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_PIS_CONSULTATION_BIGDATACORP', 'Consulta do PIS (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_PIS_CONSULTATION_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_POLITICAL_INVOLVEMENT_BIGDATACORP', 'Envolvimento político (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_POLITICAL_INVOLVEMENT_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_POLITICAL_INVOLVEMENT_CPF_BIGDATACORP', 'Envolvimento político PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_POLITICAL_INVOLVEMENT_CPF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_PROFESSIONAL_HISTORY_BIGDATACORP', 'Histórico profissional (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_PROFESSIONAL_HISTORY_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_PROTEST_CLEARANCE_CERTIFICATE_BIGDATACORP', 'Certidão negativa de protesto (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_PROTEST_CLEARANCE_CERTIFICATE_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_PROTEST_PF_INFOSIMPLES', 'Certidão negativa de protesto PF (InfoSimples)', 'Pessoa Física', { service: 'SERVICE_PROTEST_PF_INFOSIMPLES', cpf: 'cpf' }],
  ['SERVICE_PROTEST_PF_NETRIN', 'Certidão negativa de protesto PF (Netrin)', 'Pessoa Física', { service: 'SERVICE_PROTEST_PF_NETRIN', cpf: 'cpf' }],
  ['SERVICE_PUBLIC_SERVANTS_BIGDATACORP', 'Servidores públicos (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_PUBLIC_SERVANTS_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_RELATED_PEOPLE_BIGDATACORP', 'Pessoas relacionadas (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_RELATED_PEOPLE_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_RFB_PF_BIGDATACORP', 'CPF na Receita Federal (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_RFB_PF_BIGDATACORP', cpf: 'cpf', dataDeNascimento: 'yyyy-MM-dd (opcional)' }],
  ['SERVICE_ACTIVE_DEBT_PJ_BIGDATACORP', 'Débitos ativos PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_ACTIVE_DEBT_PJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_ADDRESSES_EXTENDED_CNPJ_BIGDATACORP', 'Endereços estendidos CNPJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_ADDRESSES_EXTENDED_CNPJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_KYC_OWNERS_BIGDATACORP', 'KYC e compliance dos sócios (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_KYC_OWNERS_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RELATIONSHIP_BIGDATACORP', 'Relacionamentos de empresa (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RELATIONSHIP_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RFB_OWNERS_BIGDATACORP', 'Sócios na Receita Federal (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RFB_OWNERS_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_COMPLIANCE_BET_PJ_BIGDATACORP', 'Compliance de casas de apostas PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_COMPLIANCE_BET_PJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_CORPORATE_DATA_ENRICHMENT_BIGDATACORP', 'Enriquecimento de dados PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_CORPORATE_DATA_ENRICHMENT_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_DAS_MEI_INFOSIMPLES', 'DAS MEI na Receita (InfoSimples)', 'Pessoa Jurídica', { service: 'SERVICE_DAS_MEI_INFOSIMPLES', cnpj: 'cnpj' }],
  ['SERVICE_ELECTORAL_DONORS_CNPJ_BIGDATACORP', 'Doações eleitorais PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_ELECTORAL_DONORS_CNPJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_ELECTORAL_PROVIDERS_CNPJ_BIGDATACORP', 'Fornecedores eleitorais PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_ELECTORAL_PROVIDERS_CNPJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_FIRST_LEVEL_PARTNER_BIGDATACORP', 'Sócios de primeiro nível (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_FIRST_LEVEL_PARTNER_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS_BIGDATACORP', 'Processos jurídicos dos sócios (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_MEDIA_PROFILE_EXPOSURE_PJ_BIGDATACORP', 'Exposição e perfil na mídia PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ_BIGDATACORP', 'Doações eleitorais dos sócios (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_PROTEST_PJ_INFOSIMPLES', 'Certidão negativa de protesto PJ (InfoSimples)', 'Pessoa Jurídica', { service: 'SERVICE_PROTEST_PJ_INFOSIMPLES', cnpj: 'cnpj' }],
  ['SERVICE_PROTEST_PJ_NETRIN', 'Certidão negativa de protesto PJ (Netrin)', 'Pessoa Jurídica', { service: 'SERVICE_PROTEST_PJ_NETRIN', cnpj: 'cnpj' }],
  ['SERVICE_RFB_PJ_BIGDATACORP', 'CNPJ na Receita Federal (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_RFB_PJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_SINTEGRA_CONSULTATION_BIGDATACORP', 'Consulta do SINTEGRA (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_SINTEGRA_CONSULTATION_BIGDATACORP', cnpj: 'cnpj', uf: 'uf (opcional)' }],
];

function requestExampleFromBody(body) {
  return Object.entries(body).map(([key, value]) => `${key}: ${value}`).join('\n');
}

function mergePartnerApiServices(catalog) {
  const seen = new Set(catalog.map((service) => service.service));
  const extras = [];

  for (const [service, name, category, body] of partnerApiServices) {
    if (seen.has(service)) continue;

    const item = {
      summary: `${category === 'Pessoa Jurídica' ? 'PJ' : 'PF'} - ${name}`,
      service,
      requestBody: requestExampleFromBody(body),
    };

    extras.push({
      service,
      documentedAlias: service,
      name,
      category,
      documented: true,
      endpoint: 'POST /api/service-api',
      method: 'POST',
      requiresAuth: true,
      environments: {
        homologation: 'https://backoffice-hml.idcerberus.com',
        production: 'https://backoffice.idcerberus.com',
      },
      requestFields: Object.keys(body).filter((field) => field !== 'service'),
      requestExample: item.requestBody,
      documentationUrl: apiReferenceServiceUrl(item),
      guideUrl: guideUrlForCategory(category),
      apiReferenceSection: item.summary,
      searchTerms: buildSearchTerms(item),
    });
  }

  return [...catalog, ...extras].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
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
    lines.push(renderCurl({
      baseUrl: 'https://backoffice-hml.idcerberus.com',
      path: '/api/service-api',
      body: jsonBodyFromRequestExample(service.requestExample),
    }));
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

  return lines.join('\n');
}

function escapeTable(value) {
  return String(value).replaceAll('|', '\\|');
}

function escapeAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function normalizeText(value) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function serviceFamily(service) {
  const text = normalizeText(`${service.name} ${service.service} ${service.searchTerms?.join(' ') ?? ''}`);

  if (text.includes('telefone') || text.includes('phone') || text.includes('email') || text.includes('address') || text.includes('endereco') || text.includes('relacion') || text.includes('relationship') || text.includes('socio') || text.includes('qsa') || text.includes('sites') || text.includes('domains')) {
    return 'Contatos, sites e relacionamentos';
  }
  if (text.includes('ocr') || text.includes('face') || text.includes('liveness') || text.includes('biometric') || text.includes('documentoscopia') || text.includes('datavalid')) {
    return 'Biometria e documentos';
  }
  if (text.includes('eleitoral') || text.includes('election') || text.includes('electoral') || text.includes('politic') || text.includes('pep')) {
    return 'Dados eleitorais e PEP';
  }
  if (text.includes('juridic') || text.includes('criminal') || text.includes('lawsuit') || text.includes('protest') || text.includes('mandado') || text.includes('nada consta')) {
    return 'Jurídico, certidões e protestos';
  }
  if (text.includes('risco') || text.includes('score') || text.includes('debt') || text.includes('debito') || text.includes('divida') || text.includes('credito') || text.includes('financial') || text.includes('inadimplencia')) {
    return 'Risco, crédito e dívidas';
  }
  if (text.includes('kyc') || text.includes('compliance') || text.includes('bet') || text.includes('media')) {
    return 'KYC, compliance e exposição';
  }
  if (text.includes('receita') || text.includes('rfb') || text.includes('enriquecimento') || text.includes('cadastro') || text.includes('registration') || text.includes('demographic') || text.includes('pis') || text.includes('mei') || text.includes('sintegra') || text.includes('das')) {
    return 'Dados cadastrais e Receita Federal';
  }
  return 'Outros services';
}

function serviceUseCase(service) {
  const text = normalizeText(`${service.name} ${service.service}`);
  const target = service.category === 'Pessoa Jurídica' ? 'empresa' : 'pessoa';

  if (text.includes('rfb') || text.includes('receita')) return `Use para consultar ou validar dados cadastrais da ${target} em bases da Receita Federal.`;
  if (text.includes('enriquecimento')) return `Use para complementar dados cadastrais da ${target} a partir do documento informado.`;
  if (text.includes('demographic')) return `Use para consultar informações sociodemográficas associadas à ${target}.`;
  if (text.includes('ocr')) return 'Use para extrair dados de documentos enviados em base64 ou por URL.';
  if (text.includes('phone') || text.includes('telefone')) return 'Use para consultar, validar ou enriquecer dados de telefone.';
  if (text.includes('liveness')) return 'Use para validar prova de vida a partir de uma imagem de selfie.';
  if (text.includes('face')) return 'Use para comparar duas imagens faciais e retornar a similaridade entre elas.';
  if (text.includes('documentoscopia')) return 'Use para avaliar documento, selfie e biometria dentro do fluxo de documentoscopia.';
  if (text.includes('biometric') || text.includes('biometr')) return 'Use para comparar a imagem enviada com bases biométricas disponíveis e retornar a similaridade.';
  if (text.includes('pep')) return 'Use para verificar exposição política ou vínculo com Pessoa Politicamente Exposta.';
  if (text.includes('eleitoral') || text.includes('election') || text.includes('electoral')) return `Use para consultar informações eleitorais relacionadas à ${target}.`;
  if (text.includes('juridic') || text.includes('lawsuit') || text.includes('criminal')) return `Use para consultar certidões, processos ou informações jurídicas da ${target}.`;
  if (text.includes('protest')) return `Use para consultar protestos associados ao documento da ${target}.`;
  if (text.includes('financial') || text.includes('financeir')) return `Use para consultar informações financeiras associadas à ${target}.`;
  if (text.includes('score') || text.includes('risco')) return `Use para avaliar risco, score ou propensão associada à ${target}.`;
  if (text.includes('debt') || text.includes('debito') || text.includes('divida')) return `Use para consultar débitos ou dívidas associadas à ${target}.`;
  if (text.includes('kyc') || text.includes('compliance')) return `Use para executar checagens de KYC e compliance da ${target}.`;
  if (text.includes('email')) return 'Use para validar ou consultar histórico de e-mails relacionados ao documento.';
  if (text.includes('address') || text.includes('endereco')) return 'Use para consultar ou validar endereços associados ao documento.';
  if (text.includes('domains') || text.includes('sites')) return `Use para consultar dados de sites vinculados à ${target}.`;
  if (text.includes('relationship') || text.includes('relacion') || text.includes('socio')) return `Use para consultar vínculos, sócios ou relacionamentos associados à ${target}.`;

  return `Use este service quando precisar executar a consulta "${service.name}" via API.`;
}

function fieldRowsFromService(service) {
  const body = jsonBodyFromRequestExample(service.requestExample);
  return Object.entries(body).map(([name, value]) => {
    const raw = `${value ?? ''}`;
    return {
      name,
      value,
      required: name === 'service' || !normalizeText(raw).includes('opcional'),
      description: name === 'service'
        ? 'Código do produto que será executado.'
        : `Parâmetro usado pelo service ${service.service}.`,
    };
  });
}

function serviceResponseExample(service) {
  return {
    result: {
      observacao: `Os campos retornados variam conforme o service ${service.service}.`,
    },
    status: {
      code: 200,
      message: 'Success',
    },
    externalId: '{externalId}',
  };
}

function serviceErrorExamples() {
  return [
    {
      title: 'Token ausente ou inválido',
      body: {
        status: {
          code: 401,
          message: 'Unauthorized',
        },
      },
    },
    {
      title: 'Parâmetro obrigatório ausente',
      body: {
        status: {
          code: 400,
          message: 'Required field is missing or invalid',
        },
      },
    },
    {
      title: 'Service não liberado ou indisponível',
      body: {
        status: {
          code: 403,
          message: 'Service unavailable or not enabled for this client',
        },
      },
    },
  ];
}

function renderServiceRequestBlock(service) {
  const body = jsonBodyFromRequestExample(service.requestExample);
  const fieldRows = fieldRowsFromService(service);
  const required = fieldRows.filter((field) => field.required).map((field) => `\`${field.name}\``).join(', ');
  const optional = fieldRows.filter((field) => !field.required).map((field) => `\`${field.name}\``).join(', ') || 'Nenhum campo opcional mapeado neste exemplo.';
  const hmlCurl = renderCurl({ baseUrl: 'https://backoffice-hml.idcerberus.com', path: '/api/service-api', body });
  const prodCurl = renderCurl({ baseUrl: 'https://backoffice.idcerberus.com', path: '/api/service-api', body });
  const lines = [];

  lines.push(`<Accordion title="${escapeAttribute(service.name)}">`);
  lines.push('');
  lines.push(`**Service:** \`${service.service}\``);
  lines.push('');
  lines.push(`**Quando usar:** ${serviceUseCase(service)}`);
  lines.push('');
  lines.push('**Endpoint:** `POST /api/service-api`');
  lines.push('');
  lines.push(`**Campos obrigatórios:** ${required}`);
  lines.push('');
  lines.push(`**Campos opcionais:** ${optional}`);
  lines.push('');
  lines.push('### Body');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(body, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### Homologação');
  lines.push('');
  lines.push('```bash');
  lines.push(hmlCurl);
  lines.push('```');
  lines.push('');
  lines.push('### Produção');
  lines.push('');
  lines.push('```bash');
  lines.push(prodCurl);
  lines.push('```');
  lines.push('');
  lines.push('### Campos do body');
  lines.push('');
  lines.push('| Campo | Obrigatório | Descrição |');
  lines.push('| --- | --- | --- |');
  for (const field of fieldRows) {
    lines.push(`| \`${field.name}\` | ${field.required ? 'Sim' : 'Não'} | ${field.description} |`);
  }
  lines.push('');
  lines.push('### Response resumido');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(serviceResponseExample(service), null, 2));
  lines.push('```');
  lines.push('');
  lines.push('O objeto `result` muda de acordo com o produto. Para exemplos completos de retorno, consulte também o endpoint geral `POST /api/service-api` no OpenAPI.');
  lines.push('');
  lines.push('</Accordion>');

  return lines.join('\n');
}

function renderServiceQuickstartPage() {
  const lines = [];

  lines.push('---');
  lines.push('title: Como executar um service');
  lines.push('description: Passo a passo para autenticar, escolher ambiente, montar o body e chamar um service da API idCerberus.');
  lines.push('---');
  lines.push('');
  lines.push('# Como executar um service');
  lines.push('');
  lines.push('Esta página explica o fluxo padrão para executar qualquer produto documentado no API Reference.');
  lines.push('');
  lines.push('<Info>');
  lines.push('A maior parte das consultas usa o endpoint `POST /api/service-api`. O campo `service` define qual produto será executado.');
  lines.push('</Info>');
  lines.push('');
  lines.push('## Passo a passo');
  lines.push('');
  lines.push('<Steps>');
  lines.push('<Step title="Escolha o ambiente">');
  lines.push('');
  lines.push('| Ambiente | Base URL | Quando usar |');
  lines.push('| --- | --- | --- |');
  lines.push('| Homologação | `https://backoffice-hml.idcerberus.com` | Testes, validações e desenvolvimento. |');
  lines.push('| Produção | `https://backoffice.idcerberus.com` | Uso real, depois da liberação do cliente. |');
  lines.push('');
  lines.push('</Step>');
  lines.push('<Step title="Gere o token">');
  lines.push('');
  lines.push('```bash');
  lines.push(renderCurl({
    baseUrl: 'https://backoffice-hml.idcerberus.com',
    path: '/api/token-generate',
    bearer: false,
    body: { client: '{client}', secret: '{secret}' },
  }));
  lines.push('```');
  lines.push('');
  lines.push('Use o valor retornado em `access_token` no header `Authorization` das próximas chamadas.');
  lines.push('');
  lines.push('</Step>');
  lines.push('<Step title="Escolha o service">');
  lines.push('');
  lines.push('Use os catálogos de pessoa física e pessoa jurídica para copiar o valor exato do campo `service`.');
  lines.push('');
  lines.push('- [Services de pessoa física](/api-reference/services-pessoa-fisica)');
  lines.push('- [Services de pessoa jurídica](/api-reference/services-pessoa-juridica)');
  lines.push('- [Services por caso de uso](/api-reference/services-por-caso-de-uso)');
  lines.push('');
  lines.push('</Step>');
  lines.push('<Step title="Monte o body">');
  lines.push('');
  lines.push('O body sempre precisa ter `service`. Os outros campos dependem do produto escolhido.');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({ service: 'service_rfb_pf', cpf: 'cpf' }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</Step>');
  lines.push('<Step title="Execute a consulta">');
  lines.push('');
  lines.push('```bash');
  lines.push(renderCurl({
    baseUrl: 'https://backoffice-hml.idcerberus.com',
    path: '/api/service-api',
    body: { service: 'service_rfb_pf', cpf: 'cpf' },
  }));
  lines.push('```');
  lines.push('');
  lines.push('</Step>');
  lines.push('<Step title="Interprete o retorno">');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({
    result: {},
    status: { code: 200, message: 'Success' },
    externalId: '{externalId}',
  }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('- `result`: dados retornados pelo produto.');
  lines.push('- `status.code`: código do processamento.');
  lines.push('- `status.message`: mensagem resumida do processamento.');
  lines.push('- `externalId`: identificador externo da consulta, quando retornado.');
  lines.push('');
  lines.push('</Step>');
  lines.push('</Steps>');
  lines.push('');
  lines.push('## Erros comuns');
  lines.push('');
  lines.push('| Situação | Como corrigir |');
  lines.push('| --- | --- |');
  lines.push('| Token ausente, expirado ou inválido | Gere um novo token e envie `Authorization: Bearer {jwt_token}`. |');
  lines.push('| Campo `service` escrito errado | Copie o service pelo catálogo do API Reference. |');
  lines.push('| CPF, CNPJ, imagem ou parâmetro obrigatório ausente | Confira a seção de campos do service escolhido. |');
  lines.push('| Produto não liberado para o cliente | Confirme a liberação comercial/técnica antes de executar em produção. |');
  lines.push('| Retorno sem dados no `result` | Confirme se o documento consultado possui informação disponível para aquele produto. |');

  return lines.join('\n');
}

function renderUseCasePage(catalog) {
  const groups = new Map();
  for (const service of catalog) {
    const family = serviceFamily(service);
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(service);
  }

  const lines = [];
  lines.push('---');
  lines.push('title: Services por caso de uso');
  lines.push('description: Mapa rápido para encontrar o service certo a partir do objetivo da integração.');
  lines.push('---');
  lines.push('');
  lines.push('# Services por caso de uso');
  lines.push('');
  lines.push('Use esta página quando souber o objetivo da integração, mas ainda não souber qual `service` chamar.');
  lines.push('');
  lines.push('<Info>');
  lines.push('Depois de escolher o service, abra o catálogo de pessoa física ou pessoa jurídica para copiar o request completo.');
  lines.push('</Info>');
  lines.push('');

  for (const [family, services] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${family}`);
    lines.push('');
    lines.push('| Objetivo | Service | Documento |');
    lines.push('| --- | --- | --- |');
    for (const service of services.sort((a, b) => a.name.localeCompare(b.name))) {
      const doc = service.category === 'Pessoa Jurídica' ? 'CNPJ' : service.category === 'Pessoa Física' ? 'CPF' : '-';
      lines.push(`| ${escapeTable(service.name)} | \`${service.service}\` | ${doc} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderApiReferenceServicesPage(catalog, category, title, description) {
  const items = catalog.filter((service) => service.category === category);
  const grouped = new Map();
  for (const service of items) {
    const family = serviceFamily(service);
    if (!grouped.has(family)) grouped.set(family, []);
    grouped.get(family).push(service);
  }
  const lines = [];

  lines.push('---');
  lines.push(`title: ${title}`);
  lines.push(`description: ${description}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(description);
  lines.push('');
  lines.push('<Info>');
  lines.push('Todos os services abaixo usam o mesmo endpoint: `POST /api/service-api`. O produto executado é definido pelo campo `service` no body da requisição.');
  lines.push('</Info>');
  lines.push('');
  lines.push('## Como ler esta referência');
  lines.push('');
  lines.push('- **Nome**: nome funcional do produto.');
  lines.push('- **Service**: valor exato que deve ser enviado no campo `service`.');
  lines.push('- **Família**: agrupamento por objetivo de uso, como dados cadastrais, risco, jurídico ou biometria.');
  lines.push('- **Campos**: parâmetros esperados no body além de `service`.');
  lines.push('- **Exemplos**: cada item traz body JSON, curl de homologação, curl de produção e response resumido.');
  lines.push('');
  lines.push('## Índice por família');
  lines.push('');

  for (const [family, services] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### ${family}`);
    lines.push('');
    lines.push('| Nome | Service | Campos | Quando usar |');
    lines.push('| --- | --- | --- | --- |');
    for (const service of services.sort((a, b) => a.name.localeCompare(b.name))) {
      const fields = service.requestFields.length ? service.requestFields.map((field) => `\`${field}\``).join(', ') : '-';
      lines.push(`| ${escapeTable(service.name)} | \`${service.service}\` | ${fields} | ${escapeTable(serviceUseCase(service))} |`);
    }
    lines.push('');
  }

  lines.push('');
  lines.push('## Requests completos');
  lines.push('');

  for (const [family, services] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### ${family}`);
    lines.push('');
    lines.push('<AccordionGroup>');
    for (const service of services.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(renderServiceRequestBlock(service));
      lines.push('');
    }
    lines.push('</AccordionGroup>');
    lines.push('');
  }
  lines.push('');
  lines.push('## Padrões de erro');
  lines.push('');
  lines.push('Os exemplos abaixo mostram formatos comuns. A mensagem pode variar conforme validação, produto e ambiente.');
  lines.push('');
  lines.push('<AccordionGroup>');
  for (const example of serviceErrorExamples()) {
    lines.push(`<Accordion title="${escapeAttribute(example.title)}">`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(example.body, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('</Accordion>');
  }
  lines.push('</AccordionGroup>');

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
const servicesCatalog = mergePartnerApiServices(buildServicesCatalog(openApiSummary.services));
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
write(path.join(root, 'api-reference', 'como-executar-service.mdx'), renderServiceQuickstartPage());
write(path.join(root, 'api-reference', 'services-por-caso-de-uso.mdx'), renderUseCasePage(servicesCatalog));
write(path.join(root, 'api-reference', 'services-pessoa-fisica.mdx'), renderApiReferenceServicesPage(
  servicesCatalog,
  'Pessoa Física',
  'Services de pessoa física',
  'Catálogo explícito dos services de pessoa física disponíveis via API, com campos esperados e exemplos de request.',
));
write(path.join(root, 'api-reference', 'services-pessoa-juridica.mdx'), renderApiReferenceServicesPage(
  servicesCatalog,
  'Pessoa Jurídica',
  'Services de pessoa jurídica',
  'Catálogo explícito dos services de pessoa jurídica disponíveis via API, com campos esperados e exemplos de request.',
));

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
for (const item of servicesCatalog) {
  smallLines.push(`- ${item.category} - ${item.name}: \`${item.service}\``);
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
console.log(`Generated llms-full.txt with ${servicesCatalog.length} service examples.`);
console.log('Generated llms-api-reference.txt.');
console.log('Generated services-catalog.json.');
console.log('Generated guides/indice-de-services.mdx.');
console.log('Generated api-reference/como-executar-service.mdx.');
console.log('Generated api-reference/services-por-caso-de-uso.mdx.');
console.log('Generated api-reference/services-pessoa-fisica.mdx.');
console.log('Generated api-reference/services-pessoa-juridica.mdx.');
console.log(`Generated ${exampleFiles.length} curl examples.`);


