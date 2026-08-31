import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://api-docs.idcerberus.com';
const docsJsonPath = path.join(root, 'docs.json');
const openApiPath = path.join(root, 'api-reference', 'openapi.json');
const generatedBy = 'scripts/generate-llms.mjs';
const artifactVersion = '2026-06';

const serviceAliasRows = [
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY', 'SERVICE_DOCUMENTOSCOPY'],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT', 'SERVICE_DIGITAL_DOCUMENTOSCOPY'],
  ['SERVICE_ECONOMIC_RELATIONSHIP', 'economic_relationships'],
  ['SERVICE_EMAIL_VALIDATION', 'SERVICE_EMAIL_VALIDATION1'],
  ['SERVICE_PROTEST_CLEARANCE_CERTIFICATE, SERVICE_PROTEST_PF', 'SERVICE_PROTEST_CLEARANCE_CERTIFICATE'],
  ['SERVICE_PROTEST_PJ', 'SERVICE_PROTEST_CLEARANCE_CERTIFICATE_PJ'],
];

const serviceAliasRowsPessoaFisica = serviceAliasRows.filter(([documentedAlias]) => !documentedAlias.includes('SERVICE_PROTEST_PJ'));
const serviceAliasRowsPessoaJuridica = serviceAliasRows.filter(([documentedAlias]) => documentedAlias.includes('SERVICE_PROTEST_PJ'));

function pushServiceAliasNote(lines, { includeDocumentPayloadNote = false } = {}, lang = 'pt') {
  if (lang === 'en') {
    lines.push('<Warning>');
    lines.push('Before running the call, confirm which service is enabled on the client\'s product. The \`service\` field must receive exactly the public value shown in the catalog.');
    lines.push('</Warning>');
    lines.push('');
    lines.push('In practice: copy the \`Service\` value from the card or accordion of the product and send that value in the request body. The documentation does not expose internal integration aliases.');
    lines.push('');

    if (includeDocumentPayloadNote) {
      lines.push('<Info>');
      lines.push('OCR, documentoscopy, FaceMatch and Liveness need a real image/base64, URL or \`key\` to return complete data. A short payload helps validate authentication, product access and the basic call format, but does not validate the full processing return.');
      lines.push('</Info>');
      lines.push('');
    }
    return;
  }

  lines.push('<Warning>');
  lines.push('Antes de executar a chamada, confirme qual service está liberado no produto do cliente. O campo \`service\` deve receber exatamente o valor público exibido no catálogo.');
  lines.push('</Warning>');
  lines.push('');
  lines.push('Na prática: copie o valor de \`Service\` no card ou no accordion do produto e envie esse valor no body da requisição. A documentação não expõe aliases internos de integração.');
  lines.push('');

  if (includeDocumentPayloadNote) {
    lines.push('<Info>');
    lines.push('OCR, documentoscopia, FaceMatch e Liveness precisam de imagem/base64, URL ou \`key\` real para retornar dados completos. Payload curto ajuda a validar autenticação, acesso ao produto e formato básico da chamada, mas não valida o retorno completo do processamento.');
    lines.push('</Info>');
    lines.push('');
  }
}

function read(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function write(filePath, content) {
  const normalized = content
    .replace(/\r?\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\s+$/g, '');
  fs.writeFileSync(filePath, `${normalized}\n`, 'utf8');
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
    .replace(/<Tip>/g, '> Nota:')
    .replace(/<\/Tip>/g, '')
    .replace(/<Warning>/g, '> Atencao:')
    .replace(/<\/Warning>/g, '')
    .replace(/<Info>/g, '> Info:')
    .replace(/<\/Info>/g, '')
    .replace(/<Note>/g, '> Nota:')
    .replace(/<\/Note>/g, '')
    .replace(/<[^>\n]+\/>/g, '')
    .replace(/<[^>\n]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function flattenGroupPages(tabName, groupName, pages, items) {
  for (const page of pages) {
    if (typeof page === 'string') {
      items.push({ tab: tabName, group: groupName, slug: page });
    } else if (page && typeof page === 'object' && Array.isArray(page.pages)) {
      // nested subgroup (e.g. docs.json "OCR via service API" inside "POST /api/service-api")
      flattenGroupPages(tabName, page.group ?? groupName, page.pages, items);
    }
  }
}

function resolveDefaultTabs(navigation) {
  if (navigation?.languages) {
    const defaultLanguage = navigation.languages.find((lang) => lang.default) ?? navigation.languages[0];
    return defaultLanguage?.tabs ?? [];
  }
  return navigation?.tabs ?? [];
}

function flattenPages(navigation) {
  const items = [];
  for (const tab of resolveDefaultTabs(navigation)) {
    for (const group of tab.groups ?? []) {
      if (group.pages) {
        flattenGroupPages(tab.tab, group.group, group.pages, items);
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
    lines.push(`**${item.summary}**: \`${item.service}\``);
    if (item.requestBody) {
      lines.push('');
      lines.push(' ```yaml');
      lines.push(item.requestBody.split('\n').map((line) => ` ${line}`).join('\n'));
      lines.push(' ```');
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

function buildServicesCatalog(openApiServices, lang = 'pt') {
  return openApiServices
    .slice()
    .sort((a, b) => a.summary.localeCompare(b.summary))
    .map((item) => {
      const category = serviceCategory(item.summary, item.service);
      return {
        service: item.service,
        documentedAlias: item.service,
        name: item.summary.replace(/^(PF|PJ)\s+-\s+/i, ''),
        category,
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
        documentationUrl: apiReferenceServiceUrl(item, category, lang),
        guideUrl: guideUrlForCategory(category, lang),
        apiReferenceSection: item.summary,
        searchTerms: buildSearchTerms(item, lang),
        responseSummary: serviceResponseSummary({
          name: item.summary.replace(/^(PF|PJ)\s+-\s+/i, ''),
          service: item.service,
          category,
        }, lang),
      };
    });
}

const additionalPublicApiServices = [
  ['SERVICE_ACTIVITIES_INDICATORS', 'Indicadores de atividades', 'Pessoa Física', { service: 'SERVICE_ACTIVITIES_INDICATORS', cpf: 'cpf' }],
  ['SERVICE_ACTIVE_DEBT_PF', 'Débitos ativos PF', 'Pessoa Física', { service: 'SERVICE_ACTIVE_DEBT_PF', cpf: 'cpf' }],
  ['SERVICE_ADDRESS', 'Endereços', 'Pessoa Física', { service: 'SERVICE_ADDRESS', cpf: 'cpf' }],
  ['SERVICE_AWARDS_AND_CERTIFICATIONS_CPF', 'Prêmios e certificações PF', 'Pessoa Física', { service: 'SERVICE_AWARDS_AND_CERTIFICATIONS_CPF', cpf: 'cpf' }],
  ['SERVICE_CREDIT_SCORE', 'Score de crédito', 'Pessoa Física', { service: 'SERVICE_CREDIT_SCORE', cpf: 'cpf' }],
  ['SERVICE_CPF_ADDRESS_VALIDATION', 'Validação de CPF com endereço', 'Pessoa Física', { service: 'SERVICE_CPF_ADDRESS_VALIDATION', cpf: 'cpf', zipcode: '00000-000', numberAddress: 13 }],
  ['SERVICE_CPF_PHONE_VALIDATION', 'Validação de CPF com telefone', 'Pessoa Física', { service: 'SERVICE_CPF_PHONE_VALIDATION', cpf: 'cpf', phone: '11900000000' }],
  ['SERVICE_CONFIRM_PHONE', 'Obtenção de dados pelo telefone', 'Pessoa Física', { service: 'SERVICE_CONFIRM_PHONE', phone: '+5561123456789' }],
  ['SERVICE_CRIMINAL_RECORD_CIVIL', 'Antecedentes criminais civis', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_CIVIL', cpf: 'cpf', rg: 'rg', uf: 'uf' }],
  ['SERVICE_CRIMINAL_RECORD_FEDERAL', 'Antecedentes criminais federais', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_FEDERAL', cpf: 'cpf' }],
  ['SERVICE_DEFAULT_RISK_SCORE', 'Score de inadimpl\u00eancia', 'Pessoa Física', { service: 'SERVICE_DEFAULT_RISK_SCORE', cpf: 'cpf' }],
  ['SERVICE_DEMOGRAPHIC_DATA_CPF', 'Dados sociodemográficos PF', 'Pessoa Física', { service: 'SERVICE_DEMOGRAPHIC_DATA_CPF', cpf: 'cpf', birthDate: 'yyyy-MM-dd (opcional)' }],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY', 'Documentoscopia digital', 'Pessoa Física', { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY', key: '{key}', image1: 'base64', image2: 'base64', selfie1: 'base64' }],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT', 'Consulta da documentoscopia digital', 'Pessoa Física', { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT', key: '{key}' }],
  ['SERVICE_DOMAINS_CPF', 'Domínios PF', 'Pessoa Física', { service: 'SERVICE_DOMAINS_CPF', cpf: 'cpf' }],
  ['SERVICE_ECONOMIC_RELATIONSHIP', 'Relacionamentos econômicos', 'Pessoa Física', { service: 'SERVICE_ECONOMIC_RELATIONSHIP', cpf: 'cpf' }],
  ['SERVICE_ELECTION_CANDIDATE_DATA_CPF', 'Dados eleitorais de candidato PF', 'Pessoa Física', { service: 'SERVICE_ELECTION_CANDIDATE_DATA_CPF', cpf: 'cpf' }],
  ['SERVICE_ELECTORAL_DONORS_CPF', 'Doações eleitorais PF', 'Pessoa Física', { service: 'SERVICE_ELECTORAL_DONORS_CPF', cpf: 'cpf' }],
  ['SERVICE_ELECTORAL_PROVIDERS_CPF', 'Prestadores de serviços eleitorais PF', 'Pessoa Física', { service: 'SERVICE_ELECTORAL_PROVIDERS_CPF', cpf: 'cpf' }],
  ['SERVICE_EMAILS_EXTENDED', 'Histórico de e-mails', 'Pessoa Física', { service: 'SERVICE_EMAILS_EXTENDED', cpf: 'cpf' }],
  ['SERVICE_EMAIL_VALIDATION', 'Validação de e-mail', 'Pessoa Física', { service: 'SERVICE_EMAIL_VALIDATION', email: 'email@email.com' }],
  ['SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION', 'Qualificação cadastral no eSocial', 'Pessoa Física', { service: 'SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION', cpf: 'cpf', nit: 'nit (opcional)' }],
  ['SERVICE_FACE_INDEX', 'Busca de face na base', 'Pessoa Física', { service: 'SERVICE_FACE_INDEX', cpf: 'cpf (opcional para busca)', image1: 'base64' }],
  ['SERVICE_FACE_MATCH', 'FaceMatch', 'Pessoa Física', { service: 'SERVICE_FACE_MATCH', image1: 'base64', image2: 'base64' }],
  ['SERVICE_FAMILY_SOCIAL_BENEFITS', 'Benefícios sociais familiares', 'Pessoa Física', { service: 'SERVICE_FAMILY_SOCIAL_BENEFITS', cpf: 'cpf' }],
  ['SERVICE_FAMILY_POLITICAL_HISTORY_CPF', 'Histórico político familiar PF', 'Pessoa Física', { service: 'SERVICE_FAMILY_POLITICAL_HISTORY_CPF', cpf: 'cpf' }],
  ['SERVICE_FINANCIAL_INFORMATION', 'Informações financeiras', 'Pessoa Física', { service: 'SERVICE_FINANCIAL_INFORMATION', cpf: 'cpf' }],
  ['SERVICE_FRAUD_RISK_SCORE', 'Score de risco de fraude', 'Pessoa Física', { service: 'SERVICE_FRAUD_RISK_SCORE', cpf: 'cpf', factor: 'minRisk or minattrition' }],
  ['SERVICE_JURIDICAL_PROCESSES', 'Processos jurídicos e administrativos', 'Pessoa Física', { service: 'SERVICE_JURIDICAL_PROCESSES', cpf: 'cpf' }],
  ['SERVICE_MEDIA_PROFILE_EXPOSURE_PF', 'Exposição e perfil na mídia PF', 'Pessoa Física', { service: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PF', cpf: 'cpf' }],
  ['SERVICE_MEI', 'Consulta de MEI', 'Pessoa Física', { service: 'SERVICE_MEI', cpf: 'cpf' }],
  ['SERVICE_NOTHING_RECORD_LAWSUITS', 'Nada consta de ações judiciais', 'Pessoa Física', { service: 'SERVICE_NOTHING_RECORD_LAWSUITS', cpf: 'cpf', court: 'TRF1', uf: 'uf', sphere: 'CIVIL' }],
  ['SERVICE_OCR', 'OCR React', 'Pessoa Física', { service: 'SERVICE_OCR', documentType: 'RG, CNH, OAB, RNE, PASSAPORT ou IDENTIFICATION_DOCUMENT', image1: 'base64', image2: 'base64 (obrigatorio para documentos com frente e verso; opcional para identificacao automatica)' }],
  ['SERVICE_OCR_EMANCIPATION', 'OCR de documento de emancipação', 'Pessoa Física', { service: 'SERVICE_OCR_EMANCIPATION', image1: 'base64' }],
  ['SERVICE_OCR_PROOF_OF_ADDRESS', 'OCR de comprovante de endereço', 'Pessoa Física', { service: 'SERVICE_OCR_PROOF_OF_ADDRESS', image1: 'base64' }],
  ['SERVICE_PEP', 'Pessoa politicamente exposta', 'Pessoa Física', { service: 'SERVICE_PEP', cpf: 'cpf' }],
  ['SERVICE_PERSON_DATA_ENRICHMENT', 'Enriquecimento de dados PF', 'Pessoa Física', { service: 'SERVICE_PERSON_DATA_ENRICHMENT', cpf: 'cpf' }],
  ['SERVICE_PHONE_HISTORY', 'Histórico de telefones', 'Pessoa Física', { service: 'SERVICE_PHONE_HISTORY', cpf: 'cpf' }],
  ['SERVICE_PIS_CONSULTATION', 'Consulta do PIS', 'Pessoa Física', { service: 'SERVICE_PIS_CONSULTATION', cpf: 'cpf' }],
  ['SERVICE_POLITICAL_INVOLVEMENT', 'Envolvimento político', 'Pessoa Física', { service: 'SERVICE_POLITICAL_INVOLVEMENT', cpf: 'cpf' }],
  ['SERVICE_POLITICAL_INVOLVEMENT_CPF', 'Envolvimento político PF', 'Pessoa Física', { service: 'SERVICE_POLITICAL_INVOLVEMENT_CPF', cpf: 'cpf' }],
  ['SERVICE_PROFESSIONAL_HISTORY', 'Histórico profissional', 'Pessoa Física', { service: 'SERVICE_PROFESSIONAL_HISTORY', cpf: 'cpf' }],
  ['SERVICE_PROTEST_CLEARANCE_CERTIFICATE', 'Certidão negativa de protesto', 'Pessoa Física', { service: 'SERVICE_PROTEST_CLEARANCE_CERTIFICATE', cpf: 'cpf' }],
  ['SERVICE_PROTEST_PF', 'Certidão negativa de protesto PF', 'Pessoa Física', { service: 'SERVICE_PROTEST_PF', cpf: 'cpf' }],
  ['SERVICE_PUBLIC_SERVANTS', 'Servidores públicos', 'Pessoa Física', { service: 'SERVICE_PUBLIC_SERVANTS', cpf: 'cpf' }],
  ['SERVICE_RELATED_PEOPLE', 'Pessoas relacionadas', 'Pessoa Física', { service: 'SERVICE_RELATED_PEOPLE', cpf: 'cpf' }],
  ['SERVICE_RFB_PF', 'CPF na Receita Federal', 'Pessoa Física', { service: 'SERVICE_RFB_PF', cpf: 'cpf', birthDate: 'yyyy-MM-dd (opcional)' }],
  ['SERVICE_SOCIAL_ASSISTANCE_EXTENDED', 'Benefícios sociais estendidos PF', 'Pessoa Física', { service: 'SERVICE_SOCIAL_ASSISTANCE_EXTENDED', cpf: 'cpf' }],
  ['SERVICE_ACTIVE_DEBT_PJ', 'Débitos ativos PJ', 'Pessoa Jurídica', { service: 'SERVICE_ACTIVE_DEBT_PJ', cnpj: 'cnpj' }],
  ['SERVICE_ADDRESSES_EXTENDED_CNPJ', 'Endereços estendidos CNPJ', 'Pessoa Jurídica', { service: 'SERVICE_ADDRESSES_EXTENDED_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_KYC_OWNERS', 'KYC e compliance dos sócios', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_KYC_OWNERS', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RELATIONSHIP', 'Relacionamentos de empresa', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RELATIONSHIP', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RFB_OWNERS', 'Sócios na Receita Federal', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RFB_OWNERS', cnpj: 'cnpj' }],
  ['SERVICE_COMPLIANCE_BET', 'Compliance de casas de apostas (alias curto)', 'Pessoa Jurídica', { service: 'SERVICE_COMPLIANCE_BET', cnpj: 'cnpj' }],
  ['SERVICE_COMPLIANCE_BET_PJ', 'Compliance de casas de apostas PJ', 'Pessoa Jurídica', { service: 'SERVICE_COMPLIANCE_BET_PJ', cnpj: 'cnpj' }],
  ['SERVICE_CORPORATE_DATA_ENRICHMENT', 'Enriquecimento de dados PJ', 'Pessoa Jurídica', { service: 'SERVICE_CORPORATE_DATA_ENRICHMENT', cnpj: 'cnpj' }],
  ['SERVICE_CREDIT_RISK_COMPANY', 'Risco de crédito PJ', 'Pessoa Jurídica', { service: 'SERVICE_CREDIT_RISK_COMPANY', cnpj: 'cnpj' }],
  ['SERVICE_DAS_MEI', 'DAS MEI na Receita', 'Pessoa Jurídica', { service: 'SERVICE_DAS_MEI', cnpj: 'cnpj' }],
  ['SERVICE_DOMAINS_CNPJ', 'Domínios CNPJ', 'Pessoa Jurídica', { service: 'SERVICE_DOMAINS_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_ELECTORAL_DONORS_CNPJ', 'Doações eleitorais PJ', 'Pessoa Jurídica', { service: 'SERVICE_ELECTORAL_DONORS_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_ELECTORAL_PROVIDERS_CNPJ', 'Fornecedores eleitorais PJ', 'Pessoa Jurídica', { service: 'SERVICE_ELECTORAL_PROVIDERS_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_FIRST_LEVEL_PARTNER', 'Sócios de primeiro nível', 'Pessoa Jurídica', { service: 'SERVICE_FIRST_LEVEL_PARTNER', cnpj: 'cnpj' }],
  ['SERVICE_JURIDICAL_PROCESSES_PJ', 'Processos jurídicos PJ', 'Pessoa Jurídica', { service: 'SERVICE_JURIDICAL_PROCESSES_PJ', cnpj: 'cnpj' }],
  ['SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS', 'Processos jurídicos dos sócios', 'Pessoa Jurídica', { service: 'SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS', cnpj: 'cnpj' }],
  ['SERVICE_MEDIA_PROFILE_EXPOSURE_PJ', 'Exposição e perfil na mídia PJ', 'Pessoa Jurídica', { service: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PJ', cnpj: 'cnpj' }],
  ['SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ', 'Doações eleitorais dos sócios', 'Pessoa Jurídica', { service: 'SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_PROTEST_PJ', 'Certidão negativa de protesto PJ', 'Pessoa Jurídica', { service: 'SERVICE_PROTEST_PJ', cnpj: 'cnpj' }],
  ['SERVICE_OCR_CNPJ_CARD', 'OCR de cartão CNPJ', 'Pessoa Jurídica', { service: 'SERVICE_OCR_CNPJ_CARD', image1: 'base64' }],
  ['SERVICE_REGISTRATION_DATA_CNPJ', 'Dados cadastrais de CNPJ', 'Pessoa Jurídica', { service: 'SERVICE_REGISTRATION_DATA_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_RFB_PJ', 'CNPJ na Receita Federal', 'Pessoa Jurídica', { service: 'SERVICE_RFB_PJ', cnpj: 'cnpj' }],
  ['SERVICE_SINTEGRA_CONSULTATION', 'Consulta do SINTEGRA', 'Pessoa Jurídica', { service: 'SERVICE_SINTEGRA_CONSULTATION', cnpj: 'cnpj', uf: 'uf (opcional)' }],
];

const additionalPublicApiServicesEn = [
  ['SERVICE_ACTIVITIES_INDICATORS', 'Activity indicators', 'Pessoa Física', { service: 'SERVICE_ACTIVITIES_INDICATORS', cpf: 'cpf' }],
  ['SERVICE_ACTIVE_DEBT_PF', 'Active debts (individual)', 'Pessoa Física', { service: 'SERVICE_ACTIVE_DEBT_PF', cpf: 'cpf' }],
  ['SERVICE_ADDRESS', 'Addresses', 'Pessoa Física', { service: 'SERVICE_ADDRESS', cpf: 'cpf' }],
  ['SERVICE_AWARDS_AND_CERTIFICATIONS_CPF', 'Awards and certifications (individual)', 'Pessoa Física', { service: 'SERVICE_AWARDS_AND_CERTIFICATIONS_CPF', cpf: 'cpf' }],
  ['SERVICE_CREDIT_SCORE', 'Credit score', 'Pessoa Física', { service: 'SERVICE_CREDIT_SCORE', cpf: 'cpf' }],
  ['SERVICE_CPF_ADDRESS_VALIDATION', 'CPF validation with address', 'Pessoa Física', { service: 'SERVICE_CPF_ADDRESS_VALIDATION', cpf: 'cpf', zipcode: '00000-000', numberAddress: 13 }],
  ['SERVICE_CPF_PHONE_VALIDATION', 'CPF validation with phone', 'Pessoa Física', { service: 'SERVICE_CPF_PHONE_VALIDATION', cpf: 'cpf', phone: '11900000000' }],
  ['SERVICE_CONFIRM_PHONE', 'Data lookup by phone number', 'Pessoa Física', { service: 'SERVICE_CONFIRM_PHONE', phone: '+5561123456789' }],
  ['SERVICE_CRIMINAL_RECORD_CIVIL', 'Civil criminal record', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_CIVIL', cpf: 'cpf', rg: 'rg', uf: 'uf' }],
  ['SERVICE_CRIMINAL_RECORD_FEDERAL', 'Federal criminal record', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_FEDERAL', cpf: 'cpf' }],
  ['SERVICE_DEFAULT_RISK_SCORE', 'Default risk score', 'Pessoa Física', { service: 'SERVICE_DEFAULT_RISK_SCORE', cpf: 'cpf' }],
  ['SERVICE_DEMOGRAPHIC_DATA_CPF', 'Sociodemographic data (individual)', 'Pessoa Física', { service: 'SERVICE_DEMOGRAPHIC_DATA_CPF', cpf: 'cpf', birthDate: 'yyyy-MM-dd (opcional)' }],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY', 'Digital documentoscopy', 'Pessoa Física', { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY', key: '{key}', image1: 'base64', image2: 'base64', selfie1: 'base64' }],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT', 'Digital documentoscopy lookup', 'Pessoa Física', { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT', key: '{key}' }],
  ['SERVICE_DOMAINS_CPF', 'Domains (individual)', 'Pessoa Física', { service: 'SERVICE_DOMAINS_CPF', cpf: 'cpf' }],
  ['SERVICE_ECONOMIC_RELATIONSHIP', 'Economic relationships', 'Pessoa Física', { service: 'SERVICE_ECONOMIC_RELATIONSHIP', cpf: 'cpf' }],
  ['SERVICE_ELECTION_CANDIDATE_DATA_CPF', 'Electoral candidate data (individual)', 'Pessoa Física', { service: 'SERVICE_ELECTION_CANDIDATE_DATA_CPF', cpf: 'cpf' }],
  ['SERVICE_ELECTORAL_DONORS_CPF', 'Electoral donations (individual)', 'Pessoa Física', { service: 'SERVICE_ELECTORAL_DONORS_CPF', cpf: 'cpf' }],
  ['SERVICE_ELECTORAL_PROVIDERS_CPF', 'Electoral service providers (individual)', 'Pessoa Física', { service: 'SERVICE_ELECTORAL_PROVIDERS_CPF', cpf: 'cpf' }],
  ['SERVICE_EMAILS_EXTENDED', 'Email history', 'Pessoa Física', { service: 'SERVICE_EMAILS_EXTENDED', cpf: 'cpf' }],
  ['SERVICE_EMAIL_VALIDATION', 'Email validation', 'Pessoa Física', { service: 'SERVICE_EMAIL_VALIDATION', email: 'email@email.com' }],
  ['SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION', 'eSocial registration qualification', 'Pessoa Física', { service: 'SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION', cpf: 'cpf', nit: 'nit (opcional)' }],
  ['SERVICE_FACE_INDEX', 'Face search in database', 'Pessoa Física', { service: 'SERVICE_FACE_INDEX', cpf: 'cpf (opcional para busca)', image1: 'base64' }],
  ['SERVICE_FACE_MATCH', 'FaceMatch', 'Pessoa Física', { service: 'SERVICE_FACE_MATCH', image1: 'base64', image2: 'base64' }],
  ['SERVICE_FAMILY_SOCIAL_BENEFITS', 'Family social benefits', 'Pessoa Física', { service: 'SERVICE_FAMILY_SOCIAL_BENEFITS', cpf: 'cpf' }],
  ['SERVICE_FAMILY_POLITICAL_HISTORY_CPF', 'Family political history (individual)', 'Pessoa Física', { service: 'SERVICE_FAMILY_POLITICAL_HISTORY_CPF', cpf: 'cpf' }],
  ['SERVICE_FINANCIAL_INFORMATION', 'Financial information', 'Pessoa Física', { service: 'SERVICE_FINANCIAL_INFORMATION', cpf: 'cpf' }],
  ['SERVICE_FRAUD_RISK_SCORE', 'Fraud risk score', 'Pessoa Física', { service: 'SERVICE_FRAUD_RISK_SCORE', cpf: 'cpf', factor: 'minRisk or minattrition' }],
  ['SERVICE_JURIDICAL_PROCESSES', 'Legal and administrative proceedings', 'Pessoa Física', { service: 'SERVICE_JURIDICAL_PROCESSES', cpf: 'cpf' }],
  ['SERVICE_MEDIA_PROFILE_EXPOSURE_PF', 'Media exposure and profile (individual)', 'Pessoa Física', { service: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PF', cpf: 'cpf' }],
  ['SERVICE_MEI', 'MEI lookup', 'Pessoa Física', { service: 'SERVICE_MEI', cpf: 'cpf' }],
  ['SERVICE_NOTHING_RECORD_LAWSUITS', 'Clean lawsuit record certificate', 'Pessoa Física', { service: 'SERVICE_NOTHING_RECORD_LAWSUITS', cpf: 'cpf', court: 'TRF1', uf: 'uf', sphere: 'CIVIL' }],
  ['SERVICE_OCR', 'OCR React', 'Pessoa Física', { service: 'SERVICE_OCR', documentType: 'RG, CNH, OAB, RNE, PASSAPORT ou IDENTIFICATION_DOCUMENT', image1: 'base64', image2: 'base64 (obrigatorio para documentos com frente e verso; opcional para identificacao automatica)' }],
  ['SERVICE_OCR_EMANCIPATION', 'OCR of emancipation document', 'Pessoa Física', { service: 'SERVICE_OCR_EMANCIPATION', image1: 'base64' }],
  ['SERVICE_OCR_PROOF_OF_ADDRESS', 'OCR of proof of address', 'Pessoa Física', { service: 'SERVICE_OCR_PROOF_OF_ADDRESS', image1: 'base64' }],
  ['SERVICE_PEP', 'Politically exposed person', 'Pessoa Física', { service: 'SERVICE_PEP', cpf: 'cpf' }],
  ['SERVICE_PERSON_DATA_ENRICHMENT', 'Data enrichment (individual)', 'Pessoa Física', { service: 'SERVICE_PERSON_DATA_ENRICHMENT', cpf: 'cpf' }],
  ['SERVICE_PHONE_HISTORY', 'Phone history', 'Pessoa Física', { service: 'SERVICE_PHONE_HISTORY', cpf: 'cpf' }],
  ['SERVICE_PIS_CONSULTATION', 'PIS lookup', 'Pessoa Física', { service: 'SERVICE_PIS_CONSULTATION', cpf: 'cpf' }],
  ['SERVICE_POLITICAL_INVOLVEMENT', 'Political involvement', 'Pessoa Física', { service: 'SERVICE_POLITICAL_INVOLVEMENT', cpf: 'cpf' }],
  ['SERVICE_POLITICAL_INVOLVEMENT_CPF', 'Political involvement (individual)', 'Pessoa Física', { service: 'SERVICE_POLITICAL_INVOLVEMENT_CPF', cpf: 'cpf' }],
  ['SERVICE_PROFESSIONAL_HISTORY', 'Professional history', 'Pessoa Física', { service: 'SERVICE_PROFESSIONAL_HISTORY', cpf: 'cpf' }],
  ['SERVICE_PROTEST_CLEARANCE_CERTIFICATE', 'Protest clearance certificate', 'Pessoa Física', { service: 'SERVICE_PROTEST_CLEARANCE_CERTIFICATE', cpf: 'cpf' }],
  ['SERVICE_PROTEST_PF', 'Protest clearance certificate (individual)', 'Pessoa Física', { service: 'SERVICE_PROTEST_PF', cpf: 'cpf' }],
  ['SERVICE_PUBLIC_SERVANTS', 'Public servants', 'Pessoa Física', { service: 'SERVICE_PUBLIC_SERVANTS', cpf: 'cpf' }],
  ['SERVICE_RELATED_PEOPLE', 'Related people', 'Pessoa Física', { service: 'SERVICE_RELATED_PEOPLE', cpf: 'cpf' }],
  ['SERVICE_RFB_PF', 'CPF at the Federal Revenue', 'Pessoa Física', { service: 'SERVICE_RFB_PF', cpf: 'cpf', birthDate: 'yyyy-MM-dd (opcional)' }],
  ['SERVICE_SOCIAL_ASSISTANCE_EXTENDED', 'Extended social benefits (individual)', 'Pessoa Física', { service: 'SERVICE_SOCIAL_ASSISTANCE_EXTENDED', cpf: 'cpf' }],
  ['SERVICE_ACTIVE_DEBT_PJ', 'Active debts (business)', 'Pessoa Jurídica', { service: 'SERVICE_ACTIVE_DEBT_PJ', cnpj: 'cnpj' }],
  ['SERVICE_ADDRESSES_EXTENDED_CNPJ', 'Extended addresses (CNPJ)', 'Pessoa Jurídica', { service: 'SERVICE_ADDRESSES_EXTENDED_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_KYC_OWNERS', 'KYC and compliance of the partners', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_KYC_OWNERS', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RELATIONSHIP', 'Company relationships', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RELATIONSHIP', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RFB_OWNERS', 'Partners at the Federal Revenue', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RFB_OWNERS', cnpj: 'cnpj' }],
  ['SERVICE_COMPLIANCE_BET', 'Betting house compliance (short alias)', 'Pessoa Jurídica', { service: 'SERVICE_COMPLIANCE_BET', cnpj: 'cnpj' }],
  ['SERVICE_COMPLIANCE_BET_PJ', 'Betting house compliance (business)', 'Pessoa Jurídica', { service: 'SERVICE_COMPLIANCE_BET_PJ', cnpj: 'cnpj' }],
  ['SERVICE_CORPORATE_DATA_ENRICHMENT', 'Data enrichment (business)', 'Pessoa Jurídica', { service: 'SERVICE_CORPORATE_DATA_ENRICHMENT', cnpj: 'cnpj' }],
  ['SERVICE_CREDIT_RISK_COMPANY', 'Credit risk (business)', 'Pessoa Jurídica', { service: 'SERVICE_CREDIT_RISK_COMPANY', cnpj: 'cnpj' }],
  ['SERVICE_DAS_MEI', 'MEI DAS at the Federal Revenue', 'Pessoa Jurídica', { service: 'SERVICE_DAS_MEI', cnpj: 'cnpj' }],
  ['SERVICE_DOMAINS_CNPJ', 'Domains (CNPJ)', 'Pessoa Jurídica', { service: 'SERVICE_DOMAINS_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_ELECTORAL_DONORS_CNPJ', 'Electoral donations (business)', 'Pessoa Jurídica', { service: 'SERVICE_ELECTORAL_DONORS_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_ELECTORAL_PROVIDERS_CNPJ', 'Electoral suppliers (business)', 'Pessoa Jurídica', { service: 'SERVICE_ELECTORAL_PROVIDERS_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_FIRST_LEVEL_PARTNER', 'First-level partners', 'Pessoa Jurídica', { service: 'SERVICE_FIRST_LEVEL_PARTNER', cnpj: 'cnpj' }],
  ['SERVICE_JURIDICAL_PROCESSES_PJ', 'Legal proceedings (business)', 'Pessoa Jurídica', { service: 'SERVICE_JURIDICAL_PROCESSES_PJ', cnpj: 'cnpj' }],
  ['SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS', 'Legal proceedings of the partners', 'Pessoa Jurídica', { service: 'SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS', cnpj: 'cnpj' }],
  ['SERVICE_MEDIA_PROFILE_EXPOSURE_PJ', 'Media exposure and profile (business)', 'Pessoa Jurídica', { service: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PJ', cnpj: 'cnpj' }],
  ['SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ', 'Electoral donations of the partners', 'Pessoa Jurídica', { service: 'SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_PROTEST_PJ', 'Protest clearance certificate (business)', 'Pessoa Jurídica', { service: 'SERVICE_PROTEST_PJ', cnpj: 'cnpj' }],
  ['SERVICE_OCR_CNPJ_CARD', 'OCR of CNPJ card', 'Pessoa Jurídica', { service: 'SERVICE_OCR_CNPJ_CARD', image1: 'base64' }],
  ['SERVICE_REGISTRATION_DATA_CNPJ', 'CNPJ registration data', 'Pessoa Jurídica', { service: 'SERVICE_REGISTRATION_DATA_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_RFB_PJ', 'CNPJ at the Federal Revenue', 'Pessoa Jurídica', { service: 'SERVICE_RFB_PJ', cnpj: 'cnpj' }],
  ['SERVICE_SINTEGRA_CONSULTATION', 'SINTEGRA lookup', 'Pessoa Jurídica', { service: 'SERVICE_SINTEGRA_CONSULTATION', cnpj: 'cnpj', uf: 'uf (opcional)' }],
];

function requestExampleFromBody(body) {
  return Object.entries(body).map(([key, value]) => `${key}: ${value}`).join('\n');
}

function mergeAdditionalPublicApiServices(catalog, lang = 'pt') {
  const seen = new Set(catalog.map((service) => service.service));
  const extras = [];
  const sourceList = lang === 'en' ? additionalPublicApiServicesEn : additionalPublicApiServices;

  for (const [service, name, category, body] of sourceList) {
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
      documentationUrl: apiReferenceServiceUrl(item, category, lang),
      guideUrl: guideUrlForCategory(category, lang),
      apiReferenceSection: item.summary,
      searchTerms: buildSearchTerms(item, lang),
      responseSummary: serviceResponseSummary({ name, service, category }, lang),
    });
  }

  return [...catalog, ...extras].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function aliasRowsForService(service) {
  const serviceAlias = service.service;
  return serviceAliasRows.filter(([documentedAlias, callingAlias]) => (
    serviceAlias === callingAlias || documentedAlias.split(', ').includes(serviceAlias)
  ));
}

function callingAliasForService(service) {
  return aliasRowsForService(service)[0]?.[1] || service.service;
}

function servicesForService(service) {
  const aliases = aliasRowsForService(service)
    .flatMap(([documentedAlias]) => documentedAlias.split(', '))
    .filter((alias) => alias !== service.service);

  return [...new Set(aliases)];
}

function optionalRequestFields(service) {
  return service.requestExample
    .split(/\r?\n/)
    .filter((line) => /\bopcional\b/i.test(line))
    .map((line) => line.match(/^\s*([A-Za-z0-9_]+):/)?.[1])
    .filter(Boolean)
    .filter((field) => field !== 'service');
}

function requiredRequestFields(service) {
  const optional = new Set(optionalRequestFields(service));
  return service.requestFields.filter((field) => !optional.has(field));
}

function payloadExampleForService(service) {
  return jsonBodyFromRequestExample(service.requestExample);
}

function addTag(tags, condition, tag) {
  if (condition) tags.add(tag);
}

function serviceTags(service) {
  const tags = new Set();
  const fields = service.requestFields || [];
  const searchable = normalizeText([
    service.service,
    service.documentedAlias,
    service.name,
    service.category,
    service.responseSummary,
    fields.join(' '),
    ...(service.searchTerms || []),
  ].join(' '));

  addTag(tags, fields.includes('cpf') || /\bcpf\b/.test(searchable), 'cpf');
  addTag(tags, fields.includes('cnpj') || /\bcnpj\b/.test(searchable), 'cnpj');
  addTag(tags, /ocr|image|base64|documento|comprovante|emancipacao/.test(searchable), 'imagem');
  addTag(tags, /ocr/.test(searchable), 'ocr');
  addTag(tags, /rg/.test(searchable), 'rg');
  addTag(tags, /cnh/.test(searchable), 'cnh');
  addTag(tags, /cartao cnpj|cartao-cnpj/.test(searchable), 'cartao-cnpj');
  addTag(tags, /comprovante|endereco/.test(searchable), 'comprovante-endereco');
  addTag(tags, /face|selfie|biometria/.test(searchable), 'face');
  addTag(tags, /textract/.test(searchable), 'textract');
  addTag(tags, /react/.test(searchable), 'react');
  addTag(tags, /assertiva/.test(searchable), 'assertiva');
  addTag(tags, /quantum/.test(searchable), 'quantum');
  addTag(tags, /murabei/.test(searchable), 'murabei');
  addTag(tags, /credito|score|risco|inadimplencia/.test(searchable), 'risco-credito');
  addTag(tags, /juridic|processos|antecedentes|protesto/.test(searchable), 'juridico');
  addTag(tags, /compliance|bet/.test(searchable), 'compliance');
  addTag(tags, /beneficios|social/.test(searchable), 'beneficios-sociais');
  addTag(tags, /dominios/.test(searchable), 'dominios');
  addTag(tags, /receita|rfb|cadastrais|cadastral/.test(searchable), 'cadastral');
  addTag(tags, /telefone|email|contato/.test(searchable), 'contato');

  return [...tags].sort();
}

function sampleResultForService(service) {
  const tags = new Set(serviceTags(service));
  const result = {};
  const fields = new Set(service.requestFields || []);

  if (fields.has('cpf') || tags.has('cpf')) result.cpf = '00000000000';
  if (fields.has('cnpj') || tags.has('cnpj')) result.cnpj = '00000000000000';

  if (service.service === 'SERVICE_FACE_INDEX') {
    return { faceFound: true, similarity: 99.9, cpf: '00000000000' };
  }

  if (service.service === 'SERVICE_OCR') {
    return { docType: 'CNH', cpf: '00000000000', name: 'NOME DO CLIENTE' };
  }

  if (service.service === 'SERVICE_OCR_CNPJ_CARD') {
    return { cnpj: '00000000000000', docType: 'CNPJ_CARD', genericOcr: 'texto extraído do cartão CNPJ' };
  }

  if (service.service === 'SERVICE_OCR_PROOF_OF_ADDRESS') {
    return { docType: 'COMPROVANTE_ENDERECO', fullAddress: 'Endereço extraído do comprovante', genericOcr: 'texto extraído do comprovante' };
  }

  if (service.service === 'SERVICE_OCR_EMANCIPATION') {
    return { docType: 'EMANCIPATION_DOCUMENT', genericOcr: 'texto extraído do documento' };
  }

  if (service.service === 'SERVICE_CREDIT_RISK_COMPANY') {
    return {
      cnpj: '00000000000000',
      creditRisk: {
        score: '000',
        rating: 'A',
        expectedDefault: '0.00',
        legalProcess: false,
      },
    };
  }

  if (service.service === 'SERVICE_CREDIT_SCORE') {
    return { cpf: '00000000000', score: '000', riskLevel: 'BAIXO' };
  }

  return Object.keys(result).length ? result : { message: service.responseSummary };
}

function successResponseExampleForService(service) {
  return {
    result: sampleResultForService(service),
    status: {
      code: 200,
      message: 'Consulta realizada com sucesso',
    },
    onboardingStatus: 'APPROVED',
    externalId: '{externalId}',
  };
}

function commonErrorsForService(service) {
  const tags = new Set(serviceTags(service));
  const errors = [
    {
      statusCode: 400,
      message: "Don't have access to the service",
      cause: 'Produto sem service ativo/API habilitada ou alias de chamada incorreto.',
      action: 'Conferir produto, alias configurado e flag de API antes de testar de novo.',
    },
  ];

  if (tags.has('imagem') || tags.has('face')) {
    errors.push({
      statusCode: 400,
      message: 'Imagem obrigatória não encontrada',
      cause: 'Payload sem `image1`, `image2`, `selfie1`, URL ou `key` esperado pelo service.',
      action: 'Enviar base64 puro, URL válida ou key existente conforme o guia do service.',
    });
  }

  if (tags.has('ocr')) {
    errors.push({
      statusCode: 400,
      message: 'Não foi possível ler o documento',
      cause: 'Imagem ilegível, documento errado ou campo principal não encontrado no OCR.',
      action: 'Testar imagem nítida, documento correto e payload mínimo indicado na documentação.',
    });
  }

  if (tags.has('face')) {
    errors.push({
      statusCode: 400,
      message: 'Face nao encontrada na base',
      cause: 'Selfie nao teve correspondencia na base de faces ou nao foi possivel detectar rosto.',
      action: 'Usar selfie real, frontal e nítida. Não usar foto de documento.',
    });
  }

  errors.push({
    statusCode: 500,
    message: 'Falha ao realizar consulta',
    cause: 'Falha t\u00e9cnica no processamento ou storage.',
    action: 'Investigar com `externalId`, horario, ambiente e service chamado.',
  });

  return errors;
}

function curlExamplesForService(service, exampleFiles) {
  const fileByService = [
    ['SERVICE_OCR', ['service-api-ocr-cnh.hml.curl', 'service-api-ocr-rg.hml.curl']],
    ['SERVICE_OCR_CNPJ_CARD', ['service-api-ocr-cnpj-card.hml.curl']],
    ['SERVICE_OCR_PROOF_OF_ADDRESS', ['service-api-ocr-proof-of-address.hml.curl']],
    ['SERVICE_FACE_INDEX', ['service-api-face-index.hml.curl']],
    ['SERVICE_CREDIT_RISK_COMPANY', ['service-api-credit-risk-company.hml.curl']],
    ['SERVICE_CREDIT_SCORE', ['service-api-credit-score.hml.curl']],
  ].find(([alias]) => alias === service.service)?.[1];

  const fallbackFiles = [];
  if (!fileByService && service.requestFields?.includes('cpf')) fallbackFiles.push('service-api-cpf.hml.curl');
  if (!fileByService && service.requestFields?.includes('cnpj')) fallbackFiles.push('service-api-cnpj.hml.curl');

  const wanted = fileByService || fallbackFiles;
  return exampleFiles.filter((example) => wanted.includes(example.file)).map((example) => example.url);
}

function mcpHintsForService(service, curlExampleUrls) {
  const tags = new Set(serviceTags(service));
  const requiredFields = requiredRequestFields(service);
  const optionalFields = optionalRequestFields(service);
  const notes = [];

  if (tags.has('ocr')) {
    notes.push('Use imagem real e legível do documento. Base64 com ou sem prefixo data:image funciona.');
    notes.push('Se o OCR não extrair um campo, explique que o retorno depende da leitura da imagem e não invente valor.');
  }

  if (tags.has('face')) {
    notes.push('Use selfie real, frontal e nítida. Não use foto de RG, CNH ou print de documento.');
    notes.push('Face Index busca correspondência na base de faces; isso não é validação definitiva de identidade.');
  }

  if (tags.has('risco-credito')) {
    notes.push('Explique score, rating e risco apenas quando esses campos aparecerem no result.');
  }

  return {
    bestContext: 'llms-api-reference.txt',
    readBeforeAnswering: [
      'services-catalog.json',
      curlExampleUrls.length ? 'examples/*.curl' : null,
      'llms-api-reference.txt',
    ].filter(Boolean),
    useCurlExample: curlExampleUrls.length > 0,
    needsImage: tags.has('imagem') || tags.has('ocr') || tags.has('face'),
    needsRealDocument: tags.has('ocr'),
    needsSelfie: tags.has('face'),
    needsCpf: requiredFields.includes('cpf') || optionalFields.includes('cpf'),
    needsCnpj: requiredFields.includes('cnpj') || optionalFields.includes('cnpj'),
    publicResponseField: 'result',
    avoidFields: ['fieldsOutput', 'required', 'enabled', 'valid', 'callService', 'nextStep', 'services'],
    doNotDo: [
      'Não inventar payload, retorno ou service fora do catálogo.',
      'Não solicitar token, client, secret, CPF, CNPJ ou imagem real.',
      'Não chamar HML ou produção; usar apenas a documentação como fonte.',
    ],
    notes,
  };
}

function enrichServiceForMcp(service, exampleFiles) {
  const callingAlias = callingAliasForService(service);
  const services = servicesForService(service);
  const curlExampleUrls = curlExamplesForService(service, exampleFiles);

  const enriched = {
    ...service,
    callingAlias,
    services,
    requiredFields: requiredRequestFields(service),
    optionalFields: optionalRequestFields(service),
    payloadExample: payloadExampleForService(service),
    successResponseExample: successResponseExampleForService(service),
    commonErrors: commonErrorsForService(service),
    curlExampleUrls,
    mcpHints: mcpHintsForService(service, curlExampleUrls),
    tags: serviceTags(service),
  };
  if (curlExampleUrls[0]) enriched.curlExampleUrl = curlExampleUrls[0];
  return enriched;
}

function buildServicesCatalogMin(servicesCatalog) {
  return {
    generatedBy,
    artifactVersion,
    totalServices: servicesCatalog.length,
    services: servicesCatalog.map((service) => {
      const item = {
        service: service.service,
        name: service.name,
        callingAlias: service.callingAlias,
        services: service.services,
        category: service.category,
        tags: service.tags,
        requiredFields: service.requiredFields,
        optionalFields: service.optionalFields,
        documentationUrl: service.documentationUrl,
      };
      if (service.curlExampleUrl) item.curlExampleUrl = service.curlExampleUrl;
      return item;
    }),
  };
}

const activeServiceApiAliases = new Set([
  'SERVICE_ACTIVITIES_INDICATORS',
  'SERVICE_ACTIVE_DEBT_PF',
  'SERVICE_ACTIVE_DEBT_PJ',
  'SERVICE_ADDRESSES_EXTENDED_CNPJ',
  'SERVICE_ADDRESS',
  'SERVICE_ARREST_WARRANT',
  'SERVICE_AWARDS_AND_CERTIFICATIONS_CPF',
  'SERVICE_COMPANY_KYC_OWNERS',
  'SERVICE_COMPANY_RELATIONSHIP',
  'SERVICE_COMPANY_RFB_OWNERS',
  'SERVICE_COMPLIANCE_BET_PJ',
  'SERVICE_COMPLIANCE_BET',
  'SERVICE_CONFIRM_PHONE',
  'SERVICE_CORPORATE_DATA_ENRICHMENT',
  'SERVICE_CPF_ADDRESS_VALIDATION',
  'SERVICE_CPF_PHONE_VALIDATION',
  'SERVICE_CRIMINAL_RECORD_CIVIL',
  'SERVICE_CRIMINAL_RECORD_FEDERAL',
  'SERVICE_CREDIT_RISK_COMPANY',
  'SERVICE_CREDIT_SCORE',
  'SERVICE_DAS_MEI',
  'SERVICE_DATAVALID_CNH',
  'SERVICE_DEFAULT_RISK_SCORE',
  'SERVICE_DEMOGRAPHIC_DATA_CPF',
  'SERVICE_DIGITAL_DOCUMENTOSCOPY',
  'SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT',
  'SERVICE_DOMAINS_CNPJ',
  'SERVICE_DOMAINS_CPF',
  'SERVICE_ECONOMIC_RELATIONSHIP',
  'SERVICE_ELECTION_CANDIDATE_DATA_CPF',
  'SERVICE_ELECTORAL_DONORS_CNPJ',
  'SERVICE_ELECTORAL_DONORS_CPF',
  'SERVICE_ELECTORAL_PROVIDERS_CNPJ',
  'SERVICE_ELECTORAL_PROVIDERS_CPF',
  'SERVICE_EMAILS_EXTENDED',
  'SERVICE_EMAIL_VALIDATION',
  'SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION',
  'SERVICE_FACE_INDEX',
  'SERVICE_FACE_MATCH',
  'SERVICE_FAMILY_POLITICAL_HISTORY_CPF',
  'SERVICE_FAMILY_SOCIAL_BENEFITS',
  'SERVICE_FINANCIAL_INFORMATION',
  'SERVICE_FINANCIAL_RISK_SCORE',
  'SERVICE_FIRST_LEVEL_PARTNER',
  'SERVICE_FRAUD_RISK_SCORE',
  'SERVICE_JURIDICAL_PROCESSES',
  'SERVICE_JURIDICAL_PROCESSES_PJ',
  'SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS',
  'SERVICE_RELATED_PEOPLE_EMAILS',
  'SERVICE_RELATED_PEOPLE_PHONES',
  'SERVICE_RELATED_PEOPLE_ADDRESSES',
  'SERVICE_QUOD_CREDIT_SCORE_PERSON',
  'SERVICE_BOAVISTA_ONE_SCORE_PERSON',
  'SERVICE_BOAVISTA_CREDIT_SCORE_PERSON',
  'SERVICE_QUOD_CREDIT_RISK_PERSON',
  'SERVICE_ONDEMAND_TSE_POLLING_PLACE_PERSON_CPF',
  'SERVICE_ULTIMATE_BENEFICIAL_OWNERS',
  'SERVICE_PUBLIC_PROJECTS',
  'SERVICE_PGFN_COMPANY',
  'SERVICE_PCD_COMPANY',
  'SERVICE_CIVIL_CONSTRUCTION',
  'SERVICE_BOAVISTA_OWNER_PARTICIPATION_DATA_COMPANY',
  'SERVICE_QUANTUM_CUSTOM_SCORE_COMPANY',
  'SERVICE_CGU_NEGATIVE_CERTIFICATE_COMPANY',
  'SERVICE_CNJ_NEGATIVE_CERTIFICATE_COMPANY',
  'SERVICE_STATE_DEBT_CERTIFICATE_COMPANY',
  'SERVICE_SIMPLES_COMPANY',
  'SERVICE_ECONOMIC_GROUP_KYC_COMPANY',
  'SERVICE_MEDIA_PROFILE_EXPOSURE_PF',
  'SERVICE_MEDIA_PROFILE_EXPOSURE_PJ',
  'SERVICE_MEI',
  'SERVICE_NOTHING_RECORD_LAWSUITS',
  'SERVICE_OCR',
  'SERVICE_OCR_CNPJ_CARD',
  'SERVICE_OCR_EMANCIPATION',
  'SERVICE_OCR_PROOF_OF_ADDRESS',
  'SERVICE_ONDEMAND_SUS_CARD_PERSON_CPF',
  'SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ',
  'SERVICE_PEP',
  'SERVICE_PERSON_AI_PROMPT',
  'SERVICE_PERSON_DATA_ENRICHMENT',
  'SERVICE_PERSON_DATA_MODELING',
  'SERVICE_PERSON_KYC',
  'SERVICE_PF_FINANCIAL_AND_ADDRESS',
  'SERVICE_PHONE_HISTORY',
  'SERVICE_PIS_CONSULTATION',
  'SERVICE_POLITICAL_INVOLVEMENT',
  'SERVICE_POLITICAL_INVOLVEMENT_CPF',
  'SERVICE_PROFESSIONAL_HISTORY',
  'SERVICE_PROFESSIONAL_HISTORY_OWNER_ONLY',
  'SERVICE_PROTEST_CLEARANCE_CERTIFICATE',
  'SERVICE_PROTEST_PF',
  'SERVICE_PROTEST_PJ',
  'SERVICE_PUBLIC_SERVANTS',
  'SERVICE_RELATED_PEOPLE',
  'SERVICE_REGISTRATION_DATA_CNPJ',
  'SERVICE_RFB_PF',
  'SERVICE_RFB_PF_ON_DEMAND',
  'SERVICE_RFB_PJ',
  'SERVICE_RFB_PJ_ON_DEMAND',
  'SERVICE_SINTEGRA_CONSULTATION',
  'SERVICE_SOCIAL_ASSISTANCE_EXTENDED',
  'SEVICE_ONLINE_BETTING_PROPENSITY',
  'SERVICE_QUOD_CREDIT_SCORE_COMPANY',
  'SERVICE_BOAVISTA_ONE_SCORE_COMPANY',
  'SERVICE_BOAVISTA_CREDIT_SCORE_COMPANY',
  'SERVICE_QUOD_CREDIT_RISK_COMPANY',
  'SERVICE_ECONOMIC_GROUP_RELATIONSHIPS',
  'SERVICE_REPUTATIONS_AND_REVIEWS',
  'SERVICE_INVESTMENT_FUND_DATA',
  'SERVICE_OWNERS_INFLUENCE',
  'SERVICE_PGMEI',
  'SERVICE_FGTS',
  'SERVICE_MARKETPLACE_DATA',
  'SERVICE_ONLINE_ADS',
  'SERVICE_RF_QSA',
  'SERVICE_OWNERS_LAWSUITS_DISTRIBUTION',
  'SERVICE_LAWSUITS_DISTRIBUTION_DATA_COMPANY',
  'SERVICE_LABOR_LAWSUITS',
  'SERVICE_EMPLOYEES_KYC',
  'SERVICE_HISTORY_BASIC_DATA',
  'SERVICE_MERCHANT_CATEGORY_DATA',
  'SERVICE_SYNDICATE_AGREEMENTS',
  'SERVICE_PHONES_EXTENDED_COMPANY',
  'SERVICE_COMPANY_EVOLUTION',
]);

function filterActiveServiceApiServices(catalog) {
  return catalog.filter((service) => activeServiceApiAliases.has(service.service));
}

function buildSearchTerms(item, lang = 'pt') {
  const terms = new Set([
    item.service,
    item.summary,
    item.summary.replace(/^(PF|PJ)\s+-\s+/i, ''),
  ]);
  const text = `${item.summary} ${item.service}`.toLowerCase();

  if (lang === 'en') {
    if (text.includes('rfb') || text.includes('receita') || text.includes('cpf')) terms.add('CPF Federal Revenue');
    if (text.includes('cnpj') || text.includes('corporate')) terms.add('CNPJ Federal Revenue');
    if (text.includes('ocr')) terms.add('OCR document image base64 reading extraction');
    if (text.includes('ocr') && text.includes('cnh')) terms.add('OCR CNH driver license');
    if (text.includes('ocr') && text.includes('rg')) terms.add('OCR RG identity front back');
    if (text.includes('cnpj') && text.includes('ocr')) terms.add('OCR CNPJ card company registration proof');
    if (text.includes('proof_of_address') || text.includes('comprovante') || text.includes('endereco')) terms.add('proof of address utility bill address');
    if (text.includes('emancipation') || text.includes('emancipacao')) terms.add('emancipation document notary certificate declaration');
    if (text.includes('face_index')) terms.add('face index facial search selfie CPF face database');
    if (text.includes('face_index') || text.includes('face_match') || text.includes('facematch') || text.includes('busca de face') || text.includes('comparacao facial') || text.includes('comparação facial')) terms.add('facial comparison biometrics selfie face');
    if (text.includes('liveness')) terms.add('liveness selfie proof of life');
    if (text.includes('documentoscopia')) terms.add('document forensics document selfie validation');
    if (text.includes('company_kyc_owners')) terms.add('compliance KYC sanctions PEP sanctioned interpol ofac');
    else if (text.includes('kyc')) terms.add('compliance KYC sanctions PEP media');
    if (text.includes('bet')) terms.add('betting bets compliance bet');
    if (text.includes('debt') || text.includes('débito') || text.includes('debito')) terms.add('active debt collections delinquency');
    if (text.includes('score') || text.includes('risco') || text.includes('credito')) terms.add('score risk credit rating delinquency');
    if (text.includes('electoral') || text.includes('eleitoral')) terms.add('electoral data campaign donations candidate');
    if (text.includes('jurid') || text.includes('lawsuit') || text.includes('process')) terms.add('lawsuits legal proceedings court certificate');
    if (text.includes('domain') || text.includes('domini')) terms.add('domains sites digital presence');
    if (text.includes('phone') || text.includes('telefone')) terms.add('phone mobile validation contact');
    if (text.includes('email')) terms.add('email validation contact');

    return [...terms].sort();
  }

  if (text.includes('rfb') || text.includes('receita') || text.includes('cpf')) terms.add('CPF Receita Federal');
  if (text.includes('cnpj') || text.includes('corporate')) terms.add('CNPJ Receita Federal');
  if (text.includes('ocr')) terms.add('OCR documento imagem base64 leitura extração');
  if (text.includes('ocr') && text.includes('cnh')) terms.add('OCR CNH carteira motorista habilitação');
  if (text.includes('ocr') && text.includes('rg')) terms.add('OCR RG identidade frente verso');
  if (text.includes('cnpj') && text.includes('ocr')) terms.add('OCR cartão CNPJ comprovante inscrição empresa');
  if (text.includes('proof_of_address') || text.includes('comprovante') || text.includes('endereco')) terms.add('comprovante de endereço conta fatura endereço');
  if (text.includes('emancipation') || text.includes('emancipacao')) terms.add('documento emancipação cartório certidão declaração');
  if (text.includes('face_index')) terms.add('face index busca facial selfie CPF base de faces');
  if (text.includes('face_index') || text.includes('face_match') || text.includes('facematch') || text.includes('busca de face') || text.includes('comparacao facial') || text.includes('comparação facial')) terms.add('comparação facial biometria selfie rosto');
  if (text.includes('liveness')) terms.add('prova de vida selfie liveness');
  if (text.includes('documentoscopia')) terms.add('documentoscopia documento selfie validação');
  if (text.includes('company_kyc_owners')) terms.add('compliance KYC sanções PEP sancionado interpol ofac');
  else if (text.includes('kyc')) terms.add('compliance KYC sanções PEP mídia');
  if (text.includes('bet')) terms.add('apostas bets compliance bet');
  if (text.includes('debt') || text.includes('débito') || text.includes('debito')) terms.add('dívida ativa débito cobrança inadimplência');
  if (text.includes('score') || text.includes('risco') || text.includes('credito')) terms.add('score risco crédito rating inadimplência');
  if (text.includes('electoral') || text.includes('eleitoral')) terms.add('dados eleitorais campanha doações candidato');
  if (text.includes('jurid') || text.includes('lawsuit') || text.includes('process')) terms.add('processos judiciais jurídicos tribunal certidão');
  if (text.includes('domain') || text.includes('domini')) terms.add('domínios sites presença digital');
  if (text.includes('phone') || text.includes('telefone')) terms.add('telefone celular validação contato');
  if (text.includes('email')) terms.add('email validação contato');

  return [...terms].sort();
}

function apiReferenceServiceUrl(item, category, lang = 'pt') {
  const page = category === 'Pessoa Jurídica' ? 'services-pessoa-juridica' : 'services-pessoa-fisica';
  if (lang === 'en') return `${siteUrl}/en/api-reference/${page}#${item.service}`;
  return `${siteUrl}/api-reference/${page}#${item.service}`;
}

function guideUrlForCategory(category, lang = 'pt') {
  if (lang === 'en') {
    const mapEn = {
      'Pessoa Física': `${siteUrl}/en/guides/servicos-pessoa-fisica`,
      'Pessoa Jurídica': `${siteUrl}/en/guides/servicos-pessoa-juridica`,
      Customers: `${siteUrl}/en/api-reference/boas-vindas`,
      Onboarding: `${siteUrl}/en/guides/onboarding-sdk`,
    };
    return mapEn[category] || `${siteUrl}/en/guides/matriz-de-servicos`;
  }

  const map = {
    'Pessoa Física': `${siteUrl}/guides/servicos-pessoa-fisica`,
    'Pessoa Jurídica': `${siteUrl}/guides/servicos-pessoa-juridica`,
    Customers: `${siteUrl}/api-reference/boas-vindas`,
    Onboarding: `${siteUrl}/guides/onboarding-sdk`,
  };
  return map[category] || `${siteUrl}/guides/matriz-de-servicos`;
}

function categoryLabel(category, lang = 'pt') {
  if (lang !== 'en') return category;
  const map = {
    'Pessoa Física': 'Individuals',
    'Pessoa Jurídica': 'Businesses',
    Customers: 'Customers',
    Onboarding: 'Onboarding',
    Geral: 'General',
  };
  return map[category] || category;
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
      title: 'Gerar token em homologação',
      description: 'Use antes de chamar endpoints protegidos em HML.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/token-generate',
        bearer: false,
        body: { client: '{client}', secret: '{secret}' },
      }),
    },
    {
      file: 'auth.prod.curl',
      title: 'Gerar token em produção',
      description: 'Use somente quando o cliente já estiver liberado em produção.',
      content: renderCurl({
        baseUrl: 'https://backoffice.idcerberus.com',
        path: '/api/token-generate',
        bearer: false,
        body: { client: '{client}', secret: '{secret}' },
      }),
    },
    {
      file: 'service-api-cpf.hml.curl',
      title: 'Consulta simples de CPF em HML',
      description: 'Exemplo base para validar token, produto e resposta de pessoa física.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_RFB_PF', cpf: '00000000000', birthDate: 'yyyy-MM-dd (opcional)' },
      }),
    },
    {
      file: 'service-api-cpf.prod.curl',
      title: 'Consulta simples de CPF em produção',
      description: 'Mesmo payload da consulta de CPF, apontando para produção.',
      content: renderCurl({
        baseUrl: 'https://backoffice.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_RFB_PF', cpf: '00000000000', birthDate: 'yyyy-MM-dd (opcional)' },
      }),
    },
    {
      file: 'service-api-cnpj.hml.curl',
      title: 'Consulta simples de CNPJ em HML',
      description: 'Exemplo base para validar token, produto e resposta de pessoa jurídica.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_RFB_PJ', cnpj: '00000000000000' },
      }),
    },
    {
      file: 'service-api-cnpj.prod.curl',
      title: 'Consulta simples de CNPJ em produção',
      description: 'Mesmo payload da consulta de CNPJ, apontando para produção.',
      content: renderCurl({
        baseUrl: 'https://backoffice.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_RFB_PJ', cnpj: '00000000000000' },
      }),
    },
    {
      file: 'service-api-ocr-cnh.hml.curl',
      title: 'OCR de CNH em HML',
      description: 'Use base64 puro da imagem da CNH em image1.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_OCR', documentType: 'CNH', image1: 'BASE64_DA_CNH' },
      }),
    },
    {
      file: 'service-api-ocr-rg.hml.curl',
      title: 'OCR de RG em HML',
      description: 'Use frente em image1 e verso em image2.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_OCR', documentType: 'RG', image1: 'BASE64_DA_FRENTE', image2: 'BASE64_DO_VERSO' },
      }),
    },
    {
      file: 'service-api-ocr-cnpj-card.hml.curl',
      title: 'OCR de cartão CNPJ em HML',
      description: 'Use imagem legível do cartão CNPJ em image1.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_OCR_CNPJ_CARD', image1: 'BASE64_DO_CARTAO_CNPJ' },
      }),
    },
    {
      file: 'service-api-ocr-proof-of-address.hml.curl',
      title: 'OCR de comprovante de endereço em HML',
      description: 'Use conta, fatura ou comprovante aceito em image1.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_OCR_PROOF_OF_ADDRESS', image1: 'BASE64_DO_COMPROVANTE' },
      }),
    },
    {
      file: 'service-api-face-index.hml.curl',
      title: 'Face Index em HML',
      description: 'Use selfie real em image1. Não use foto de documento.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_FACE_INDEX', image1: 'BASE64_DA_SELFIE' },
      }),
    },
    {
      file: 'service-api-credit-risk-company.hml.curl',
      title: 'Risco de crédito PJ em HML',
      description: 'Exemplo para consultar risco de crédito de empresa.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_CREDIT_RISK_COMPANY', cnpj: '00000000000000' },
      }),
    },
    {
      file: 'service-api-credit-score.hml.curl',
      title: 'Score de crédito PF em HML',
      description: 'Exemplo para consultar score de crédito de pessoa física.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_CREDIT_SCORE', cpf: '00000000000' },
      }),
    },
    {
      file: 'facematch.hml.curl',
      title: 'FaceMatch em HML',
      description: 'Compara duas imagens faciais. Use selfie/rosto, não OCR de documento.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_FACE_MATCH', image1: 'BASE64_FACE_1', image2: 'BASE64_FACE_2' },
      }),
    },
    {
      file: 'documentoscopia.hml.curl',
      title: 'Documentoscopia em HML',
      description: 'Fluxo com documento e selfie para análise documental.',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY', key: '{key}', image1: 'BASE64_DOCUMENTO_FRENTE', image2: 'BASE64_DOCUMENTO_VERSO', selfie1: 'BASE64_SELFIE' },
      }),
    },
  ];

  for (const example of examples) write(path.join(examplesDir, example.file), `${example.content}\n`);

  return examples.map((example) => ({
    file: example.file,
    title: example.title,
    description: example.description,
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
  lines.push('1. Não invente endpoints, parâmetros ou services.');
  lines.push('2. Para consultas externas, use `POST /api/service-api` e selecione o produto pelo campo `service`.');
  lines.push('3. Antes de responder payload, confirme se o alias é o alias de chamada configurado no produto.');
  lines.push('4. Use homologação para testes: `https://backoffice-hml.idcerberus.com`.');
  lines.push('5. Use produção somente quando o usuário pedir explicitamente: `https://backoffice.idcerberus.com`.');
  lines.push('6. Nunca exponha `client`, `secret`, JWT real, CPF real, CNPJ real ou imagens reais em exemplos.');
  lines.push('7. Quando faltar um service no catálogo, diga que ele precisa ser confirmado antes de documentar ou integrar.');
  lines.push('');
  lines.push('## Autenticação');
  lines.push('');
  lines.push('```bash');
  lines.push("curl --location 'https://backoffice-hml.idcerberus.com/api/token-generate' \\");
  lines.push("--header 'Content-Type: application/json' \\");
  lines.push("--data '{");
  lines.push(' "client": "{client}",');
  lines.push(' "secret": "{secret}"');
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
    lines.push(`1. Service: \`${service.service}\``);
    lines.push(`2. Endpoint: \`${service.endpoint}\``);
    lines.push(`3. Campos do request: ${service.requestFields.length ? service.requestFields.map((field) => `\`${field}\``).join(', ') : 'sem campos adicionais mapeados'}`);
    lines.push(`4. Termos de busca: ${displaySearchTerms(service, 10)}`);
    lines.push(`5. Retorno principal: ${service.responseSummary}`);
    lines.push('');
    lines.push('Response resumido:');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(serviceResponseExample(service), null, 2));
    lines.push('```');
    lines.push('');
    lines.push('Curl de homologação:');
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

function displaySearchTerms(service, limit = 6) {
  const base = normalizeText(`${service.service} ${service.name}`);
  const terms = (service.searchTerms || [])
    .filter((term) => !base.includes(normalizeText(term)))
    .slice(0, limit);

  return terms.length ? terms.join(', ') : service.name;
}

function pushSearchHowTo(lines, lang = 'pt') {
  if (lang === 'en') {
    lines.push('## How to search better');
    lines.push('');
    lines.push('Search works best when the term appears as a title, alias or page text. If you do not know the exact alias, search by the type of document, data or problem you want to solve.');
    lines.push('');
    lines.push('<CardGroup cols={2}>');
    lines.push(' <Card icon="id-card" title="I have a CPF" href="#individuals">');
    lines.push(' Search for \`cpf\`, \`revenue\`, \`score\`, \`risk\`, \`phone\`, \`email\`, \`ocr\`, \`face\` or \`lawsuits\`.');
    lines.push(' </Card>');
    lines.push(' <Card icon="building" title="I have a CNPJ" href="#businesses">');
    lines.push(' Search for \`cnpj\`, \`revenue\`, \`credit risk\`, \`partners\`, \`domains\`, \`CNPJ card\` or \`compliance\`.');
    lines.push(' </Card>');
    lines.push(' <Card icon="image" title="I have an image" href="/en/guides/service-api/sobre-ocr-service-api">');
    lines.push(' Search for \`OCR\`, \`CNH\`, \`RG\`, \`CNPJ card\`, \`proof of address\`, \`base64\` or \`image1\`.');
    lines.push(' </Card>');
    lines.push(' <Card icon="code" title="I want to copy a payload" href="/en/api-reference/services-pessoa-fisica">');
    lines.push(' Go to the API Reference when you need body, curl, a summarized response and a common error.');
    lines.push(' </Card>');
    lines.push('</CardGroup>');
    lines.push('');
    lines.push('### Search shortcuts');
    lines.push('');
    lines.push('<CardGroup cols={2}>');
    const shortcutsEn = [
      ['SERVICE_OCR or OCR React', 'Identification documents: CNH, RG, OAB, RNE/CRNM and passport.'],
      ['CNPJ card', 'OCR of the CNPJ card with \`SERVICE_OCR_CNPJ_CARD\`.'],
      ['proof of address', 'OCR of a utility bill, invoice or proof of address with image/base64.'],
      ['face index', 'Facial search by selfie in the face database.'],
      ['credit risk', 'Score, rating, risk and credit services for PF/PJ.'],
      ['phone or email', 'Validations and contact history.'],
    ];
    for (const [title, body] of shortcutsEn) {
      lines.push(' <Card icon="layer-group" title="' + title + '">');
      lines.push(' ' + body);
      lines.push(' </Card>');
    }
    lines.push('</CardGroup>');
    lines.push('');
    return;
  }

  lines.push('## Como pesquisar melhor');
  lines.push('');
  lines.push('A busca funciona melhor quando o termo aparece como título, alias ou texto da página. Se não souber o alias exato, pesquise pelo tipo de documento, dado ou problema que quer resolver.');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card icon="id-card" title="Tenho um CPF" href="#pessoa-fisica">');
  lines.push(' Pesquise por \`cpf\`, \`receita\`, \`score\`, \`risco\`, \`telefone\`, \`email\`, \`ocr\`, \`face\` ou \`processos\`.');
  lines.push(' </Card>');
  lines.push(' <Card icon="building" title="Tenho um CNPJ" href="#pessoa-juridica">');
  lines.push(' Pesquise por \`cnpj\`, \`receita\`, \`risco de crédito\`, \`sócios\`, \`domínios\`, \`cartão CNPJ\` ou \`compliance\`.');
  lines.push(' </Card>');
  lines.push(' <Card icon="image" title="Tenho uma imagem" href="/guides/service-api/sobre-ocr-service-api">');
  lines.push(' Pesquise por \`OCR\`, \`CNH\`, \`RG\`, \`cartão CNPJ\`, \`comprovante de endereço\`, \`base64\` ou \`image1\`.');
  lines.push(' </Card>');
  lines.push(' <Card icon="code" title="Quero copiar payload" href="/api-reference/services-pessoa-fisica">');
  lines.push(' Vá para o API Reference quando precisar de body, curl, response resumido e erro comum.');
  lines.push(' </Card>');
  lines.push('</CardGroup>');
  lines.push('');
  lines.push('### Atalhos de busca');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  const shortcuts = [
    ['SERVICE_OCR ou OCR React', 'Documentos de identificação, CNH, RG, OAB, RNE/CRNM e passaporte.'],
    ['cartão CNPJ', 'OCR de cartão CNPJ com \`SERVICE_OCR_CNPJ_CARD\`.'],
    ['comprovante de endereço', 'OCR de conta, fatura ou comprovante com imagem/base64.'],
    ['face index', 'Busca facial por selfie na base de faces.'],
    ['risco de crédito', 'Services de score, rating, risco e crédito PF/PJ.'],
    ['telefone ou email', 'Validações e histórico de contato.'],
  ];
  for (const [title, body] of shortcuts) {
    lines.push(' <Card icon="layer-group" title="' + title + '">');
    lines.push(' ' + body);
    lines.push(' </Card>');
  }
  lines.push('</CardGroup>');
  lines.push('');
}

function renderServiceIndexCard(service, lang = 'pt') {
  if (lang === 'en') {
    const fieldsEn = service.requestFields.length ? service.requestFields.map((field) => '\`' + field + '\`').join(', ') : 'no additional fields';
    const termsEn = displaySearchTerms(service);
    return [
      '<Accordion title="' + escapeAttribute(service.name) + '">',
      '',
      '**Service:** \`' + service.service + '\`',
      '',
      '**Main fields:** ' + fieldsEn,
      '',
      '**Search terms:** ' + termsEn,
      '',
      '**When to use:** ' + serviceUseCase(service, lang),
      '',
      '**Main return:** ' + service.responseSummary,
      '',
      '[View in the API Reference](' + service.documentationUrl + ')',
      '',
      '</Accordion>',
    ].join('\n');
  }

  const fields = service.requestFields.length ? service.requestFields.map((field) => '\`' + field + '\`').join(', ') : 'sem campos adicionais';
  const terms = displaySearchTerms(service);
  return [
    '<Accordion title="' + escapeAttribute(service.name) + '">',
    '',
    '**Service:** \`' + service.service + '\`',
    '',
    '**Campos principais:** ' + fields,
    '',
    '**Termos de busca:** ' + terms,
    '',
    '**Quando usar:** ' + serviceUseCase(service),
    '',
    '**Retorno principal:** ' + service.responseSummary,
    '',
    '[Ver no API Reference](' + service.documentationUrl + ')',
    '',
    '</Accordion>',
  ].join('\n');
}

function renderServicesIndex(catalog, lang = 'pt') {
  const lines = [];
  if (lang === 'en') {
    lines.push('---');
    lines.push('title: Service index');
    lines.push('description: Operational list of the services already documented in the API Reference');
    lines.push('boost: 4');
    lines.push('---');
    lines.push('');
    lines.push('# Service index');
    lines.push('');
    lines.push('Use this index when you already know which product you need to run and want to confirm the exact \`service\` name before building the call.');
    lines.push('');
    lines.push('<Info>');
    lines.push('All the queries below use \`POST /api/service-api\`. The product executed is defined by the \`service\` field in the body.');
    lines.push('</Info>');
    lines.push('');
    pushSearchHowTo(lines, lang);
    pushServiceAliasNote(lines, {}, lang);
    lines.push('## Services by person type');
    lines.push('');
    lines.push('<CardGroup cols={2}>');
    lines.push(' <Card icon="id-card" title="Individuals" href="#individuals">');
    lines.push(' ' + catalog.filter((service) => service.category === 'Pessoa Física').length + ' services for CPF, biometrics, OCR, contacts, risk, credit, compliance and electoral data.');
    lines.push(' </Card>');
    lines.push(' <Card icon="building" title="Businesses" href="#businesses">');
    lines.push(' ' + catalog.filter((service) => service.category === 'Pessoa Jurídica').length + ' services for CNPJ, Federal Revenue, partners, contacts, risk, compliance, OCR and corporate data.');
    lines.push(' </Card>');
    lines.push('</CardGroup>');
    lines.push('');

    let currentCategoryEn = '';
    for (const service of catalog) {
      if (service.category !== currentCategoryEn) {
        if (currentCategoryEn) {
          lines.push('</AccordionGroup>');
          lines.push('');
        }
        currentCategoryEn = service.category;
        lines.push('## ' + categoryLabel(currentCategoryEn, lang));
        lines.push('');
        lines.push('Open the service to see the public alias, input fields, search terms and expected return.');
        lines.push('');
        lines.push('<AccordionGroup>');
      }
      lines.push(renderServiceIndexCard(service, lang));
      lines.push('');
    }
    if (currentCategoryEn) lines.push('</AccordionGroup>');

    lines.push('');
    lines.push('## Step by step per service');
    lines.push('');
    lines.push('Use the API Reference to copy the body, curl and summarized response for each product:');
    lines.push('');
    lines.push('<CardGroup cols={2}>');
    lines.push(' <Card icon="id-card" title="Individual (PF) services" href="/en/api-reference/services-pessoa-fisica">');
    lines.push(' Full catalog with payloads and responses for CPF services.');
    lines.push(' </Card>');
    lines.push(' <Card icon="building" title="Business (PJ) services" href="/en/api-reference/services-pessoa-juridica">');
    lines.push(' Full catalog with payloads and responses for CNPJ services.');
    lines.push(' </Card>');
    lines.push('</CardGroup>');
    return lines.join('\n');
  }

  lines.push('---');
  lines.push('title: Índice de services');
  lines.push('description: Lista operacional dos services já documentados no API Reference');
  lines.push('boost: 4');
  lines.push('---');
  lines.push('');
  lines.push('# Índice de services');
  lines.push('');
  lines.push('Use este Índice quando já souber qual produto precisa executar e quiser confirmar o nome exato do \`service\` antes de montar a chamada.');
  lines.push('');
  lines.push('<Info>');
  lines.push('Todas as consultas abaixo usam \`POST /api/service-api\`. O produto executado é definido pelo campo \`service\` no body.');
  lines.push('</Info>');
  lines.push('');
  pushSearchHowTo(lines);
  pushServiceAliasNote(lines);
  lines.push('## Services por tipo de pessoa');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card icon="id-card" title="Pessoa Física" href="#pessoa-fisica">');
  lines.push(' ' + catalog.filter((service) => service.category === 'Pessoa Física').length + ' services para CPF, biometria, OCR, contatos, risco, crédito, compliance e dados eleitorais.');
  lines.push(' </Card>');
  lines.push(' <Card icon="building" title="Pessoa Jurídica" href="#pessoa-juridica">');
  lines.push(' ' + catalog.filter((service) => service.category === 'Pessoa Jurídica').length + ' services para CNPJ, Receita Federal, sócios, contatos, risco, compliance, OCR e dados societários.');
  lines.push(' </Card>');
  lines.push('</CardGroup>');
  lines.push('');

  let currentCategory = '';
  for (const service of catalog) {
    if (service.category !== currentCategory) {
      if (currentCategory) {
        lines.push('</AccordionGroup>');
        lines.push('');
      }
      currentCategory = service.category;
      lines.push('## ' + currentCategory);
      lines.push('');
      lines.push('Abra o service para ver alias público, campos de entrada, termos de busca e retorno esperado.');
      lines.push('');
      lines.push('<AccordionGroup>');
    }
    lines.push(renderServiceIndexCard(service));
    lines.push('');
  }
  if (currentCategory) lines.push('</AccordionGroup>');

  lines.push('');
  lines.push('## Passo a passo por service');
  lines.push('');
  lines.push('Use o API Reference para copiar body, curl e response resumido de cada produto:');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card icon="id-card" title="Services de pessoa física" href="/api-reference/services-pessoa-fisica">');
  lines.push(' Catálogo completo com payloads e responses para services de CPF.');
  lines.push(' </Card>');
  lines.push(' <Card icon="building" title="Services de pessoa jurídica" href="/api-reference/services-pessoa-juridica">');
  lines.push(' Catálogo completo com payloads e responses para services de CNPJ.');
  lines.push(' </Card>');
  lines.push('</CardGroup>');
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

function pt(value) {
  return `${value ?? ''}`
    .replaceAll('dividas', 'dívidas')
    .replaceAll('Dividas', 'Dívidas')
    .replaceAll('debito', 'débito')
    .replaceAll('debitos', 'débitos')
    .replaceAll('situacao', 'situação')
    .replaceAll('Situacao', 'Situação')
    .replaceAll('orgao', 'órgão')
    .replaceAll('orgaos', 'órgãos')
    .replaceAll('enderecos', 'endereços')
    .replaceAll('Endereco', 'Endereço')
    .replaceAll('endereco', 'endereço')
    .replaceAll('disponiveis', 'disponíveis')
    .replaceAll('disponivel', 'disponível')
    .replaceAll('historico', 'histórico')
    .replaceAll('Historico', 'Histórico')
    .replaceAll('politico', 'político')
    .replaceAll('politicos', 'políticos')
    .replaceAll('doacoes', 'doações')
    .replaceAll('prestacoes', 'prestações')
    .replaceAll('servico', 'serviço')
    .replaceAll('servicos', 'serviços')
    .replaceAll('validacao', 'validação')
    .replaceAll('Validacao', 'Validação')
    .replaceAll('validacoes', 'validações')
    .replaceAll('associacao', 'associação')
    .replaceAll('associados', 'associados')
    .replaceAll('numero', 'número')
    .replaceAll('confianca', 'confiança')
    .replaceAll('prisao', 'prisão')
    .replaceAll('ocorrencia', 'ocorrência')
    .replaceAll('ocorrencias', 'ocorrências')
    .replaceAll('filiacao', 'filiação')
    .replaceAll('obito', 'óbito')
    .replaceAll('genero', 'gênero')
    .replaceAll('informacoes', 'informações')
    .replaceAll('Informacoes', 'Informações')
    .replaceAll('economica', 'econômica')
    .replaceAll('economicos', 'econômicos')
    .replaceAll('biometrico', 'biométrico')
    .replaceAll('biometricos', 'biométricos')
    .replaceAll('certidao', 'certidão')
    .replaceAll('certidoes', 'certidões')
    .replaceAll('juridica', 'jurídica')
    .replaceAll('juridicos', 'jurídicos')
    .replaceAll('juridicas', 'jurídicas')
    .replaceAll('fisica', 'física')
    .replaceAll('fisicas', 'físicas')
    .replaceAll('midia', 'mídia')
    .replaceAll('socios', 'sócios')
    .replaceAll('socio', 'sócio')
    .replaceAll('societarios', 'societários')
    .replaceAll('razao', 'razão')
    .replaceAll('atualizacao', 'atualização')
    .replaceAll('participacao', 'participação')
    .replaceAll('qualificacao', 'qualificação')
    .replaceAll('inscricao', 'inscrição')
    .replaceAll('operacao', 'operação')
    .replaceAll('regulatorio', 'regulatório')
    .replaceAll('dominio', 'domínio')
    .replaceAll('exposicao', 'exposição')
    .replaceAll('nivel', 'nível')
    .replaceAll('periodo', 'período')
    .replaceAll('periodos', 'períodos')
    .replaceAll('pendencias', 'pendências')
    .replaceAll('avaliacao', 'avaliação')
    .replaceAll('inadimplencia', 'inadimplência')
    .replaceAll('numerico', 'numérico')
    .replaceAll('recencia', 'recência')
    .replaceAll('relacao', 'relação')
    .replaceAll('cartorio', 'cartório')
    .replaceAll('cartorios', 'cartórios')
    .replaceAll('proprietarios', 'proprietários')
    .replaceAll('sancoes', 'sanções')
    .replaceAll('pais', 'país')
    .replaceAll('mae', 'mãe')
    .replaceAll('maxima', 'máxima')
    .replaceAll('parametro', 'parâmetro')
    .replaceAll('referencia', 'referência')
    .replaceAll('identificacao', 'identificação')
    .replaceAll('minimo', 'mínimo')
    .replaceAll('pratica', 'prática')
    .replaceAll('campanha', 'campanha')
    .replaceAll('campanhas', 'campanhas')
    .replaceAll('vinculos', 'vínculos')
    .replaceAll('vinculadas', 'vinculadas')
    .replaceAll('vinculados', 'vinculados')
    .replaceAll('producao', 'produção')
    .replaceAll('produçao', 'produção')
    .replaceAll('sera', 'será')
    .replaceAll('Codigo', 'Código')
    .replaceAll('codigo', 'código')
    .replaceAll('nao', 'não')
    .replaceAll('precisao', 'precisão')
    .replaceAll('decisao', 'decisão')
    .replaceAll('analise', 'análise')
    .replaceAll('Analise', 'Análise')
    .replaceAll('atencao', 'atenção')
    .replaceAll('propensao', 'propensão')
    .replaceAll('recomendacao', 'recomendação')
    .replaceAll('consolidada', 'consolidada')
    .replaceAll('extraidos', 'extraídos')
    .replaceAll('especificos', 'específicos')
    .replaceAll('possivel', 'possível')
    .replaceAll('provavel', 'provável')
    .replaceAll('cadastrais', 'cadastrais');
}

function localizeExample(value) {
  if (Array.isArray(value)) return value.map(localizeExample);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, localizeExample(entry)]));
  }
  return typeof value === 'string' ? pt(value) : value;
}

function serviceFamily(service, lang = 'pt') {
  const text = normalizeText(`${service.name} ${service.service} ${service.searchTerms?.join(' ') ?? ''}`);

  if (lang === 'en') {
    if (text.includes('telefone') || text.includes('phone') || text.includes('email') || text.includes('address') || text.includes('endereco') || text.includes('relacion') || text.includes('relationship') || text.includes('socio') || text.includes('qsa') || text.includes('sites') || text.includes('domains')) {
      return 'Contacts, sites and relationships';
    }
    if (text.includes('ocr') || text.includes('face') || text.includes('liveness') || text.includes('biometric') || text.includes('documentoscopia') || text.includes('datavalid')) {
      return 'Biometrics and documents';
    }
    if (text.includes('eleitoral') || text.includes('election') || text.includes('electoral') || text.includes('politic') || text.includes('pep')) {
      return 'Electoral data and PEP';
    }
    if (text.includes('juridic') || text.includes('criminal') || text.includes('lawsuit') || text.includes('protest') || text.includes('mandado') || text.includes('nada consta')) {
      return 'Legal records, certificates and protests';
    }
    if (text.includes('risco') || text.includes('score') || text.includes('debt') || text.includes('debito') || text.includes('divida') || text.includes('credito') || text.includes('financial') || text.includes('inadimplencia')) {
      return 'Risk, credit and debts';
    }
    if (text.includes('kyc') || text.includes('compliance') || text.includes('bet') || text.includes('media')) {
      return 'KYC, compliance and exposure';
    }
    if (text.includes('receita') || text.includes('rfb') || text.includes('enriquecimento') || text.includes('cadastro') || text.includes('registration') || text.includes('demographic') || text.includes('pis') || text.includes('mei') || text.includes('sintegra') || text.includes('das')) {
      return 'Registration data and Federal Revenue';
    }
    return 'Other services';
  }

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

function serviceUseCase(service, lang = 'pt') {
  const text = normalizeText(`${service.name} ${service.service}`);

  if (lang === 'en') {
    const targetEn = service.category === 'Pessoa Jurídica' ? 'the company' : 'the individual';

    if (text.includes('rfb') || text.includes('receita')) return `Use to look up or validate registration data for ${targetEn} in Federal Revenue databases.`;
    if (text.includes('enriquecimento')) return `Use to complement registration data for ${targetEn} from the informed document.`;
    if (text.includes('demographic')) return `Use to look up demographic data associated with ${targetEn}.`;
    if (text.includes('ocr')) return 'Use to extract data from documents sent as base64 or by URL.';
    if (text.includes('phone') || text.includes('telefone')) return 'Use to look up, validate or enrich phone data.';
    if (text.includes('liveness')) return 'Use to validate proof of life from a selfie image.';
    if (text.includes('face')) return 'Use to compare two facial images and return the similarity between them.';
    if (text.includes('documentoscopia')) return 'Use to evaluate document, selfie and biometrics within the documentoscopy flow.';
    if (text.includes('biometric') || text.includes('biometr')) return 'Use to compare the submitted image against available biometric databases and return the similarity.';
    if (text.includes('pep')) return 'Use to check political exposure or a link to a Politically Exposed Person.';
    if (text.includes('eleitoral') || text.includes('election') || text.includes('electoral')) return `Use to look up electoral information related to ${targetEn}.`;
    if (text.includes('juridic') || text.includes('lawsuit') || text.includes('criminal')) return `Use to look up certificates, lawsuits or legal information for ${targetEn}.`;
    if (text.includes('protest')) return `Use to look up protests associated with ${targetEn}'s document.`;
    if (text.includes('financial') || text.includes('financeir')) return `Use to look up financial information associated with ${targetEn}.`;
    if (text.includes('score') || text.includes('risco')) return `Use to assess risk, score or propensity associated with ${targetEn}.`;
    if (text.includes('debt') || text.includes('debito') || text.includes('divida')) return `Use to look up debts associated with ${targetEn}.`;
    if (text.includes('kyc') || text.includes('compliance')) return `Use to run KYC and compliance checks on ${targetEn}.`;
    if (text.includes('email')) return "Use to validate or look up email history related to the document.";
    if (text.includes('address') || text.includes('endereco')) return 'Use to look up or validate addresses associated with the document.';
    if (text.includes('domains') || text.includes('sites')) return `Use to look up site data linked to ${targetEn}.`;
    if (text.includes('relationship') || text.includes('relacion') || text.includes('socio')) return `Use to look up ties, partners or relationships associated with ${targetEn}.`;

    return `Use this service when you need to run the "${service.name}" query via the API.`;
  }

  const target = service.category === 'Pessoa Jurídica' ? 'empresa' : 'pessoa';

  if (text.includes('rfb') || text.includes('receita')) return `Use para consultar ou validar dados cadastrais da ${target} em bases da Receita Federal.`;
  if (text.includes('enriquecimento')) return `Use para complementar dados cadastrais da ${target} a partir do documento informado.`;
  if (text.includes('demographic')) return `Use para consultar dados demograficos associados à ${target}.`;
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

const serviceReturnDetails = {
  SERVICE_ACTIVE_DEBT_PF: {
    summary: 'Retorna dividas ativas vinculadas ao CPF, com origem do debito, valores, situacao, orgao credor e status da consulta.',
    result: { cpf: 'cpf', totalDebts: 2, totalValue: '1234.56', debts: [{ source: 'PGFN', value: '1234.56', status: 'ACTIVE' }] },
  },
  SERVICE_ACTIVE_DEBT_PJ: {
    summary: 'Retorna dividas ativas vinculadas ao CNPJ, com origem do debito, valores, situacao, orgao credor e status da consulta.',
    result: { cnpj: 'cnpj', totalDebts: 1, totalValue: '9800.00', debts: [{ source: 'PGFN', value: '9800.00', status: 'ACTIVE' }] },
  },
  SERVICE_ACTIVITIES_INDICATORS: {
    summary: 'Retorna indicadores de atividades vinculadas ao CPF, como sinais profissionais, segmentos, ocupacoes e registros disponiveis.',
    result: { cpf: 'cpf', activityIndicators: [{ type: 'PROFESSIONAL', description: 'Indicador encontrado' }], hasActivityIndicators: true },
  },
  SERVICE_ADDRESS: {
    summary: 'Retorna enderecos associados ao CPF, incluindo logradouro, numero, bairro, cidade, UF, CEP, pais, tipo e indicadores de atualidade quando disponiveis.',
    result: { cpf: 'cpf', totalAddresses: 2, addresses: [{ address: 'Rua Exemplo', number: '100', neighborhood: 'Centro', city: 'Sao Paulo', state: 'SP', zipcode: '01001000' }] },
  },
  SERVICE_ADDRESSES_EXTENDED_CNPJ: {
    summary: 'Retorna a lista completa de endereços do CNPJ em result.addresses (logradouro, número, complemento, bairro, cidade, UF, país, CEP, tipo, se está ativo e se é o principal), além de um resumo agregado em result.addressesExtendedTotal* com totais e datas da primeira/última passagem confirmada.',
    result: {
      cnpj: 'cnpj',
      addresses: [{
        address: 'Av Exemplo', number: '1000', complement: 'Sala 10', neighborhood: 'Centro', city: 'Sao Paulo', state: 'SP',
        country: 'Brasil', zipcode: '01001000', addressType: 'COMMERCIAL', isActive: 'true', isMainForEntity: 'true',
        priority: '1', lastValidationDate: '2026-05-12',
      }],
      addressesExtendedTotal: 1,
      addressesExtendedTotalActive: 1,
      addressesExtendedTotalWork: 1,
      addressesExtendedTotalPersonal: 0,
      addressesExtendedTotalUnique: 1,
      addressesExtendedTotalPassages: 7,
      addressesExtendedTotalBadPassages: 0,
      addressesExtendedOldestPassageDate: '2018-02-10',
      addressesExtendedNewestPassageDate: '2026-05-12',
    },
  },
  SERVICE_ARREST_WARRANT: {
    summary: 'Retorna indicativos de mandado de prisao para os dados informados, com situacao, orgao, processo e detalhes encontrados quando houver ocorrencia.',
    result: { cpf: 'cpf', hasArrestWarrant: false, warrants: [] },
  },
  SERVICE_AWARDS_AND_CERTIFICATIONS_CPF: {
    summary: 'Retorna a quantidade e os registros de premios e certificacoes encontrados para o CPF, quando a base consultada possuir dados.',
    result: { cpf: 'cpf', totalAwards: 0, totalCertifications: 0, awards: [], certifications: [] },
  },
  SERVICE_COMPANY_KYC_OWNERS: {
    summary: 'Retorna um resumo agregado de KYC/compliance da empresa (totalCurrentPep, totalCurrentSanctioned, averageSanctionsPerOwner, pepPercentage) e o detalhamento individual de cada sócio em result.kycOwners/companyOwners/peopleOwners, incluindo sanctionsHistory (histórico completo), highConfidenceSanctionsHistory (apenas sanções com matchRate acima de 90) e pepHistories.',
    result: {
      cnpj: 'cnpj',
      totalCurrentPep: 1,
      totalHistoricallyPEP: 1,
      totalCurrentSanctioned: 1,
      totalHistoricallySanctioned: 1,
      averageSanctionsPerOwner: 1,
      averageSanctionsPerOwnerExact: 0.5,
      pepPercentage: 50.0,
      ownerMaxSanctions: 1,
      ownerMinSanctions: 0,
      activeOwners: ['11122233344', '55566677788'],
      inactiveOwners: [],
      kycOwners: [
        {
          cpf: '11122233344',
          isPep: true,
          isCurrentlySanctioned: true,
          wasPreviouslySanctioned: true,
          firstSanctionDate: '2021-03-15',
          lastSanctionDate: '2024-08-02',
          firstPepOccurrenceDate: '2019-01-10',
          lastPepOccurrenceDate: '2024-08-02',
          sanctionsHistory: [{
            source: 'interpol', type: 'RED_NOTICE', standardizedSanctionType: 'INTERNATIONAL_ALERT', matchRate: 96,
            details: { Charge: 'Fraud', IssuingCountry: 'Brazil' }, normalizedDetails: { acusacao: 'Fraude', paisEmissor: 'Brasil' },
            startDate: '2021-03-15', endDate: null, isCurrentlyPresentOnSource: true,
          }],
          highConfidenceSanctionsHistory: [{
            source: 'interpol', type: 'RED_NOTICE', standardizedSanctionType: 'INTERNATIONAL_ALERT', matchRate: 96,
            details: { Charge: 'Fraud', IssuingCountry: 'Brazil' }, normalizedDetails: { acusacao: 'Fraude', paisEmissor: 'Brasil' },
            startDate: '2021-03-15', endDate: null, isCurrentlyPresentOnSource: true,
          }],
          pepHistories: [{ level: 'FEDERAL', jobTitle: 'Secretario', department: 'Ministerio Exemplo', startDate: '2019-01-10', endDate: null }],
          isCurrentlyElectoralDonor: false,
          isHistoricalElectoralDonor: true,
          totalElectoralDonations: 2,
          totalElectoralDonationAmount: 15000.0,
        },
        {
          cpf: '55566677788',
          isPep: false,
          isCurrentlySanctioned: false,
          wasPreviouslySanctioned: false,
          sanctionsHistory: [],
          highConfidenceSanctionsHistory: [],
          pepHistories: [],
        },
      ],
    },
  },
  SERVICE_COMPANY_RELATIONSHIP: {
    summary: 'Retorna relacionamentos da empresa, como sócios, proprietários, empresas relacionadas, participações e vínculos societários identificados.',
    result: { cnpj: 'cnpj', owners: [{ name: 'Nome do socio', document: 'cpf', share: '50%' }], relatedCompanies: [] },
  },
  SERVICE_COMPANY_RFB_OWNERS: {
    summary: 'Retorna o quadro societario na Receita Federal, com nome dos socios, documentos mascarados, qualificacao, participacao e data de entrada quando disponivel.',
    result: { cnpj: 'cnpj', owners: [{ name: 'Nome do socio', qualification: 'SOCIO-ADMINISTRADOR', entryDate: 'yyyy-MM-dd' }] },
  },
  SERVICE_COMPLIANCE_BET: {
    summary: 'Retorna indicadores de exposicao da empresa a apostas, bets e compliance regulatorio, incluindo sinais de operacao, dominio, atividade e alertas.',
    result: { cnpj: 'cnpj', hasBettingExposure: true, indicators: ['atividade relacionada'], riskLevel: 'MEDIUM' },
  },
  SERVICE_COMPLIANCE_BET_PJ: {
    summary: 'Retorna indicadores de exposicao da empresa a apostas, bets e compliance regulatorio, incluindo sinais de operacao, dominio, atividade e alertas.',
    result: { cnpj: 'cnpj', hasBettingExposure: true, indicators: ['atividade relacionada'], riskLevel: 'MEDIUM' },
  },
  SERVICE_CONFIRM_PHONE: {
    summary: 'Retorna dados associados ao telefone informado, como possivel titular, documento relacionado, status de confirmacao e atributos disponiveis.',
    result: { phone: '+5561123456789', matched: true, person: { name: 'Nome encontrado', document: 'cpf' } },
  },
  SERVICE_CORPORATE_DATA_ENRICHMENT: {
    summary: 'Retorna cadastro completo da empresa, incluindo razao social, nome fantasia, situacao cadastral, CNAEs, natureza juridica, porte, capital e endereco.',
    result: { cnpj: 'cnpj', officialName: 'EMPRESA EXEMPLO LTDA', tradeName: 'EMPRESA EXEMPLO', status: 'ATIVA', mainActivity: 'CNAE principal' },
  },
  SERVICE_CPF_ADDRESS_VALIDATION: {
    summary: 'Retorna se o endereco informado tem associacao com o CPF, incluindo nivel de match, endereco normalizado e sinais usados na validacao.',
    result: { cpf: 'cpf', zipcode: '01001000', match: true, confidence: 'HIGH', normalizedAddress: 'Rua Exemplo, 100' },
  },
  SERVICE_CPF_PHONE_VALIDATION: {
    summary: 'Retorna validacao da associacao entre CPF e telefone, com status de match, mensagem da consulta e dados retornados na consulta.',
    result: { cpf: 'cpf', phone: '11900000000', match: true, statusMessage: 'Telefone associado ao documento' },
  },
  SERVICE_CREDIT_RISK_COMPANY: {
    summary: 'Retorna dados de risco de cr\u00e9dito PJ, com score, rating, risco esperado e sinais jurídicos quando disponíveis.',
    result: { cnpj: 'cnpj', creditRisk: { status: 'APPROVED', score: '720', rating: 'B', expectedDefault: 'MEDIUM', legalProcess: false } },
  },
  SERVICE_CREDIT_SCORE: {
    summary: 'Retorna score de crédito associado ao CPF, com pontuação, faixa de risco e mensagem da consulta quando disponíveis.',
    result: { cpf: 'cpf', score: 750, riskLevel: 'LOW', message: 'Score calculado com sucesso' },
  },
  SERVICE_CRIMINAL_RECORD_CIVIL: {
    summary: 'Retorna resultado de antecedentes criminais civis, com status da certidao, ocorrencias encontradas, UF, RG e mensagens da consulta.',
    result: { cpf: 'cpf', rg: 'rg', state: 'SP', hasRecords: false, records: [] },
  },
  SERVICE_CRIMINAL_RECORD_FEDERAL: {
    summary: 'Retorna resultado de antecedentes criminais federais, com status da certidao, ocorrencias encontradas e mensagens da consulta.',
    result: { cpf: 'cpf', hasFederalCriminalRecord: false, records: [] },
  },
  SERVICE_DAS_MEI: {
    summary: 'Retorna informacoes de DAS MEI e situacao fiscal relacionada ao CNPJ, incluindo periodos, pagamentos, pendencias e status quando disponiveis.',
    result: { cnpj: 'cnpj', meiStatus: 'ACTIVE', periods: [{ period: '2026-01', paid: true }] },
  },
  SERVICE_DATAVALID_CNH: {
    summary: 'Retorna validacao validação documental da CNH, incluindo score biometrico, similaridade facial, status de validacao e campos conferidos.',
    result: { cpf: 'cpf', biometricScore: 0.98, validated: true, validationStatus: 'APPROVED' },
  },
  SERVICE_DEFAULT_RISK_SCORE: {
    summary: 'Retorna score de risco de inadimpl\u00eancia para CPF, com pontuação, faixa de risco e probabilidade estimada quando disponível.',
    result: { cpf: 'cpf', score: 690, riskLevel: 'MEDIUM', defaultProbability: '8%' },
  },
  SERVICE_DEMOGRAPHIC_DATA_CPF: {
    summary: 'Retorna dados demograficos associados ao CPF, com dados regionais, estimativas e indicadores retornados pela base consultada.',
    result: { cpf: 'cpf', demographicData: [{ indicator: 'Faixa de renda', value: 'Media' }], totalIndicators: 1 },
  },
  SERVICE_DIGITAL_DOCUMENTOSCOPY: {
    summary: 'Retorna status da documentoscopia, chave da consulta, dados extraidos do documento, validacoes de documento/selfie e resultado de aprovacao.',
    result: { key: '{key}', status: 'APPROVED', documentData: { name: 'Nome extraído', cpf: 'cpf' }, validations: [{ name: 'faceMatch', status: 'APPROVED' }] },
  },
  SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT: {
    summary: 'Retorna o resultado ja processado da documentoscopia pela chave informada, com status, campos extraidos, regras avaliadas e evidencias.',
    result: { key: '{key}', status: 'APPROVED', fields: [{ name: 'cpf', value: 'cpf' }], rules: [{ name: 'document', status: 'APPROVED' }] },
  },
  SERVICE_DOMAINS_CNPJ: {
    summary: 'Retorna dominios, sites e sinais digitais associados ao CNPJ, incluindo quantidade e registros encontrados quando disponiveis.',
    result: { cnpj: 'cnpj', totalDomains: 1, domains: [{ domain: 'empresa.com.br', status: 'ACTIVE' }] },
  },
  SERVICE_DOMAINS_CPF: {
    summary: 'Retorna dominios, sites e sinais digitais associados ao CPF, incluindo quantidade e registros encontrados quando disponiveis.',
    result: { cpf: 'cpf', totalDomains: 1, domains: [{ domain: 'exemplo.com.br', status: 'ACTIVE' }] },
  },
  SERVICE_ECONOMIC_RELATIONSHIP: {
    summary: 'Retorna vínculos econômicos associados ao CPF, como empresas relacionadas, participações, relações profissionais e indicadores de relacionamento.',
    result: { cpf: 'cpf', relationships: [{ type: 'OWNER', relatedDocument: 'cnpj', relatedName: 'Empresa relacionada' }] },
  },
  SERVICE_ELECTION_CANDIDATE_DATA_CPF: {
    summary: 'Retorna historico de candidaturas eleitorais do CPF, incluindo cargo, partido, ano, unidade eleitoral, bens declarados e situacao quando disponivel.',
    result: { cpf: 'cpf', candidacies: [{ year: 2024, role: 'VEREADOR', party: 'PARTIDO', status: 'DEFERIDO' }] },
  },
  SERVICE_ELECTORAL_DONORS_CNPJ: {
    summary: 'Retorna doacoes eleitorais realizadas pela empresa, com ano, candidato/partido, valor, cargo, UF e detalhes da prestacao de contas.',
    result: { cnpj: 'cnpj', donations: [{ year: 2024, recipient: 'Candidato', amount: '1000.00' }] },
  },
  SERVICE_ELECTORAL_DONORS_CPF: {
    summary: 'Retorna doacoes eleitorais realizadas pelo CPF, com ano, candidato/partido, valor, cargo, UF e detalhes da prestacao de contas.',
    result: { cpf: 'cpf', donations: [{ year: 2024, recipient: 'Candidato', amount: '500.00' }] },
  },
  SERVICE_ELECTORAL_PROVIDERS_CNPJ: {
    summary: 'Retorna prestacoes de servico eleitorais vinculadas ao CNPJ, com campanha, candidato/partido, valor, ano e natureza do servico.',
    result: { cnpj: 'cnpj', campos: [{ year: 2024, campaign: 'Campanha', amount: '2500.00', serviceType: 'Servico' }] },
  },
  SERVICE_ELECTORAL_PROVIDERS_CPF: {
    summary: 'Retorna prestacoes de servico eleitorais vinculadas ao CPF, com campanha, candidato/partido, valor, ano e natureza do servico.',
    result: { cpf: 'cpf', campos: [{ year: 2024, campaign: 'Campanha', amount: '800.00', serviceType: 'Servico' }] },
  },
  SERVICE_EMAILS_EXTENDED: {
    summary: 'Retorna e-mails associados ao CPF, incluindo prioridade, status de validacao, origem, data de atualizacao e sinais de uso quando disponiveis.',
    result: { cpf: 'cpf', emails: [{ email: 'email@exemplo.com', priority: 1, isValid: true, lastUpdate: 'yyyy-MM-dd' }] },
  },
  SERVICE_EMAIL_VALIDATION: {
    summary: 'Retorna validacao do e-mail informado, incluindo formato, existencia provavel, dominio, entregabilidade e indicadores de risco.',
    result: { email: 'email@email.com', validFormat: true, deliverable: true, domain: 'email.com', riskLevel: 'LOW' },
  },
  SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION: {
    summary: 'Retorna qualificacao cadastral no eSocial, com status de consistencia entre CPF, NIT/PIS e dados cadastrais informados.',
    result: { cpf: 'cpf', nit: 'nit', qualified: true, inconsistencies: [] },
  },
  SERVICE_FACE_MATCH: {
    summary: 'Retorna comparacao facial entre duas imagens, com score de similaridade, status do match e mensagem de aprovacao ou reprovacao.',
    result: { match: true, similarity: 98.2, status: 'APPROVED' },
  },
  SERVICE_FACE_INDEX: {
    summary: 'Busca uma selfie na base de faces indexadas e retorna se encontrou face, CPF associado e similaridade quando disponiveis.',
    result: { cpf: 'cpf', faceFound: true, similarity: 98.42 },
  },
  SERVICE_FAMILY_POLITICAL_HISTORY_CPF: {
    summary: 'Retorna historico politico familiar do CPF, incluindo familiares com candidaturas, doacoes, cargos, partidos e vinculos eleitorais quando encontrados.',
    result: { cpf: 'cpf', familyPoliticalHistory: [{ relativeName: 'Nome relacionado', relationship: 'PARENTE', role: 'Candidato' }] },
  },
  SERVICE_FAMILY_SOCIAL_BENEFITS: {
    summary: 'Retorna benefícios sociais familiares vinculados ao CPF, com programas, situação, quantidade e registros encontrados quando disponíveis.',
    result: { cpf: 'cpf', totalBenefits: 1, benefits: [{ program: 'Programa social', status: 'ACTIVE' }] },
  },
  SERVICE_FINANCIAL_INFORMATION: {
    summary: 'Retorna informacoes financeiras estimadas do CPF, como renda presumida, poder aquisitivo, classe economica e indicadores financeiros disponiveis.',
    result: { cpf: 'cpf', estimatedIncome: '5000-10000', purchasingPower: 'MEDIUM', financialIndicators: [] },
  },
  SERVICE_FINANCIAL_RISK_SCORE: {
    summary: 'Retorna score de risco financeiro do CPF, faixa de risco, recomendacao resumida e fatores que influenciam a avaliacao.',
    result: { cpf: 'cpf', score: 681, riskLevel: 'MEDIUM', recommendation: 'REVIEW' },
  },
  SERVICE_FIRST_LEVEL_PARTNER: {
    summary: 'Retorna socios de primeiro nivel da empresa, com nome, documento, participacao, qualificacao e vinculos diretos ao CNPJ.',
    result: { cnpj: 'cnpj', partners: [{ name: 'Nome do socio', document: 'cpf', level: 1, qualification: 'SOCIO' }] },
  },
  SERVICE_FRAUD_RISK_SCORE: {
    summary: 'Retorna score de risco de fraude do CPF, fator analisado, nivel de risco, score numerico e sinais que suportam a decisao.',
    result: { cpf: 'cpf', factor: 'minRisk', score: 720, riskLevel: 'LOW', indicators: [] },
  },
  SERVICE_JURIDICAL_PROCESSES: {
    summary: 'Retorna processos juridicos e administrativos vinculados ao CPF, com tribunal, classe, assunto, partes, status e datas quando disponiveis.',
    result: { cpf: 'cpf', totalProcesses: 1, processes: [{ court: 'TJSP', processNumber: '0000000-00.0000.0.00.0000', status: 'ACTIVE' }] },
  },
  SERVICE_JURIDICAL_PROCESSES_PJ: {
    summary: 'Retorna processos juridicos vinculados ao CNPJ, com tribunal, classe, assunto, partes, status, numero do processo e datas quando disponiveis.',
    result: { cnpj: 'cnpj', totalProcesses: 1, processes: [{ court: 'TJSP', processNumber: '0000000-00.0000.0.00.0000', status: 'ACTIVE' }] },
  },
  SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS: {
    summary: 'Retorna processos juridicos associados aos socios da empresa, com socio relacionado, tribunal, classe, assunto, status e datas.',
    result: { cnpj: 'cnpj', ownersProcesses: [{ ownerName: 'Nome do socio', totalProcesses: 1, processes: [] }] },
  },
  SERVICE_RELATED_PEOPLE_EMAILS: {
    summary: 'Retorna e-mails associados a pessoas relacionadas ao CPF informado, com o relacionamento identificado e sinais de uso de cada e-mail.',
    result: { cpf: 'cpf', totalRelatedPeopleEmails: 2, relatedPeopleEmailsList: 'nome@email.com - NOME DA PESSOA - 00000000000 - CONJUGE', relatedPeopleEmails: [{ relatedCpf: '00000000000', relatedName: 'NOME DA PESSOA', relationship: 'CONJUGE', type: 'PESSOAL', isMain: true, isRecent: true, isActive: true, email: 'nome@email.com', domain: 'email.com', validationStatus: 'VALID' }] },
  },
  SERVICE_RELATED_PEOPLE_PHONES: {
    summary: 'Retorna telefones associados a pessoas relacionadas ao CPF informado, com o relacionamento identificado e sinais de uso de cada telefone.',
    result: { cpf: 'cpf', totalRelatedPeoplePhones: 1, relatedPeoplePhonesList: '11900000000 - NOME DA PESSOA - 00000000000 - FILHO', relatedPeoplePhones: [{ relatedCpf: '00000000000', relatedName: 'NOME DA PESSOA', relationship: 'FILHO', type: 'CELULAR', isMain: true, isRecent: true, isActive: true, areaCode: '11', number: '900000000', phone: '11900000000', isInDoNotCallList: false }] },
  },
  SERVICE_RELATED_PEOPLE_ADDRESSES: {
    summary: 'Retorna endereços associados a pessoas relacionadas ao CNPJ informado, com o relacionamento identificado e sinais de uso de cada endereço.',
    result: { cnpj: 'cnpj', totalRelatedPeopleAddresses: 1, relatedPeopleAddressesList: 'RUA EXEMPLO, 100 - NOME DA PESSOA - 00000000000 - SOCIO', relatedPeopleAddresses: [{ relatedCpf: '00000000000', relatedName: 'NOME DA PESSOA', relationship: 'SOCIO', type: 'RESIDENCIAL', isMain: true, isRecent: true, isActive: true, address: 'RUA EXEMPLO', zipcode: '00000000', state: 'SP', city: 'SAO PAULO', neighborhood: 'CENTRO', number: '100', complement: '', isRatified: true }] },
  },
  SERVICE_QUOD_CREDIT_SCORE_PERSON: {
    summary: 'Retorna score de crédito de pessoa física pelo CPF informado, com nível de risco, classificação de risco, motivos do score e resumo textual da consulta.',
    result: { cpf: 'cpf', score: 680, riskLevel: 'MEDIO', riskClassification: 'B', reasonCodes: ['Tempo de relacionamento com o mercado', 'Renda declarada baixa'], creditBureauSummary: 'Score de crédito dentro da média do perfil', creditBureauDetails: {}, origin: 'Quod', queryDate: '2026-08-01' },
  },
  SERVICE_BOAVISTA_ONE_SCORE_PERSON: {
    summary: 'Retorna score de crédito multidados de pessoa física pelo CPF informado, com nível de risco, classificação de risco, motivos do score e resumo textual da consulta.',
    result: { cpf: 'cpf', score: 710, riskLevel: 'BAIXO', riskClassification: 'A', reasonCodes: ['Bom histórico de pagamentos'], creditBureauSummary: 'Score de crédito multidados acima da média do perfil', creditBureauDetails: {}, origin: 'Boa Vista', queryDate: '2026-08-01' },
  },
  SERVICE_BOAVISTA_CREDIT_SCORE_PERSON: {
    summary: 'Retorna dados restritivos de crédito de pessoa física pelo CPF informado, incluindo score, indicativo e quantidade de restrições encontradas.',
    result: { cpf: 'cpf', score: 705, hasRestrictions: false, restrictionCount: 0, creditBureauSummary: 'Nenhuma restrição de crédito encontrada', creditBureauDetails: {}, origin: 'Boa Vista', queryDate: '2026-08-01' },
  },
  SERVICE_QUOD_CREDIT_RISK_PERSON: {
    summary: 'Retorna flags negativos de crédito de pessoa física pelo CPF informado, com nível e classificação de risco, indicativo de restrições e quantidade de flags negativos.',
    result: { cpf: 'cpf', riskLevel: 'BAIXO', riskClassification: 'A', hasRestrictions: false, negativeFlagsCount: 0, creditBureauSummary: 'Nenhum flag negativo encontrado', creditBureauDetails: {}, origin: 'Quod', queryDate: '2026-08-01' },
  },
  SERVICE_ONDEMAND_TSE_POLLING_PLACE_PERSON_CPF: {
    summary: 'Retorna local de votação, situação eleitoral e biometria atual da pessoa no TSE, a partir do CPF informado.',
    result: { cpf: 'cpf', status: 'REGULAR', pollingPlace: 'ESCOLA CLASSE 01', pollingPlaceAddress: 'QUADRA 01, BRASILIA - DF', city: 'BRASILIA', uf: 'DF', zipcode: '70000000', electoralZone: '001', electoralSection: '0001', hasBiometrics: true, queryDate: '2026-08-01', source: 'TSE-LOCALVOTACAO', onlineQuery: 'Situação, local, endereço, zona e seção retornados com sucesso' },
  },
  SERVICE_ULTIMATE_BENEFICIAL_OWNERS: {
    summary: 'Retorna os beneficiários finais da empresa pelo CNPJ informado, com percentual de participação acumulado, inclusive por cadeias indiretas, conforme limiar legal de 25%.',
    result: { cnpj: 'cnpj', uboSummary: 'Consulta realizada', uboTotalCompaniesInGroup: 3, uboTotalPeopleInGroup: 5, uboNumberOfOwners: 2, uboBeneficialOwners: [{ name: 'NOME DO BENEFICIARIO', document: '00000000000', accumulatedPercentage: 45.5 }], uboParticipations: [{ ownerDocument: '00000000000', ownerName: 'NOME DO BENEFICIARIO', ownedDocument: 'cnpj', percentage: 45.5, level: 1 }] },
  },
  SERVICE_PUBLIC_PROJECTS: {
    summary: 'Retorna projetos com financiamento de órgãos públicos associados à empresa pelo CNPJ informado, com fonte, modalidade e valores contratado e desembolsado.',
    result: { cnpj: 'cnpj', totalPublicProjects: 1, publicProjectsSummary: 'Consulta realizada', publicProjects: [{ source: 'BNDES', modality: 'FINANCIAMENTO', contractedValue: 500000, disbursedValue: 250000, contractDate: '2025-01-10' }] },
  },
  SERVICE_PGFN_COMPANY: {
    summary: 'Retorna a certidão de débitos relativos a créditos tributários federais e à dívida ativa da união junto à PGFN, pelo CNPJ informado.',
    result: { cnpj: 'cnpj', pgfnSummary: 'Consulta realizada', pgfnBaseStatus: 'NEGATIVA', pgfnClearance: 'Sim', pgfnEmissionDate: '2026-08-01', pgfnCertificateUrl: 'https://example.com/certidao-pgfn.pdf' },
  },
  SERVICE_PCD_COMPANY: {
    summary: 'Retorna a certidão de cumprimento da cota legal de contratação de pessoas com deficiência e beneficiários reabilitados, pelo CNPJ informado.',
    result: { cnpj: 'cnpj', pcdSummary: 'Consulta realizada', pcdBaseStatus: 'EM CONFORMIDADE', pcdExpeditionDate: '2026-08-01', pcdCertificateUrl: 'https://example.com/certidao-pcd.pdf', pcdContent: 'Texto integral da certidão de cota de PCD' },
  },
  SERVICE_CIVIL_CONSTRUCTION: {
    summary: 'Retorna obras civis vinculadas ao CNPJ informado, conforme o Cadastro Nacional de Obras (CNO).',
    result: { cnpj: 'cnpj', totalCivilConstructionRecords: 2, totalActiveCivilConstructionRecords: 1, civilConstructionSummary: 'Consulta realizada', civilConstructionRecords: [{ cno: '00000000000', status: 'ATIVA', address: 'RUA EXEMPLO, 100', startDate: '2025-01-01' }] },
  },
  SERVICE_BOAVISTA_OWNER_PARTICIPATION_DATA_COMPANY: {
    summary: 'Retorna o percentual de participação societária de cada sócio da empresa pelo CNPJ informado.',
    result: { cnpj: 'cnpj', numberOfOwners: 2, numberOfPeopleAsOwners: 1, numberOfCompaniesAsOwners: 1, hasMajorityStakeHolder: true, averageParticipationPercentage: 50.0, maxParticipationPercentage: 70.0, minParticipationPercentage: 30.0, firstOwnerEntryDate: '2015-03-01', lastOwnerEntryDate: '2022-06-15', ownerParticipationSummary: 'Consulta realizada', ownerParticipations: [{ ownerDocument: '00000000000', ownerName: 'NOME DO SOCIO', percentage: 70.0 }] },
  },
  SERVICE_QUANTUM_CUSTOM_SCORE_COMPANY: {
    summary: 'Retorna score de crédito Quantum de pessoa jurídica pelo CNPJ informado, com resumo textual e dados estruturados de bureau de crédito.',
    result: { cnpj: 'cnpj', score: 690, creditBureauSummary: 'Score de crédito dentro da média do setor', creditBureauDetails: {}, origin: 'Quantum', queryDate: '2026-08-01' },
  },
  SERVICE_CGU_NEGATIVE_CERTIFICATE_COMPANY: {
    summary: 'Retorna a certidão negativa correcional da CGU pelo CNPJ informado, cobrindo punições vigentes em CEIS, CNEP e CEPIM.',
    result: { cnpj: 'cnpj', cguSummary: 'Consulta realizada', cguBaseStatus: 'NEGATIVA', cguClearance: 'Sim', cguValidUntil: '2027-08-01', cguIssueDate: '2026-08-01', cguCertificateUrl: 'https://example.com/certidao-cgu.pdf' },
  },
  SERVICE_CNJ_NEGATIVE_CERTIFICATE_COMPANY: {
    summary: 'Retorna a certidão negativa do CNJ pelo CNPJ informado, cobrindo condenações cíveis por improbidade administrativa e inelegibilidade.',
    result: { cnpj: 'cnpj', cnjSummary: 'Consulta realizada', cnjBaseStatus: 'NEGATIVA', cnjClearance: 'Sim', cnjIssueDate: '2026-08-01', cnjCertificateUrl: 'https://example.com/certidao-cnj.pdf' },
  },
  SERVICE_STATE_DEBT_CERTIFICATE_COMPANY: {
    summary: 'Retorna a certidão negativa de débitos estaduais pelo CNPJ informado, disponível para todos os estados.',
    result: { cnpj: 'cnpj', stateDebtSummary: 'Consulta realizada', stateDebtBaseStatus: 'NEGATIVA', stateDebtClearance: 'Sim', stateDebtState: 'SP', stateDebtRegistration: '000.000.000.000', stateDebtValidUntil: '2027-08-01', stateDebtCertificateUrl: 'https://example.com/certidao-debitos-estaduais.pdf' },
  },
  SERVICE_SIMPLES_COMPANY: {
    summary: 'Retorna a situação da empresa como optante pelo Simples Nacional e pelo SIMEI, pelo CNPJ informado.',
    result: { cnpj: 'cnpj', simplesSummary: 'Consulta realizada', simplesOfficialName: 'NOME OFICIAL DA EMPRESA', simplesNationalStatus: 'OPTANTE', simplesMeiStatus: 'NAO OPTANTE', simplesCertificateUrl: 'https://example.com/comprovante-simples.pdf' },
  },
  SERVICE_ECONOMIC_GROUP_KYC_COMPANY: {
    summary: 'Retorna indicadores agregados de KYC e compliance regulatório do grupo econômico completo do CNPJ informado, incluindo exposição política (PEP) e sanções.',
    result: { cnpj: 'cnpj', economicGroupKycSummary: 'Consulta realizada', economicGroupTotalCurrentPep: '0', economicGroupTotalHistoricalPep: '1', economicGroupTotalCurrentSanctioned: '0', economicGroupTotalHistoricalSanctioned: '0', economicGroupAverageSanctions: '0' },
  },
  SERVICE_MEDIA_PROFILE_EXPOSURE_PF: {
    summary: 'Retorna exposição e perfil de mídia da pessoa, com notícias, fontes, categorias, sentimento, relevância e alertas encontrados.',
    result: { cpf: 'cpf', mediaMentions: [{ title: 'Noticia encontrada', source: 'Fonte', sentiment: 'NEUTRAL' }], exposureLevel: 'LOW' },
  },
  SERVICE_MEDIA_PROFILE_EXPOSURE_PJ: {
    summary: 'Retorna exposição e perfil de mídia da empresa e sócios, com notícias, fontes, categorias, sentimento, relevância e alertas encontrados.',
    result: { cnpj: 'cnpj', mediaMentions: [{ title: 'Noticia encontrada', source: 'Fonte', sentiment: 'NEUTRAL' }], exposureLevel: 'LOW' },
  },
  SERVICE_MEI: {
    summary: 'Retorna empresas MEI associadas ao CPF, incluindo CNPJ, razao social, situacao, atividades, endereco e datas cadastrais quando disponiveis.',
    result: { cpf: 'cpf', meiCompanies: [{ cnpj: 'cnpj', officialName: 'MEI EXEMPLO', status: 'ATIVA' }] },
  },
  SERVICE_NOTHING_RECORD_LAWSUITS: {
    summary: 'Retorna certidao de nada consta para a esfera/tribunal informado, com status, mensagem, ocorrencias e dados usados na consulta.',
    result: { cpf: 'cpf', court: 'TRF1', sphere: 'CIVIL', nothingFound: true, records: [] },
  },
  SERVICE_OCR: {
    summary: 'Retorna dados extraidos de documentos de identificacao enviados por imagem, como RG/CIN, CNH, OAB, RNE/CRNM, passaporte ou identificacao automatica.',
    result: { cpf: 'cpf', docType: 'CNH', name: 'Nome extraído', birthDate: 'yyyy-MM-dd', cnhCategory: 'B', cnhNumber: '00000000000' },
  },
  SERVICE_OCR_CNPJ_CARD: {
    summary: 'Retorna dados extraídos do cartão CNPJ enviado por imagem, incluindo CNPJ, tipo do documento e texto OCR quando disponível.',
    result: { cnpj: 'cnpj', docType: 'CNPJ_CARD', genericOcr: 'texto extraído do cartão CNPJ' },
  },
  SERVICE_OCR_EMANCIPATION: {
    summary: 'Retorna texto OCR do documento de emancipacao e dados objetivos extraidos quando existirem, sem reprovar pela ausencia de campos variaveis.',
    result: { docType: 'EMANCIPATION_DOCUMENT', genericOcr: 'texto extraído', extractedFields: { cpf: 'cpf', dates: ['yyyy-MM-dd'] }, analysis: { isEmancipationRelated: true, confidence: 'MEDIUM' } },
  },
  SERVICE_OCR_PROOF_OF_ADDRESS: {
    summary: 'Retorna dados extraidos do comprovante de endereco por OCR, como texto OCR, nome, endereco, tipo do documento, datas e valores quando encontrados.',
    result: { genericOcr: 'texto extraído', fullName: 'Nome extraído', fullAddress: 'Endereço extraído', docType: 'Conta de consumo', dueDate: 'yyyy-MM-dd', invoiceAmount: 'R$ 100,00' },
  },
  SERVICE_ONDEMAND_SUS_CARD_PERSON_CPF: {
    summary: 'Retorna os dados do Cartão Nacional de Saúde (Cartão SUS) localizados para o CPF informado, com número do cartão, fonte e data da captura, dados de nascimento, indicação de evidência disponível e um resumo da consulta.',
    result: {
      cpf: 'cpf',
      sus_card_success: 'Sim',
      sus_card_number: '126000000000009',
      sus_card_source: 'BA',
      sus_card_capture_date: '08/25/2025 20:07:36',
      sus_card_birth_date: '03/13/1980 00:00:00',
      sus_card_birth_city: 'CHORROCHO',
      sus_card_birth_state: 'BA',
      sus_card_has_evidence: 'Não',
      sus_card_raw_result_file: 'https://example.com/documents/sus-card.pdf',
      sus_card_raw_result_file_type: 'pdf',
      sus_card_summary: 'Cartão SUS localizado',
    },
  },
  SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ: {
    summary: 'Retorna doacoes eleitorais feitas pelos socios da empresa, com socio relacionado, ano, candidato/partido, valor e detalhes eleitorais.',
    result: { cnpj: 'cnpj', ownersDonations: [{ ownerName: 'Nome do socio', year: 2024, recipient: 'Candidato', amount: '300.00' }] },
  },
  SERVICE_PEP: {
    summary: 'Retorna se o CPF e PEP ou relacionado a PEP, com cargo, orgao, nivel de exposicao, periodo e vinculos encontrados quando disponiveis.',
    result: { cpf: 'cpf', isPep: false, positions: [] },
  },
  SERVICE_PERSON_AI_PROMPT: {
    summary: 'Retorna uma resposta textual consolidada por IA a partir dos dados da pessoa, com resumo, pontos de atencao e leitura operacional.',
    result: { cpf: 'cpf', answer: 'Resumo analitico gerado pela IA', highlights: ['ponto relevante'] },
  },
  SERVICE_PERSON_DATA_ENRICHMENT: {
    summary: 'Retorna dados cadastrais do CPF, incluindo nome, nascimento, situacao cadastral, filiacao, obito, idade, genero e atributos disponiveis.',
    result: { cpf: 'cpf', name: 'Nome completo', birthDate: 'yyyy-MM-dd', status: 'REGULAR', motherName: 'Nome da mae' },
  },
  SERVICE_PERSON_DATA_MODELING: {
    summary: 'Retorna modelagem consolidada da pessoa, reunindo dados cadastrais, contatos, enderecos, vinculos, indicadores e resumos derivados.',
    result: { cpf: 'cpf', profileSummary: 'Resumo consolidado', contacts: [], addresses: [], relationships: [] },
  },
  SERVICE_PERSON_KYC: {
    summary: 'Retorna checagem de KYC da pessoa, incluindo PEP, sancoes, midia, processos, alertas de compliance e sinais de risco.',
    result: { cpf: 'cpf', isPep: false, sanctions: [], mediaExposure: [], riskAlerts: [] },
  },
  SERVICE_PF_FINANCIAL_AND_ADDRESS: {
    summary: 'Retorna dados financeiros e enderecos do CPF em uma consulta combinada, incluindo renda estimada, indicadores financeiros e enderecos encontrados.',
    result: { cpf: 'cpf', estimatedIncome: '5000-10000', addresses: [{ city: 'Sao Paulo', state: 'SP' }], financialIndicators: [] },
  },
  SERVICE_PHONE_HISTORY: {
    summary: 'Retorna historico de telefones associados ao CPF, incluindo numero, tipo de linha, operadora, prioridade, status e recencia quando disponiveis.',
    result: { cpf: 'cpf', phones: [{ phone: '11900000000', lineType: 'MOBILE', priority: 1, lastUpdate: 'yyyy-MM-dd' }] },
  },
  SERVICE_PIS_CONSULTATION: {
    summary: 'Retorna dados de PIS/NIS associados ao CPF, incluindo numero encontrado, status, dados cadastrais relacionados e mensagens da consulta.',
    result: { cpf: 'cpf', pis: '00000000000', status: 'FOUND' },
  },
  SERVICE_POLITICAL_INVOLVEMENT: {
    summary: 'Retorna envolvimento politico do CPF, incluindo candidaturas, cargos, doacoes, prestacoes de servico, partidos e vinculos politicos.',
    result: { cpf: 'cpf', politicalInvolvement: [{ type: 'CANDIDACY', year: 2024, details: 'Candidatura encontrada' }] },
  },
  SERVICE_POLITICAL_INVOLVEMENT_CPF: {
    summary: 'Retorna envolvimento politico do CPF, incluindo candidaturas, cargos, doacoes, prestacoes de servico, partidos e vinculos politicos.',
    result: { cpf: 'cpf', politicalInvolvement: [{ type: 'DONATION', year: 2024, details: 'Doacao encontrada' }] },
  },
  SERVICE_PROFESSIONAL_HISTORY: {
    summary: 'Retorna historico profissional do CPF, incluindo empresas, cargos, datas, vinculos empregaticios ou societarios e indicadores profissionais.',
    result: { cpf: 'cpf', professionalHistory: [{ companyName: 'Empresa Exemplo', role: 'Analista', startDate: 'yyyy-MM-dd' }] },
  },
  SERVICE_PROFESSIONAL_HISTORY_OWNER_ONLY: {
    summary: 'Retorna historico profissional em que a pessoa aparece como titular, socio ou proprietario, com empresas, cargos e datas de vinculo.',
    result: { cpf: 'cpf', ownerHistory: [{ companyName: 'Empresa Exemplo', cnpj: 'cnpj', qualification: 'SOCIO' }] },
  },
  SERVICE_PROTEST_CLEARANCE_CERTIFICATE: {
    summary: 'Retorna certidao/consulta de protestos para CPF, com status de nada consta ou lista de protestos, cartorio, valor e datas.',
    result: { cpf: 'cpf', hasProtests: false, protests: [] },
  },
  SERVICE_PROTEST_PF: {
    summary: 'Retorna certidao/consulta de protestos para CPF, com status, cartorios consultados, protestos e mensagens.',
    result: { cpf: 'cpf', hasProtests: false, notaryOffices: [], protests: [] },
  },
  SERVICE_PROTEST_PJ: {
    summary: 'Retorna certidao/consulta de protestos para CNPJ, com status, cartorios consultados, protestos, valores e datas.',
    result: { cnpj: 'cnpj', hasProtests: false, notaryOffices: [], protests: [] },
  },
  SERVICE_PUBLIC_SERVANTS: {
    summary: 'Retorna registros de servidor publico associados ao CPF, incluindo orgao, cargo, vinculo, remuneracao/faixa e periodo quando disponiveis.',
    result: { cpf: 'cpf', publicServantRecords: [{ agency: 'Orgao publico', role: 'Cargo', status: 'ACTIVE' }] },
  },
  SERVICE_RELATED_PEOPLE: {
    summary: 'Retorna pessoas relacionadas ao CPF, com nome, documento mascarado, tipo de relacao, nivel de proximidade e origem do vinculo.',
    result: { cpf: 'cpf', relatedPeople: [{ name: 'Pessoa relacionada', relationshipType: 'FAMILIAR', confidence: 'HIGH' }] },
  },
  SERVICE_REGISTRATION_DATA_CNPJ: {
    summary: 'Retorna dados cadastrais do CNPJ, incluindo razao social, nome fantasia, situacao, abertura, CNAEs, natureza juridica e endereco quando disponiveis.',
    result: { cnpj: 'cnpj', officialName: 'EMPRESA EXEMPLO LTDA', tradeName: 'EMPRESA EXEMPLO', status: 'ATIVA', openingDate: 'yyyy-MM-dd' },
  },
  SERVICE_RFB_PF: {
    summary: 'Retorna situacao do CPF na Receita Federal, incluindo nome, nascimento, status cadastral, comprovante/protocolo e dados fiscais disponiveis.',
    result: { cpf: 'cpf', name: 'Nome completo', birthDate: 'yyyy-MM-dd', status: 'REGULAR', protocol: 'protocolo' },
  },
  SERVICE_RFB_PF_ON_DEMAND: {
    summary: 'Retorna situacao atualizada do CPF consultada sob demanda na Receita Federal, com nome, nascimento, status cadastral e protocolo.',
    result: { cpf: 'cpf', name: 'Nome completo', birthDate: 'yyyy-MM-dd', status: 'REGULAR', protocol: 'protocolo' },
  },
  SERVICE_RFB_PJ: {
    summary: 'Retorna situacao do CNPJ na Receita Federal, incluindo razao social, nome fantasia, situacao cadastral, abertura, CNAEs e endereco.',
    result: { cnpj: 'cnpj', officialName: 'EMPRESA EXEMPLO LTDA', status: 'ATIVA', openingDate: 'yyyy-MM-dd', mainActivity: 'CNAE principal' },
  },
  SERVICE_RFB_PJ_ON_DEMAND: {
    summary: 'Retorna situacao atualizada do CNPJ consultada sob demanda na Receita Federal, com razao social, status cadastral, CNAEs e endereco.',
    result: { cnpj: 'cnpj', officialName: 'EMPRESA EXEMPLO LTDA', status: 'ATIVA', openingDate: 'yyyy-MM-dd', mainActivity: 'CNAE principal' },
  },
  SERVICE_SINTEGRA_CONSULTATION: {
    summary: 'Retorna dados do SINTEGRA, incluindo inscricao estadual, UF, situacao, regime, atividades, endereco e mensagens da consulta.',
    result: { cnpj: 'cnpj', stateRegistration: '000000000', state: 'SP', status: 'HABILITADO', regime: 'NORMAL' },
  },
  SERVICE_SOCIAL_ASSISTANCE_EXTENDED: {
    summary: 'Retorna benefícios sociais estendidos vinculados ao CPF, com programas, indicadores, situação e detalhes encontrados quando disponíveis.',
    result: { cpf: 'cpf', totalBenefits: 1, benefits: [{ program: 'Programa social', status: 'ACTIVE' }], indicators: [] },
  },
  SEVICE_ONLINE_BETTING_PROPENSITY: {
    summary: 'Retorna propensão do CPF a apostas online, com score, faixa de propensão, indicadores comportamentais e sinais associados quando disponíveis. Atenção: o alias é `SEVICE_ONLINE_BETTING_PROPENSITY` (sem a letra R em SERVICE); essa é a grafia implementada no backend, copie exatamente assim.',
    result: { cpf: 'cpf', propensityScore: 78, propensityLevel: 'HIGH', indicators: ['sinal encontrado'] },
  },
  SERVICE_QUOD_CREDIT_SCORE_COMPANY: {
    summary: 'Retorna score de crédito de pessoa jurídica pelo CNPJ informado, com nível de risco, classificação de risco, motivos do score e resumo textual da consulta.',
    result: { cnpj: 'cnpj', score: 650, riskLevel: 'MEDIO', riskClassification: 'B', reasonCodes: ['Tempo de mercado', 'Capital social baixo'], creditBureauSummary: 'Score de crédito dentro da média do setor', creditBureauDetails: {}, origin: 'Quod', queryDate: '2026-08-01' },
  },
  SERVICE_BOAVISTA_ONE_SCORE_COMPANY: {
    summary: 'Retorna score de crédito multidados de pessoa jurídica pelo CNPJ informado, com nível de risco, classificação de risco, motivos do score e resumo textual da consulta.',
    result: { cnpj: 'cnpj', score: 700, riskLevel: 'BAIXO', riskClassification: 'A', reasonCodes: ['Bom histórico de pagamentos'], creditBureauSummary: 'Score de crédito multidados acima da média do setor', creditBureauDetails: {}, origin: 'Boa Vista', queryDate: '2026-08-01' },
  },
  SERVICE_BOAVISTA_CREDIT_SCORE_COMPANY: {
    summary: 'Retorna dados restritivos de crédito de pessoa jurídica pelo CNPJ informado, incluindo score, indicativo e quantidade de restrições encontradas.',
    result: { cnpj: 'cnpj', score: 720, hasRestrictions: false, restrictionCount: 0, creditBureauSummary: 'Nenhuma restrição de crédito encontrada', creditBureauDetails: {}, origin: 'Boa Vista', queryDate: '2026-08-01' },
  },
  SERVICE_QUOD_CREDIT_RISK_COMPANY: {
    summary: 'Retorna flags negativos de crédito de pessoa jurídica pelo CNPJ informado, com nível e classificação de risco, indicativo de restrições e quantidade de flags negativos.',
    result: { cnpj: 'cnpj', riskLevel: 'BAIXO', riskClassification: 'A', hasRestrictions: false, negativeFlagsCount: 0, creditBureauSummary: 'Nenhum flag negativo encontrado', creditBureauDetails: {}, origin: 'Quod', queryDate: '2026-08-01' },
  },
  SERVICE_ECONOMIC_GROUP_RELATIONSHIPS: {
    summary: 'Retorna as entidades (pessoas e empresas) que integram o mesmo grupo econômico do CNPJ consultado, com relacionamentos atuais, históricos e estatísticas agregadas.',
    result: { cnpj: 'cnpj', totalEconomicGroupRelationships: 3, economicGroupRelationshipsSummary: 'Empresa possui 3 relacionamentos de grupo econômico', economicGroupRelationships: [], economicGroupCurrentRelationships: [], economicGroupHistoricalRelationships: [], economicGroupRelationshipsStats: {} },
  },
  SERVICE_REPUTATIONS_AND_REVIEWS: {
    summary: 'Retorna a reputação da empresa em diferentes plataformas de avaliação de serviços, com visão consolidada, detalhamento por fonte e histórico de evolução.',
    result: { cnpj: 'cnpj', totalReputationSources: 2, reputationSummary: 'Empresa possui avaliações em 2 plataformas', reputationAndReviews: [], reputationSummaryDetails: {}, reputationSummaryByDataSources: {} },
  },
  SERVICE_INVESTMENT_FUND_DATA: {
    summary: 'Retorna informações cadastrais e operacionais de fundos de investimento associados ao CNPJ, conforme registros da CVM.',
    result: { cnpj: 'cnpj', totalMovimentations: 0, investmentFundDataSummary: 'Nenhuma movimentação de fundo de investimento encontrada', investmentFundData: [] },
  },
  SERVICE_OWNERS_INFLUENCE: {
    summary: 'Retorna o nível de influência inferido do quadro societário da empresa, considerando exposição na mídia, envolvimento político e histórico de processos dos sócios.',
    result: { cnpj: 'cnpj', influenceScore: 0, ownersInfluenceSummary: 'Baixa influência do quadro societário', ownersInfluence: [] },
  },
  SERVICE_PGMEI: {
    summary: 'Retorna o Documento de Arrecadação do Simples Nacional (DAS) para Microempreendedores Individuais (MEI), com situação, ano de referência, guias pendentes e histórico mensal de arrecadação.',
    result: { cnpj: 'cnpj', pgmeiStatus: 'Optante', pgmeiReferenceYear: '2026', pgmeiPendingGuides: 0, pgmeiSummary: 'MEI optante e regular no ano de referência', pgmeiGuides: [] },
  },
  SERVICE_FGTS: {
    summary: 'Retorna a certidão de regularidade do empregador perante o FGTS, com status, número e validade da certidão e conteúdo textual emitido.',
    result: { cnpj: 'cnpj', fgtsStatus: 'REGULAR', fgtsCertificateNumber: '2026000000000000', fgtsCertificateValidity: '01/08/2026 a 29/08/2026', fgtsCertificateText: 'Certificado que a empresa encontra-se em situação regular perante o FGTS', fgtsSummary: 'Empresa regular perante o FGTS', fgtsDetails: [] },
  },
  SERVICE_MARKETPLACE_DATA: {
    summary: 'Retorna a presença da empresa em marketplaces, incluindo lojas operadas, produtos listados, marketplace com mais produtos e melhor avaliação.',
    result: { cnpj: 'cnpj', totalMarketplacesUsed: 1, totalStoresOperated: 1, marketplaceWithMostProducts: 'Mercado Livre', marketplaceWithBestRating: 'Mercado Livre', totalProductsListed: 0, marketplaceSummary: 'Empresa presente em 1 marketplace', marketplaceDetails: [] },
  },
  SERVICE_ONLINE_ADS: {
    summary: 'Retorna anúncios online vinculados à empresa, identificando perfis de vendedor em portais de classificados e marketplaces peer-to-peer por telefone.',
    result: { cnpj: 'cnpj', onlineAdsTotalPhones: 0, onlineAdsSummary: 'Nenhum anúncio online encontrado', onlineAds: [] },
  },
  SERVICE_RF_QSA: {
    summary: 'Retorna o quadro societário-administrativo (QSA) do CNPJ informado, com dados cadastrais da matriz (porte, capital, CNAE, natureza jurídica, situação cadastral) e a lista de sócios e administradores.',
    result: { cnpj: 'cnpj', qsaCompanyType: 'MATRIZ', qsaCompanySize: 'DEMAIS', qsaCapital: 'DEZ MIL REAIS', qsaCapitalValue: '10000.00', qsaCnae: '62.09-1-00', qsaMainEconomicActivity: 'SUPORTE TECNICO, MANUTENCAO E OUTROS SERVICOS EM TECNOLOGIA DA INFORMACAO', qsaSecondaryActivity: 'DESENVOLVIMENTO DE PROGRAMAS DE COMPUTADOR SOB ENCOMENDA', qsaLegalNatureCode: '2062', qsaLegalNature: 'SOCIEDADE EMPRESARIA LIMITADA', qsaIrsStatus: 'ATIVA', qsaIsActive: 'true', qsaStatusDate: '2018-04-04', qsaPartnersCount: 1, qsaSummary: 'Empresa ativa com 1 sócio encontrado no QSA', qsaPartners: [] },
  },
  SERVICE_OWNERS_LAWSUITS_DISTRIBUTION: {
    summary: 'Retorna dados agregados sobre a distribuição de processos judiciais nos quais os sócios da empresa consultada estão envolvidos, com estatísticas por período e papel na ação.',
    result: { cnpj: 'cnpj', companyOwnersLawsuitsTotalOwners: 2, companyOwnersLawsuitsMaxPerOwner: 3, companyOwnersLawsuitsAvgPerOwner: 1.5, companyOwnersLawsuitsMinPerOwner: 0, companyOwnersLawsuitsAsAuthor: 1, companyOwnersLawsuitsAsDefendant: 2, companyOwnersLawsuitsAsOther: 0, companyOwnersLawsuitsTotal: 3, companyOwnersLawsuitsRelatedToLawyers: false, companyOwnersLawsuitsRelatedToJudges: false, companyOwnersLawsuitsFirstDate: '2015-01-01', companyOwnersLawsuitsLastDate: '2026-01-01', companyOwnersLawsuitsLast30Days: 0, companyOwnersLawsuitsLast90Days: 0, companyOwnersLawsuitsLast180Days: 0, companyOwnersLawsuitsLast365Days: 1, companyOwnersLawsuitsSummary: 'Sócios com 3 processos judiciais encontrados', companyOwnersLawsuitsDistribution: {} },
  },
  SERVICE_LAWSUITS_DISTRIBUTION_DATA_COMPANY: {
    summary: 'Retorna dados agregados sobre a distribuição de processos judiciais nos quais a empresa consultada está envolvida, com estatísticas por período.',
    result: { cnpj: 'cnpj', companyLawsuitsTotal: 5, companyLawsuitsFirstDate: '2016-03-10', companyLawsuitsLastDate: '2026-02-20', companyLawsuitsLast30Days: 0, companyLawsuitsLast90Days: 1, companyLawsuitsLast180Days: 1, companyLawsuitsLast365Days: 2, companyLawsuitsSummary: 'Empresa com 5 processos judiciais encontrados', companyLawsuitsDistribution: {} },
  },
  SERVICE_LABOR_LAWSUITS: {
    summary: 'Retorna certidão on-demand informando se há processos trabalhistas tramitando relacionados à empresa consultada, físicos ou eletrônicos.',
    result: { cnpj: 'cnpj', laborLawsuitsStatus: 'NADA CONSTA', laborLawsuitsProtocol: '2026000000000', laborLawsuitsCertificateNumber: '00000000/2026', laborLawsuitsIssuedDate: '2026-08-01', laborLawsuitsContent: 'Certifica-se que nada consta em nome da empresa quanto a ações trabalhistas', laborLawsuitsProcessesCount: 0, laborLawsuitsSummary: 'Nada consta de ações trabalhistas', laborLawsuitsProcesses: [] },
  },
  SERVICE_EMPLOYEES_KYC: {
    summary: 'Retorna indicadores de KYC e compliance regulatório dos funcionários vinculados à empresa, incluindo classificações de PEP e sanções nacionais e internacionais.',
    result: { cnpj: 'cnpj', employeesKycTotalEmployees: 5, employeesKycCurrentlyPepCount: 0, employeesKycCurrentlySanctionedCount: 0, employeesKycPreviouslySanctionedCount: 0, employeesKycFlaggedCount: 0, employeesKycSummary: 'Nenhum funcionário sinalizado como PEP ou sancionado', employeesKycFlagged: [] },
  },
  SERVICE_HISTORY_BASIC_DATA: {
    summary: 'Retorna o histórico de alterações cadastrais básicas do CNPJ: nome, regime tributário, situação cadastral, CNAE e capital social.',
    result: { cnpj: 'cnpj', historyBasicDataCurrentName: 'EMPRESA EXEMPLO LTDA', historyBasicDataAge: 6, historyBasicDataTotalChanges: 2, historyBasicDataSummary: 'Empresa com 2 alterações cadastrais encontradas', historyBasicDataStats: [], historyBasicDataNameHistory: [], historyBasicDataTaxRegimeHistory: [], historyBasicDataTaxIdStatusHistory: [], historyBasicDataCnaeHistory: [], historyBasicDataCapitalHistory: [] },
  },
  SERVICE_MERCHANT_CATEGORY_DATA: {
    summary: 'Retorna a categorização da empresa de acordo com o MCC (Merchant Category Code), por associação direta com a Abecs ou inferido pelo CNAE.',
    result: { cnpj: 'cnpj', merchantCategoryHasDirectAssociation: 'false', merchantCategoryHasMultipleCodes: 'false', merchantCategorySummary: 'Categoria comercial inferida pelo CNAE', merchantCategoryCategories: [], merchantCategoryCnaeCategories: [] },
  },
  SERVICE_SYNDICATE_AGREEMENTS: {
    summary: 'Retorna os acordos sindicais firmados entre a empresa e os sindicatos que representam seus funcionários, com totais e detalhamento.',
    result: { cnpj: 'cnpj', syndicateAgreementsTotal: 1, syndicateAgreementsTotalActive: 1, syndicateAgreementsSummary: 'Empresa com 1 acordo sindical ativo', syndicateAgreementsStats: [], syndicateAgreements: [] },
  },
  SERVICE_PHONES_EXTENDED_COMPANY: {
    summary: 'Retorna os telefones associados à empresa, com indicadores de validade, prioridade e origem.',
    result: { cnpj: 'cnpj', phonesExtendedCompanyTotal: 2, phonesExtendedCompanyTotalActive: 1, phonesExtendedCompanySummary: 'Empresa com 2 telefones encontrados, 1 ativo', phonesExtendedCompanyStats: [], phonesExtendedCompany: [] },
  },
  SERVICE_COMPANY_EVOLUTION: {
    summary: 'Retorna a evolução temporal de capital, quantidade de funcionários, filiais e sócios da empresa, com tendência de crescimento.',
    result: { cnpj: 'cnpj', companyEvolutionSummary: 'Empresa com tendência de crescimento estável', companyEvolutionStats: [] },
  },
};

const serviceReturnDetailsEn = {
  SERVICE_ACTIVE_DEBT_PF: {
    summary: 'Returns active debts linked to the CPF, with debt origin, amounts, status, creditor agency and query status.',
  },
  SERVICE_ACTIVE_DEBT_PJ: {
    summary: 'Returns active debts linked to the CNPJ, with debt origin, amounts, status, creditor agency and query status.',
  },
  SERVICE_ACTIVITIES_INDICATORS: {
    summary: 'Returns activity indicators linked to the CPF, such as professional signals, segments, occupations and available records.',
    result: { cpf: 'cpf', activityIndicators: [{ type: 'PROFESSIONAL', description: 'Indicator found' }], hasActivityIndicators: true },
  },
  SERVICE_ADDRESS: {
    summary: 'Returns addresses associated with the CPF, including street, number, neighborhood, city, state, zip code, country, type and freshness indicators when available.',
    result: { cpf: 'cpf', totalAddresses: 2, addresses: [{ address: 'Example Street', number: '100', neighborhood: 'Centro', city: 'Sao Paulo', state: 'SP', zipcode: '01001000' }] },
  },
  SERVICE_ADDRESSES_EXTENDED_CNPJ: {
    summary: 'Returns the full list of CNPJ addresses in result.addresses (street, number, complement, neighborhood, city, state, country, zip code, type, whether it is active and whether it is the primary one), plus an aggregated summary in result.addressesExtendedTotal* with totals and dates of the first/last confirmed passage.',
    result: {
      cnpj: 'cnpj',
      addresses: [{
        address: 'Example Ave', number: '1000', complement: 'Suite 10', neighborhood: 'Centro', city: 'Sao Paulo', state: 'SP',
        country: 'Brazil', zipcode: '01001000', addressType: 'COMMERCIAL', isActive: 'true', isMainForEntity: 'true',
        priority: '1', lastValidationDate: '2026-05-12',
      }],
      addressesExtendedTotal: 1,
      addressesExtendedTotalActive: 1,
      addressesExtendedTotalWork: 1,
      addressesExtendedTotalPersonal: 0,
      addressesExtendedTotalUnique: 1,
      addressesExtendedTotalPassages: 7,
      addressesExtendedTotalBadPassages: 0,
      addressesExtendedOldestPassageDate: '2018-02-10',
      addressesExtendedNewestPassageDate: '2026-05-12',
    },
  },
  SERVICE_ARREST_WARRANT: {
    summary: 'Returns arrest warrant indicators for the informed data, with status, agency, case and details found when there is an occurrence.',
  },
  SERVICE_AWARDS_AND_CERTIFICATIONS_CPF: {
    summary: 'Returns the count and records of awards and certifications found for the CPF, when the queried database has data.',
  },
  SERVICE_COMPANY_KYC_OWNERS: {
    summary: 'Returns an aggregated KYC/compliance summary for the company (totalCurrentPep, totalCurrentSanctioned, averageSanctionsPerOwner, pepPercentage) and the individual breakdown for each partner in result.kycOwners/companyOwners/peopleOwners, including sanctionsHistory (full history), highConfidenceSanctionsHistory (only sanctions with matchRate above 90) and pepHistories.',
    result: {
      cnpj: 'cnpj',
      totalCurrentPep: 1,
      totalHistoricallyPEP: 1,
      totalCurrentSanctioned: 1,
      totalHistoricallySanctioned: 1,
      averageSanctionsPerOwner: 1,
      averageSanctionsPerOwnerExact: 0.5,
      pepPercentage: 50.0,
      ownerMaxSanctions: 1,
      ownerMinSanctions: 0,
      activeOwners: ['11122233344', '55566677788'],
      inactiveOwners: [],
      kycOwners: [
        {
          cpf: '11122233344',
          isPep: true,
          isCurrentlySanctioned: true,
          wasPreviouslySanctioned: true,
          firstSanctionDate: '2021-03-15',
          lastSanctionDate: '2024-08-02',
          firstPepOccurrenceDate: '2019-01-10',
          lastPepOccurrenceDate: '2024-08-02',
          sanctionsHistory: [{
            source: 'interpol', type: 'RED_NOTICE', standardizedSanctionType: 'INTERNATIONAL_ALERT', matchRate: 96,
            details: { Charge: 'Fraud', IssuingCountry: 'Brazil' }, normalizedDetails: { acusacao: 'Fraud', paisEmissor: 'Brazil' },
            startDate: '2021-03-15', endDate: null, isCurrentlyPresentOnSource: true,
          }],
          highConfidenceSanctionsHistory: [{
            source: 'interpol', type: 'RED_NOTICE', standardizedSanctionType: 'INTERNATIONAL_ALERT', matchRate: 96,
            details: { Charge: 'Fraud', IssuingCountry: 'Brazil' }, normalizedDetails: { acusacao: 'Fraud', paisEmissor: 'Brazil' },
            startDate: '2021-03-15', endDate: null, isCurrentlyPresentOnSource: true,
          }],
          pepHistories: [{ level: 'FEDERAL', jobTitle: 'Secretary', department: 'Example Ministry', startDate: '2019-01-10', endDate: null }],
          isCurrentlyElectoralDonor: false,
          isHistoricalElectoralDonor: true,
          totalElectoralDonations: 2,
          totalElectoralDonationAmount: 15000.0,
        },
        {
          cpf: '55566677788',
          isPep: false,
          isCurrentlySanctioned: false,
          wasPreviouslySanctioned: false,
          sanctionsHistory: [],
          highConfidenceSanctionsHistory: [],
          pepHistories: [],
        },
      ],
    },
  },
  SERVICE_COMPANY_RELATIONSHIP: {
    summary: 'Returns company relationships, such as partners, owners, related companies, holdings and identified corporate ties.',
    result: { cnpj: 'cnpj', owners: [{ name: 'Partner name', document: 'cpf', share: '50%' }], relatedCompanies: [] },
  },
  SERVICE_COMPANY_RFB_OWNERS: {
    summary: 'Returns the corporate structure at the Federal Revenue, with partner names, masked documents, qualification, share and entry date when available.',
    result: { cnpj: 'cnpj', owners: [{ name: 'Partner name', qualification: 'SOCIO-ADMINISTRADOR', entryDate: 'yyyy-MM-dd' }] },
  },
  SERVICE_COMPLIANCE_BET: {
    summary: 'Returns indicators of the company\'s exposure to betting and regulatory compliance, including signals of operation, domain, activity and alerts.',
    result: { cnpj: 'cnpj', hasBettingExposure: true, indicators: ['related activity'], riskLevel: 'MEDIUM' },
  },
  SERVICE_COMPLIANCE_BET_PJ: {
    summary: 'Returns indicators of the company\'s exposure to betting and regulatory compliance, including signals of operation, domain, activity and alerts.',
    result: { cnpj: 'cnpj', hasBettingExposure: true, indicators: ['related activity'], riskLevel: 'MEDIUM' },
  },
  SERVICE_CONFIRM_PHONE: {
    summary: 'Returns data associated with the informed phone number, such as a possible holder, related document, confirmation status and available attributes.',
    result: { phone: '+5561123456789', matched: true, person: { name: 'Name found', document: 'cpf' } },
  },
  SERVICE_CORPORATE_DATA_ENRICHMENT: {
    summary: 'Returns the complete company registration, including legal name, trade name, registration status, CNAE codes, legal nature, size, capital and address.',
    result: { cnpj: 'cnpj', officialName: 'EXAMPLE COMPANY LTD', tradeName: 'EXAMPLE COMPANY', status: 'ATIVA', mainActivity: 'Main CNAE' },
  },
  SERVICE_CPF_ADDRESS_VALIDATION: {
    summary: 'Returns whether the informed address is associated with the CPF, including match level, normalized address and signals used in the validation.',
    result: { cpf: 'cpf', zipcode: '01001000', match: true, confidence: 'HIGH', normalizedAddress: 'Example Street, 100' },
  },
  SERVICE_CPF_PHONE_VALIDATION: {
    summary: 'Returns the validation of the association between CPF and phone number, with match status, query message and data returned by the query.',
  },
  SERVICE_CREDIT_RISK_COMPANY: {
    summary: 'Returns business (PJ) credit risk data, with score, rating, expected risk and legal signals when available.',
  },
  SERVICE_CREDIT_SCORE: {
    summary: 'Returns the credit score associated with the CPF, with the score, risk band and query message when available.',
  },
  SERVICE_CRIMINAL_RECORD_CIVIL: {
    summary: 'Returns the civil criminal record result, with certificate status, occurrences found, state, RG and query messages.',
  },
  SERVICE_CRIMINAL_RECORD_FEDERAL: {
    summary: 'Returns the federal criminal record result, with certificate status, occurrences found and query messages.',
  },
  SERVICE_DAS_MEI: {
    summary: 'Returns MEI DAS information and related tax status linked to the CNPJ, including periods, payments, pending items and status when available.',
  },
  SERVICE_DATAVALID_CNH: {
    summary: 'Returns CNH document validation, including biometric score, facial similarity, validation status and checked fields.',
  },
  SERVICE_DEFAULT_RISK_SCORE: {
    summary: 'Returns the default risk score for the CPF, with the score, risk band and estimated probability when available.',
  },
  SERVICE_DEMOGRAPHIC_DATA_CPF: {
    summary: 'Returns demographic data associated with the CPF, with regional data, estimates and indicators returned by the queried database.',
    result: { cpf: 'cpf', demographicData: [{ indicator: 'Income bracket', value: 'Medium' }], totalIndicators: 1 },
  },
  SERVICE_DIGITAL_DOCUMENTOSCOPY: {
    summary: 'Returns the documentoscopy status, query key, data extracted from the document, document/selfie validations and the approval result.',
    result: { key: '{key}', status: 'APPROVED', documentData: { name: 'Extracted name', cpf: 'cpf' }, validations: [{ name: 'faceMatch', status: 'APPROVED' }] },
  },
  SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT: {
    summary: 'Returns the already processed documentoscopy result by the informed key, with status, extracted fields, evaluated rules and evidence.',
  },
  SERVICE_DOMAINS_CNPJ: {
    summary: 'Returns domains, sites and digital signals associated with the CNPJ, including the count and records found when available.',
  },
  SERVICE_DOMAINS_CPF: {
    summary: 'Returns domains, sites and digital signals associated with the CPF, including the count and records found when available.',
  },
  SERVICE_ECONOMIC_RELATIONSHIP: {
    summary: 'Returns economic relationships associated with the CPF, such as related companies, holdings, professional relations and relationship indicators.',
    result: { cpf: 'cpf', relationships: [{ type: 'OWNER', relatedDocument: 'cnpj', relatedName: 'Related company' }] },
  },
  SERVICE_ELECTION_CANDIDATE_DATA_CPF: {
    summary: 'Returns the CPF\'s electoral candidacy history, including role, party, year, electoral unit, declared assets and status when available.',
    result: { cpf: 'cpf', candidacies: [{ year: 2024, role: 'VEREADOR', party: 'PARTY', status: 'DEFERIDO' }] },
  },
  SERVICE_ELECTORAL_DONORS_CNPJ: {
    summary: 'Returns electoral donations made by the company, with year, candidate/party, amount, role, state and accountability details.',
    result: { cnpj: 'cnpj', donations: [{ year: 2024, recipient: 'Candidate', amount: '1000.00' }] },
  },
  SERVICE_ELECTORAL_DONORS_CPF: {
    summary: 'Returns electoral donations made by the CPF, with year, candidate/party, amount, role, state and accountability details.',
    result: { cpf: 'cpf', donations: [{ year: 2024, recipient: 'Candidate', amount: '500.00' }] },
  },
  SERVICE_ELECTORAL_PROVIDERS_CNPJ: {
    summary: 'Returns electoral service provisions linked to the CNPJ, with campaign, candidate/party, amount, year and service nature.',
    result: { cnpj: 'cnpj', campos: [{ year: 2024, campaign: 'Campaign', amount: '2500.00', serviceType: 'Service' }] },
  },
  SERVICE_ELECTORAL_PROVIDERS_CPF: {
    summary: 'Returns electoral service provisions linked to the CPF, with campaign, candidate/party, amount, year and service nature.',
    result: { cpf: 'cpf', campos: [{ year: 2024, campaign: 'Campaign', amount: '800.00', serviceType: 'Service' }] },
  },
  SERVICE_EMAILS_EXTENDED: {
    summary: 'Returns emails associated with the CPF, including priority, validation status, source, update date and usage signals when available.',
  },
  SERVICE_EMAIL_VALIDATION: {
    summary: 'Returns the validation of the informed email, including format, likely existence, domain, deliverability and risk indicators.',
  },
  SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION: {
    summary: 'Returns eSocial registration qualification, with the consistency status between CPF, NIT/PIS and informed registration data.',
  },
  SERVICE_FACE_MATCH: {
    summary: 'Returns the facial comparison between two images, with a similarity score, match status and approval/rejection message.',
  },
  SERVICE_FACE_INDEX: {
    summary: 'Searches for a selfie in the indexed face database and returns whether a face was found, the associated CPF and the similarity when available.',
  },
  SERVICE_FAMILY_POLITICAL_HISTORY_CPF: {
    summary: 'Returns the CPF\'s family political history, including relatives with candidacies, donations, positions, parties and electoral ties when found.',
    result: { cpf: 'cpf', familyPoliticalHistory: [{ relativeName: 'Related name', relationship: 'PARENTE', role: 'Candidate' }] },
  },
  SERVICE_FAMILY_SOCIAL_BENEFITS: {
    summary: 'Returns family social benefits linked to the CPF, with programs, status, count and records found when available.',
    result: { cpf: 'cpf', totalBenefits: 1, benefits: [{ program: 'Social program', status: 'ACTIVE' }] },
  },
  SERVICE_FINANCIAL_INFORMATION: {
    summary: 'Returns estimated financial information for the CPF, such as presumed income, purchasing power, economic class and available financial indicators.',
  },
  SERVICE_FINANCIAL_RISK_SCORE: {
    summary: 'Returns the CPF\'s financial risk score, risk band, a short recommendation and the factors that influence the assessment.',
  },
  SERVICE_FIRST_LEVEL_PARTNER: {
    summary: 'Returns the company\'s first-level partners, with name, document, share, qualification and direct ties to the CNPJ.',
    result: { cnpj: 'cnpj', partners: [{ name: 'Partner name', document: 'cpf', level: 1, qualification: 'SOCIO' }] },
  },
  SERVICE_FRAUD_RISK_SCORE: {
    summary: 'Returns the CPF\'s fraud risk score, the analyzed factor, risk level, numeric score and signals supporting the decision.',
  },
  SERVICE_JURIDICAL_PROCESSES: {
    summary: 'Returns legal and administrative proceedings linked to the CPF, with court, class, subject, parties, status and dates when available.',
  },
  SERVICE_JURIDICAL_PROCESSES_PJ: {
    summary: 'Returns legal proceedings linked to the CNPJ, with court, class, subject, parties, status, case number and dates when available.',
  },
  SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS: {
    summary: 'Returns legal proceedings associated with the company\'s partners, with the related partner, court, class, subject, status and dates.',
    result: { cnpj: 'cnpj', ownersProcesses: [{ ownerName: 'Partner name', totalProcesses: 1, processes: [] }] },
  },
  SERVICE_RELATED_PEOPLE_EMAILS: {
    summary: 'Returns emails associated with people related to the informed CPF, with the identified relationship and usage signals for each email.',
    result: { cpf: 'cpf', totalRelatedPeopleEmails: 2, relatedPeopleEmailsList: 'name@email.com - PERSON NAME - 00000000000 - CONJUGE', relatedPeopleEmails: [{ relatedCpf: '00000000000', relatedName: 'PERSON NAME', relationship: 'CONJUGE', type: 'PESSOAL', isMain: true, isRecent: true, isActive: true, email: 'name@email.com', domain: 'email.com', validationStatus: 'VALID' }] },
  },
  SERVICE_RELATED_PEOPLE_PHONES: {
    summary: 'Returns phone numbers associated with people related to the informed CPF, with the identified relationship and usage signals for each phone number.',
    result: { cpf: 'cpf', totalRelatedPeoplePhones: 1, relatedPeoplePhonesList: '11900000000 - PERSON NAME - 00000000000 - FILHO', relatedPeoplePhones: [{ relatedCpf: '00000000000', relatedName: 'PERSON NAME', relationship: 'FILHO', type: 'CELULAR', isMain: true, isRecent: true, isActive: true, areaCode: '11', number: '900000000', phone: '11900000000', isInDoNotCallList: false }] },
  },
  SERVICE_RELATED_PEOPLE_ADDRESSES: {
    summary: 'Returns addresses associated with people related to the informed CNPJ, with the identified relationship and usage signals for each address.',
    result: { cnpj: 'cnpj', totalRelatedPeopleAddresses: 1, relatedPeopleAddressesList: 'EXAMPLE STREET, 100 - PERSON NAME - 00000000000 - SOCIO', relatedPeopleAddresses: [{ relatedCpf: '00000000000', relatedName: 'PERSON NAME', relationship: 'SOCIO', type: 'RESIDENCIAL', isMain: true, isRecent: true, isActive: true, address: 'EXAMPLE STREET', zipcode: '00000000', state: 'SP', city: 'SAO PAULO', neighborhood: 'CENTRO', number: '100', complement: '', isRatified: true }] },
  },
  SERVICE_QUOD_CREDIT_SCORE_PERSON: {
    summary: 'Returns the individual\'s credit score by the informed CPF, with risk level, risk classification, score reasons and a text summary of the query.',
    result: { cpf: 'cpf', score: 680, riskLevel: 'MEDIO', riskClassification: 'B', reasonCodes: ['Tempo de relacionamento com o mercado', 'Renda declarada baixa'], creditBureauSummary: 'Score de crédito dentro da média do perfil', creditBureauDetails: {}, origin: 'Quod', queryDate: '2026-08-01' },
  },
  SERVICE_BOAVISTA_ONE_SCORE_PERSON: {
    summary: 'Returns the individual\'s multi-data credit score by the informed CPF, with risk level, risk classification, score reasons and a text summary of the query.',
    result: { cpf: 'cpf', score: 710, riskLevel: 'BAIXO', riskClassification: 'A', reasonCodes: ['Bom histórico de pagamentos'], creditBureauSummary: 'Score de crédito multidados acima da média do perfil', creditBureauDetails: {}, origin: 'Boa Vista', queryDate: '2026-08-01' },
  },
  SERVICE_BOAVISTA_CREDIT_SCORE_PERSON: {
    summary: 'Returns individual restrictive credit data by the informed CPF, including score, indicator and count of restrictions found.',
    result: { cpf: 'cpf', score: 705, hasRestrictions: false, restrictionCount: 0, creditBureauSummary: 'Nenhuma restrição de crédito encontrada', creditBureauDetails: {}, origin: 'Boa Vista', queryDate: '2026-08-01' },
  },
  SERVICE_QUOD_CREDIT_RISK_PERSON: {
    summary: 'Returns individual negative credit flags by the informed CPF, with risk level and classification, a restrictions indicator and the count of negative flags.',
    result: { cpf: 'cpf', riskLevel: 'BAIXO', riskClassification: 'A', hasRestrictions: false, negativeFlagsCount: 0, creditBureauSummary: 'Nenhum flag negativo encontrado', creditBureauDetails: {}, origin: 'Quod', queryDate: '2026-08-01' },
  },
  SERVICE_ONDEMAND_TSE_POLLING_PLACE_PERSON_CPF: {
    summary: 'Returns the polling place, electoral status and current biometrics of the person at the TSE, from the informed CPF.',
    result: { cpf: 'cpf', status: 'REGULAR', pollingPlace: 'ESCOLA CLASSE 01', pollingPlaceAddress: 'QUADRA 01, BRASILIA - DF', city: 'BRASILIA', uf: 'DF', zipcode: '70000000', electoralZone: '001', electoralSection: '0001', hasBiometrics: true, queryDate: '2026-08-01', source: 'TSE-LOCALVOTACAO', onlineQuery: 'Situação, local, endereço, zona e seção retornados com sucesso' },
  },
  SERVICE_ULTIMATE_BENEFICIAL_OWNERS: {
    summary: 'Returns the company\'s ultimate beneficial owners by the informed CNPJ, with accumulated ownership percentage, including through indirect chains, per the 25% legal threshold.',
    result: { cnpj: 'cnpj', uboSummary: 'Consulta realizada', uboTotalCompaniesInGroup: 3, uboTotalPeopleInGroup: 5, uboNumberOfOwners: 2, uboBeneficialOwners: [{ name: 'BENEFICIAL OWNER NAME', document: '00000000000', accumulatedPercentage: 45.5 }], uboParticipations: [{ ownerDocument: '00000000000', ownerName: 'BENEFICIAL OWNER NAME', ownedDocument: 'cnpj', percentage: 45.5, level: 1 }] },
  },
  SERVICE_PUBLIC_PROJECTS: {
    summary: 'Returns projects funded by public agencies associated with the company by the informed CNPJ, with source, modality and contracted/disbursed amounts.',
    result: { cnpj: 'cnpj', totalPublicProjects: 1, publicProjectsSummary: 'Consulta realizada', publicProjects: [{ source: 'BNDES', modality: 'FINANCIAMENTO', contractedValue: 500000, disbursedValue: 250000, contractDate: '2025-01-10' }] },
  },
  SERVICE_PGFN_COMPANY: {
    summary: 'Returns the certificate of debts related to federal tax credits and the union\'s active debt with the PGFN, by the informed CNPJ.',
    result: { cnpj: 'cnpj', pgfnSummary: 'Consulta realizada', pgfnBaseStatus: 'NEGATIVA', pgfnClearance: 'Sim', pgfnEmissionDate: '2026-08-01', pgfnCertificateUrl: 'https://example.com/certidao-pgfn.pdf' },
  },
  SERVICE_PCD_COMPANY: {
    summary: 'Returns the certificate of compliance with the legal quota for hiring people with disabilities and rehabilitated beneficiaries, by the informed CNPJ.',
    result: { cnpj: 'cnpj', pcdSummary: 'Consulta realizada', pcdBaseStatus: 'EM CONFORMIDADE', pcdExpeditionDate: '2026-08-01', pcdCertificateUrl: 'https://example.com/certidao-pcd.pdf', pcdContent: 'Texto integral da certidão de cota de PCD' },
  },
  SERVICE_CIVIL_CONSTRUCTION: {
    summary: 'Returns civil construction works linked to the informed CNPJ, per the National Works Registry (CNO).',
    result: { cnpj: 'cnpj', totalCivilConstructionRecords: 2, totalActiveCivilConstructionRecords: 1, civilConstructionSummary: 'Consulta realizada', civilConstructionRecords: [{ cno: '00000000000', status: 'ATIVA', address: 'EXAMPLE STREET, 100', startDate: '2025-01-01' }] },
  },
  SERVICE_BOAVISTA_OWNER_PARTICIPATION_DATA_COMPANY: {
    summary: 'Returns the ownership share percentage of each of the company\'s partners by the informed CNPJ.',
    result: { cnpj: 'cnpj', numberOfOwners: 2, numberOfPeopleAsOwners: 1, numberOfCompaniesAsOwners: 1, hasMajorityStakeHolder: true, averageParticipationPercentage: 50.0, maxParticipationPercentage: 70.0, minParticipationPercentage: 30.0, firstOwnerEntryDate: '2015-03-01', lastOwnerEntryDate: '2022-06-15', ownerParticipationSummary: 'Consulta realizada', ownerParticipations: [{ ownerDocument: '00000000000', ownerName: 'PARTNER NAME', percentage: 70.0 }] },
  },
  SERVICE_QUANTUM_CUSTOM_SCORE_COMPANY: {
    summary: 'Returns the business (PJ) Quantum credit score by the informed CNPJ, with a text summary and structured credit bureau data.',
    result: { cnpj: 'cnpj', score: 690, creditBureauSummary: 'Score de crédito dentro da média do setor', creditBureauDetails: {}, origin: 'Quantum', queryDate: '2026-08-01' },
  },
  SERVICE_CGU_NEGATIVE_CERTIFICATE_COMPANY: {
    summary: 'Returns the CGU\'s negative disciplinary certificate by the informed CNPJ, covering active penalties in CEIS, CNEP and CEPIM.',
    result: { cnpj: 'cnpj', cguSummary: 'Consulta realizada', cguBaseStatus: 'NEGATIVA', cguClearance: 'Sim', cguValidUntil: '2027-08-01', cguIssueDate: '2026-08-01', cguCertificateUrl: 'https://example.com/certidao-cgu.pdf' },
  },
  SERVICE_CNJ_NEGATIVE_CERTIFICATE_COMPANY: {
    summary: 'Returns the CNJ\'s negative certificate by the informed CNPJ, covering civil convictions for administrative misconduct and ineligibility.',
    result: { cnpj: 'cnpj', cnjSummary: 'Consulta realizada', cnjBaseStatus: 'NEGATIVA', cnjClearance: 'Sim', cnjIssueDate: '2026-08-01', cnjCertificateUrl: 'https://example.com/certidao-cnj.pdf' },
  },
  SERVICE_STATE_DEBT_CERTIFICATE_COMPANY: {
    summary: 'Returns the negative state debt certificate by the informed CNPJ, available for every state.',
    result: { cnpj: 'cnpj', stateDebtSummary: 'Consulta realizada', stateDebtBaseStatus: 'NEGATIVA', stateDebtClearance: 'Sim', stateDebtState: 'SP', stateDebtRegistration: '000.000.000.000', stateDebtValidUntil: '2027-08-01', stateDebtCertificateUrl: 'https://example.com/certidao-debitos-estaduais.pdf' },
  },
  SERVICE_SIMPLES_COMPANY: {
    summary: 'Returns the company\'s status as a participant in Simples Nacional and SIMEI, by the informed CNPJ.',
    result: { cnpj: 'cnpj', simplesSummary: 'Consulta realizada', simplesOfficialName: 'COMPANY OFFICIAL NAME', simplesNationalStatus: 'OPTANTE', simplesMeiStatus: 'NAO OPTANTE', simplesCertificateUrl: 'https://example.com/comprovante-simples.pdf' },
  },
  SERVICE_ECONOMIC_GROUP_KYC_COMPANY: {
    summary: 'Returns aggregated KYC and regulatory compliance indicators for the full economic group of the informed CNPJ, including political exposure (PEP) and sanctions.',
    result: { cnpj: 'cnpj', economicGroupKycSummary: 'Consulta realizada', economicGroupTotalCurrentPep: '0', economicGroupTotalHistoricalPep: '1', economicGroupTotalCurrentSanctioned: '0', economicGroupTotalHistoricalSanctioned: '0', economicGroupAverageSanctions: '0' },
  },
  SERVICE_MEDIA_PROFILE_EXPOSURE_PF: {
    summary: 'Returns the person\'s media exposure and profile, with news, sources, categories, sentiment, relevance and alerts found.',
    result: { cpf: 'cpf', mediaMentions: [{ title: 'News item found', source: 'Source', sentiment: 'NEUTRAL' }], exposureLevel: 'LOW' },
  },
  SERVICE_MEDIA_PROFILE_EXPOSURE_PJ: {
    summary: 'Returns the media exposure and profile of the company and its partners, with news, sources, categories, sentiment, relevance and alerts found.',
    result: { cnpj: 'cnpj', mediaMentions: [{ title: 'News item found', source: 'Source', sentiment: 'NEUTRAL' }], exposureLevel: 'LOW' },
  },
  SERVICE_MEI: {
    summary: 'Returns MEI companies associated with the CPF, including CNPJ, legal name, status, activities, address and registration dates when available.',
    result: { cpf: 'cpf', meiCompanies: [{ cnpj: 'cnpj', officialName: 'EXAMPLE MEI', status: 'ATIVA' }] },
  },
  SERVICE_NOTHING_RECORD_LAWSUITS: {
    summary: 'Returns a clean-record certificate for the informed sphere/court, with status, message, occurrences and data used in the query.',
  },
  SERVICE_OCR: {
    summary: 'Returns data extracted from identification documents sent as an image, such as RG/CIN, CNH, OAB, RNE/CRNM, passport or automatic identification.',
    result: { cpf: 'cpf', docType: 'CNH', name: 'Extracted name', birthDate: 'yyyy-MM-dd', cnhCategory: 'B', cnhNumber: '00000000000' },
  },
  SERVICE_OCR_CNPJ_CARD: {
    summary: 'Returns data extracted from the CNPJ card sent as an image, including the CNPJ, document type and OCR text when available.',
    result: { cnpj: 'cnpj', docType: 'CNPJ_CARD', genericOcr: 'text extracted from the CNPJ card' },
  },
  SERVICE_OCR_EMANCIPATION: {
    summary: 'Returns the OCR text of the emancipation document and objective data extracted when it exists, without failing due to the absence of variable fields.',
    result: { docType: 'EMANCIPATION_DOCUMENT', genericOcr: 'extracted text', extractedFields: { cpf: 'cpf', dates: ['yyyy-MM-dd'] }, analysis: { isEmancipationRelated: true, confidence: 'MEDIUM' } },
  },
  SERVICE_OCR_PROOF_OF_ADDRESS: {
    summary: 'Returns data extracted from the proof of address by OCR, such as OCR text, name, address, document type, dates and amounts when found.',
    result: { genericOcr: 'extracted text', fullName: 'Extracted name', fullAddress: 'Extracted address', docType: 'Utility bill', dueDate: 'yyyy-MM-dd', invoiceAmount: 'R$ 100.00' },
  },
  SERVICE_ONDEMAND_SUS_CARD_PERSON_CPF: {
    summary: 'Returns the National Health Card (SUS Card) data located for the informed CPF, with the card number, source and capture date, birth data, an available-evidence indicator and a query summary.',
    result: {
      cpf: 'cpf',
      sus_card_success: 'Yes',
      sus_card_number: '126000000000009',
      sus_card_source: 'BA',
      sus_card_capture_date: '08/25/2025 20:07:36',
      sus_card_birth_date: '03/13/1980 00:00:00',
      sus_card_birth_city: 'CHORROCHO',
      sus_card_birth_state: 'BA',
      sus_card_has_evidence: 'No',
      sus_card_raw_result_file: 'https://example.com/documents/sus-card.pdf',
      sus_card_raw_result_file_type: 'pdf',
      sus_card_summary: 'SUS card located',
    },
  },
  SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ: {
    summary: 'Returns electoral donations made by the company\'s partners, with the related partner, year, candidate/party, amount and electoral details.',
    result: { cnpj: 'cnpj', ownersDonations: [{ ownerName: 'Partner name', year: 2024, recipient: 'Candidate', amount: '300.00' }] },
  },
  SERVICE_PEP: {
    summary: 'Returns whether the CPF is a PEP or related to a PEP, with position, agency, exposure level, period and ties found when available.',
  },
  SERVICE_PERSON_AI_PROMPT: {
    summary: 'Returns an AI-consolidated text answer from the person\'s data, with a summary, points of attention and an operational read.',
    result: { cpf: 'cpf', answer: 'AI-generated analytical summary', highlights: ['relevant point'] },
  },
  SERVICE_PERSON_DATA_ENRICHMENT: {
    summary: 'Returns the CPF\'s registration data, including name, birth date, registration status, parentage, death record, age, gender and available attributes.',
    result: { cpf: 'cpf', name: 'Full name', birthDate: 'yyyy-MM-dd', status: 'REGULAR', motherName: 'Mother\'s name' },
  },
  SERVICE_PERSON_DATA_MODELING: {
    summary: 'Returns consolidated person modeling, gathering registration data, contacts, addresses, ties, indicators and derived summaries.',
    result: { cpf: 'cpf', profileSummary: 'Resumo consolidado', contacts: [], addresses: [], relationships: [] },
  },
  SERVICE_PERSON_KYC: {
    summary: 'Returns the person\'s KYC check, including PEP, sanctions, media, lawsuits, compliance alerts and risk signals.',
  },
  SERVICE_PF_FINANCIAL_AND_ADDRESS: {
    summary: 'Returns financial data and addresses for the CPF in a combined query, including estimated income, financial indicators and addresses found.',
    result: { cpf: 'cpf', estimatedIncome: '5000-10000', addresses: [{ city: 'Sao Paulo', state: 'SP' }], financialIndicators: [] },
  },
  SERVICE_PHONE_HISTORY: {
    summary: 'Returns the phone history associated with the CPF, including number, line type, carrier, priority, status and recency when available.',
  },
  SERVICE_PIS_CONSULTATION: {
    summary: 'Returns PIS/NIS data associated with the CPF, including the number found, status, related registration data and query messages.',
  },
  SERVICE_POLITICAL_INVOLVEMENT: {
    summary: 'Returns the CPF\'s political involvement, including candidacies, positions, donations, service provisions, parties and political ties.',
  },
  SERVICE_POLITICAL_INVOLVEMENT_CPF: {
    summary: 'Returns the CPF\'s political involvement, including candidacies, positions, donations, service provisions, parties and political ties.',
  },
  SERVICE_PROFESSIONAL_HISTORY: {
    summary: 'Returns the CPF\'s professional history, including companies, roles, dates, employment or corporate ties and professional indicators.',
  },
  SERVICE_PROFESSIONAL_HISTORY_OWNER_ONLY: {
    summary: 'Returns professional history where the person appears as a holder, partner or owner, with companies, roles and tie dates.',
  },
  SERVICE_PROTEST_CLEARANCE_CERTIFICATE: {
    summary: 'Returns a protest certificate/query for the CPF, with clean-record status or a list of protests, notary office, amount and dates.',
  },
  SERVICE_PROTEST_PF: {
    summary: 'Returns a protest certificate/query for the CPF, with status, notary offices queried, protests and messages.',
  },
  SERVICE_PROTEST_PJ: {
    summary: 'Returns a protest certificate/query for the CNPJ, with status, notary offices queried, protests, amounts and dates.',
  },
  SERVICE_PUBLIC_SERVANTS: {
    summary: 'Returns public-servant records associated with the CPF, including agency, role, employment tie, pay/band and period when available.',
  },
  SERVICE_RELATED_PEOPLE: {
    summary: 'Returns people related to the CPF, with name, masked document, relationship type, closeness level and tie source.',
  },
  SERVICE_REGISTRATION_DATA_CNPJ: {
    summary: 'Returns the CNPJ\'s registration data, including legal name, trade name, status, opening date, CNAE codes, legal nature and address when available.',
    result: { cnpj: 'cnpj', officialName: 'EXAMPLE COMPANY LTD', tradeName: 'EXAMPLE COMPANY', status: 'ATIVA', openingDate: 'yyyy-MM-dd' },
  },
  SERVICE_RFB_PF: {
    summary: 'Returns the CPF\'s status at the Federal Revenue, including name, birth date, registration status, receipt/protocol and available tax data.',
    result: { cpf: 'cpf', name: 'Full name', birthDate: 'yyyy-MM-dd', status: 'REGULAR', protocol: 'protocol' },
  },
  SERVICE_RFB_PF_ON_DEMAND: {
    summary: 'Returns the CPF\'s updated status queried on demand at the Federal Revenue, with name, birth date, registration status and protocol.',
    result: { cpf: 'cpf', name: 'Full name', birthDate: 'yyyy-MM-dd', status: 'REGULAR', protocol: 'protocol' },
  },
  SERVICE_RFB_PJ: {
    summary: 'Returns the CNPJ\'s status at the Federal Revenue, including legal name, trade name, registration status, opening date, CNAE codes and address.',
    result: { cnpj: 'cnpj', officialName: 'EXAMPLE COMPANY LTD', status: 'ATIVA', openingDate: 'yyyy-MM-dd', mainActivity: 'Main CNAE' },
  },
  SERVICE_RFB_PJ_ON_DEMAND: {
    summary: 'Returns the CNPJ\'s updated status queried on demand at the Federal Revenue, with legal name, registration status, CNAE codes and address.',
    result: { cnpj: 'cnpj', officialName: 'EXAMPLE COMPANY LTD', status: 'ATIVA', openingDate: 'yyyy-MM-dd', mainActivity: 'Main CNAE' },
  },
  SERVICE_SINTEGRA_CONSULTATION: {
    summary: 'Returns SINTEGRA data, including state registration, state, status, regime, activities, address and query messages.',
  },
  SERVICE_SOCIAL_ASSISTANCE_EXTENDED: {
    summary: 'Returns extended social benefits linked to the CPF, with programs, indicators, status and details found when available.',
    result: { cpf: 'cpf', totalBenefits: 1, benefits: [{ program: 'Social program', status: 'ACTIVE' }], indicators: [] },
  },
  SEVICE_ONLINE_BETTING_PROPENSITY: {
    summary: 'Returns the CPF\'s propensity toward online betting, with score, propensity band, behavioral indicators and associated signals when available. Note: the alias is `SEVICE_ONLINE_BETTING_PROPENSITY` (missing the letter R in SERVICE); that is the spelling implemented in the backend, copy it exactly as shown.',
    result: { cpf: 'cpf', propensityScore: 78, propensityLevel: 'HIGH', indicators: ['signal found'] },
  },
  SERVICE_QUOD_CREDIT_SCORE_COMPANY: {
    summary: 'Returns the business (PJ) credit score by the informed CNPJ, with risk level, risk classification, score reasons and a text summary of the query.',
    result: { cnpj: 'cnpj', score: 650, riskLevel: 'MEDIO', riskClassification: 'B', reasonCodes: ['Time in the market', 'Low share capital'], creditBureauSummary: 'Score de crédito dentro da média do setor', creditBureauDetails: {}, origin: 'Quod', queryDate: '2026-08-01' },
  },
  SERVICE_BOAVISTA_ONE_SCORE_COMPANY: {
    summary: 'Returns the business (PJ) multi-data credit score by the informed CNPJ, with risk level, risk classification, score reasons and a text summary of the query.',
    result: { cnpj: 'cnpj', score: 700, riskLevel: 'BAIXO', riskClassification: 'A', reasonCodes: ['Good payment history'], creditBureauSummary: 'Score de crédito multidados acima da média do setor', creditBureauDetails: {}, origin: 'Boa Vista', queryDate: '2026-08-01' },
  },
  SERVICE_BOAVISTA_CREDIT_SCORE_COMPANY: {
    summary: 'Returns business (PJ) restrictive credit data by the informed CNPJ, including score, indicator and count of restrictions found.',
    result: { cnpj: 'cnpj', score: 720, hasRestrictions: false, restrictionCount: 0, creditBureauSummary: 'Nenhuma restrição de crédito encontrada', creditBureauDetails: {}, origin: 'Boa Vista', queryDate: '2026-08-01' },
  },
  SERVICE_QUOD_CREDIT_RISK_COMPANY: {
    summary: 'Returns business (PJ) negative credit flags by the informed CNPJ, with risk level and classification, a restrictions indicator and the count of negative flags.',
    result: { cnpj: 'cnpj', riskLevel: 'BAIXO', riskClassification: 'A', hasRestrictions: false, negativeFlagsCount: 0, creditBureauSummary: 'Nenhum flag negativo encontrado', creditBureauDetails: {}, origin: 'Quod', queryDate: '2026-08-01' },
  },
  SERVICE_ECONOMIC_GROUP_RELATIONSHIPS: {
    summary: 'Returns the entities (people and companies) that are part of the same economic group as the queried CNPJ, with current, historical relationships and aggregated statistics.',
    result: { cnpj: 'cnpj', totalEconomicGroupRelationships: 3, economicGroupRelationshipsSummary: 'Empresa possui 3 relacionamentos de grupo econômico', economicGroupRelationships: [], economicGroupCurrentRelationships: [], economicGroupHistoricalRelationships: [], economicGroupRelationshipsStats: {} },
  },
  SERVICE_REPUTATIONS_AND_REVIEWS: {
    summary: 'Returns the company\'s reputation on different service review platforms, with a consolidated view, a breakdown by source and evolution history.',
    result: { cnpj: 'cnpj', totalReputationSources: 2, reputationSummary: 'Empresa possui avaliações em 2 plataformas', reputationAndReviews: [], reputationSummaryDetails: {}, reputationSummaryByDataSources: {} },
  },
  SERVICE_INVESTMENT_FUND_DATA: {
    summary: 'Returns registration and operational information for investment funds associated with the CNPJ, per CVM records.',
    result: { cnpj: 'cnpj', totalMovimentations: 0, investmentFundDataSummary: 'Nenhuma movimentação de fundo de investimento encontrada', investmentFundData: [] },
  },
  SERVICE_OWNERS_INFLUENCE: {
    summary: 'Returns the inferred influence level of the company\'s corporate structure, considering media exposure, political involvement and lawsuit history of the partners.',
    result: { cnpj: 'cnpj', influenceScore: 0, ownersInfluenceSummary: 'Baixa influência do quadro societário', ownersInfluence: [] },
  },
  SERVICE_PGMEI: {
    summary: 'Returns the Simples Nacional Collection Document (DAS) for Individual Microentrepreneurs (MEI), with status, reference year, pending slips and monthly collection history.',
    result: { cnpj: 'cnpj', pgmeiStatus: 'Optante', pgmeiReferenceYear: '2026', pgmeiPendingGuides: 0, pgmeiSummary: 'MEI optante e regular no ano de referência', pgmeiGuides: [] },
  },
  SERVICE_FGTS: {
    summary: 'Returns the employer\'s FGTS compliance certificate, with status, certificate number and validity, and the issued text content.',
    result: { cnpj: 'cnpj', fgtsStatus: 'REGULAR', fgtsCertificateNumber: '2026000000000000', fgtsCertificateValidity: '01/08/2026 to 29/08/2026', fgtsCertificateText: 'Certifies that the company is in compliance with the FGTS', fgtsSummary: 'Empresa regular perante o FGTS', fgtsDetails: [] },
  },
  SERVICE_MARKETPLACE_DATA: {
    summary: 'Returns the company\'s presence in marketplaces, including operated stores, listed products, the marketplace with the most products and the best rating.',
    result: { cnpj: 'cnpj', totalMarketplacesUsed: 1, totalStoresOperated: 1, marketplaceWithMostProducts: 'Mercado Livre', marketplaceWithBestRating: 'Mercado Livre', totalProductsListed: 0, marketplaceSummary: 'Empresa presente em 1 marketplace', marketplaceDetails: [] },
  },
  SERVICE_ONLINE_ADS: {
    summary: 'Returns online ads linked to the company, identifying seller profiles on classifieds and peer-to-peer marketplace sites by phone number.',
    result: { cnpj: 'cnpj', onlineAdsTotalPhones: 0, onlineAdsSummary: 'Nenhum anúncio online encontrado', onlineAds: [] },
  },
  SERVICE_RF_QSA: {
    summary: 'Returns the corporate/administrative structure (QSA) of the informed CNPJ, with registration data of the headquarters (size, capital, CNAE, legal nature, registration status) and the list of partners and officers.',
    result: { cnpj: 'cnpj', qsaCompanyType: 'MATRIZ', qsaCompanySize: 'DEMAIS', qsaCapital: 'DEZ MIL REAIS', qsaCapitalValue: '10000.00', qsaCnae: '62.09-1-00', qsaMainEconomicActivity: 'SUPORTE TECNICO, MANUTENCAO E OUTROS SERVICOS EM TECNOLOGIA DA INFORMACAO', qsaSecondaryActivity: 'DESENVOLVIMENTO DE PROGRAMAS DE COMPUTADOR SOB ENCOMENDA', qsaLegalNatureCode: '2062', qsaLegalNature: 'SOCIEDADE EMPRESARIA LIMITADA', qsaIrsStatus: 'ATIVA', qsaIsActive: 'true', qsaStatusDate: '2018-04-04', qsaPartnersCount: 1, qsaSummary: 'Empresa ativa com 1 sócio encontrado no QSA', qsaPartners: [] },
  },
  SERVICE_OWNERS_LAWSUITS_DISTRIBUTION: {
    summary: 'Returns aggregated data on the distribution of lawsuits in which the queried company\'s partners are involved, with statistics by period and role in the case.',
    result: { cnpj: 'cnpj', companyOwnersLawsuitsTotalOwners: 2, companyOwnersLawsuitsMaxPerOwner: 3, companyOwnersLawsuitsAvgPerOwner: 1.5, companyOwnersLawsuitsMinPerOwner: 0, companyOwnersLawsuitsAsAuthor: 1, companyOwnersLawsuitsAsDefendant: 2, companyOwnersLawsuitsAsOther: 0, companyOwnersLawsuitsTotal: 3, companyOwnersLawsuitsRelatedToLawyers: false, companyOwnersLawsuitsRelatedToJudges: false, companyOwnersLawsuitsFirstDate: '2015-01-01', companyOwnersLawsuitsLastDate: '2026-01-01', companyOwnersLawsuitsLast30Days: 0, companyOwnersLawsuitsLast90Days: 0, companyOwnersLawsuitsLast180Days: 0, companyOwnersLawsuitsLast365Days: 1, companyOwnersLawsuitsSummary: 'Sócios com 3 processos judiciais encontrados', companyOwnersLawsuitsDistribution: {} },
  },
  SERVICE_LAWSUITS_DISTRIBUTION_DATA_COMPANY: {
    summary: 'Returns aggregated data on the distribution of lawsuits in which the queried company is involved, with statistics by period.',
    result: { cnpj: 'cnpj', companyLawsuitsTotal: 5, companyLawsuitsFirstDate: '2016-03-10', companyLawsuitsLastDate: '2026-02-20', companyLawsuitsLast30Days: 0, companyLawsuitsLast90Days: 1, companyLawsuitsLast180Days: 1, companyLawsuitsLast365Days: 2, companyLawsuitsSummary: 'Empresa com 5 processos judiciais encontrados', companyLawsuitsDistribution: {} },
  },
  SERVICE_LABOR_LAWSUITS: {
    summary: 'Returns an on-demand certificate stating whether there are pending labor lawsuits related to the queried company, physical or electronic.',
    result: { cnpj: 'cnpj', laborLawsuitsStatus: 'NADA CONSTA', laborLawsuitsProtocol: '2026000000000', laborLawsuitsCertificateNumber: '00000000/2026', laborLawsuitsIssuedDate: '2026-08-01', laborLawsuitsContent: 'Certifica-se que nada consta em nome da empresa quanto a ações trabalhistas', laborLawsuitsProcessesCount: 0, laborLawsuitsSummary: 'Nada consta de ações trabalhistas', laborLawsuitsProcesses: [] },
  },
  SERVICE_EMPLOYEES_KYC: {
    summary: 'Returns KYC and regulatory compliance indicators for the employees linked to the company, including PEP classifications and national and international sanctions.',
    result: { cnpj: 'cnpj', employeesKycTotalEmployees: 5, employeesKycCurrentlyPepCount: 0, employeesKycCurrentlySanctionedCount: 0, employeesKycPreviouslySanctionedCount: 0, employeesKycFlaggedCount: 0, employeesKycSummary: 'Nenhum funcionário sinalizado como PEP ou sancionado', employeesKycFlagged: [] },
  },
  SERVICE_HISTORY_BASIC_DATA: {
    summary: 'Returns the history of basic registration changes for the CNPJ: name, tax regime, registration status, CNAE and share capital.',
    result: { cnpj: 'cnpj', historyBasicDataCurrentName: 'EXAMPLE COMPANY LTD', historyBasicDataAge: 6, historyBasicDataTotalChanges: 2, historyBasicDataSummary: 'Empresa com 2 alterações cadastrais encontradas', historyBasicDataStats: [], historyBasicDataNameHistory: [], historyBasicDataTaxRegimeHistory: [], historyBasicDataTaxIdStatusHistory: [], historyBasicDataCnaeHistory: [], historyBasicDataCapitalHistory: [] },
  },
  SERVICE_MERCHANT_CATEGORY_DATA: {
    summary: 'Returns the company\'s categorization according to the MCC (Merchant Category Code), by direct association with Abecs or inferred from the CNAE.',
    result: { cnpj: 'cnpj', merchantCategoryHasDirectAssociation: 'false', merchantCategoryHasMultipleCodes: 'false', merchantCategorySummary: 'Categoria comercial inferida pelo CNAE', merchantCategoryCategories: [], merchantCategoryCnaeCategories: [] },
  },
  SERVICE_SYNDICATE_AGREEMENTS: {
    summary: 'Returns the union agreements signed between the company and the unions that represent its employees, with totals and a breakdown.',
    result: { cnpj: 'cnpj', syndicateAgreementsTotal: 1, syndicateAgreementsTotalActive: 1, syndicateAgreementsSummary: 'Empresa com 1 acordo sindical ativo', syndicateAgreementsStats: [], syndicateAgreements: [] },
  },
  SERVICE_PHONES_EXTENDED_COMPANY: {
    summary: 'Returns the phone numbers associated with the company, with validity, priority and source indicators.',
    result: { cnpj: 'cnpj', phonesExtendedCompanyTotal: 2, phonesExtendedCompanyTotalActive: 1, phonesExtendedCompanySummary: 'Empresa com 2 telefones encontrados, 1 ativo', phonesExtendedCompanyStats: [], phonesExtendedCompany: [] },
  },
  SERVICE_COMPANY_EVOLUTION: {
    summary: 'Returns the time evolution of the company\'s capital, headcount, branches and partners, with growth trend.',
    result: { cnpj: 'cnpj', companyEvolutionSummary: 'Empresa com tendência de crescimento estável', companyEvolutionStats: [] },
  },
};

function serviceResponseSummary(service, lang = 'pt') {
  if (lang === 'en') {
    const exactEn = serviceReturnDetailsEn[service.service];
    if (exactEn) return exactEn.summary;

    const text = normalizeText(`${service.name} ${service.service}`);
    const targetEn = normalizeText(service.category) === 'pessoa juridica' ? 'the company/CNPJ' : 'the person/CPF';

    if (text.includes('rfb') || text.includes('receita') || text.includes('enriquecimento') || text.includes('registration')) {
      return `Returns registration data for ${targetEn}, including registration status, identification, dates and attributes available in the queried database.`;
    }
    if (text.includes('ocr')) return 'Returns data extracted from the submitted document, the identified document type, official/estimated fields and reading status.';
    if (text.includes('face')) return 'Returns the facial comparison status, similarity percentage/score and indicators used to approve or reject the comparison.';
    if (text.includes('liveness')) return 'Returns the proof-of-life status and validation signals for the submitted selfie.';
    if (text.includes('documentoscopia')) return 'Returns the document analysis status, query key and processed data for the document, selfie and associated validations.';
    if (text.includes('datavalid') || text.includes('biometric')) return 'Returns the biometric score/status and validation data per the queried government database.';
    if (text.includes('pep') || text.includes('politic') || text.includes('kyc') || text.includes('compliance') || text.includes('sanction')) {
      return `Returns KYC/compliance indicators for ${targetEn}, such as PEP, sanctions, exposure, history and risk signals when available.`;
    }
    if (text.includes('juridic') || text.includes('lawsuit') || text.includes('criminal') || text.includes('protest') || text.includes('nada consta') || text.includes('mandado')) {
      return `Returns legal occurrences, certificates, protests, criminal records or warrants associated with ${targetEn}, plus the query status.`;
    }
    if (text.includes('financial') || text.includes('financeir') || text.includes('score') || text.includes('risco') || text.includes('debt') || text.includes('debito') || text.includes('divida') || text.includes('inadimplencia') || text.includes('credito')) {
      return `Returns financial and risk indicators for ${targetEn}, such as scores, debts, estimated income/assets and default signals when applicable.`;
    }
    if (text.includes('phone') || text.includes('telefone')) return `Returns phone numbers, contact history or the phone validation result associated with ${targetEn}.`;
    if (text.includes('email')) return `Returns emails, contact history or the email validation result associated with ${targetEn}.`;
    if (text.includes('address') || text.includes('endereco')) return `Returns addresses found or the address validation result associated with ${targetEn}.`;
    if (text.includes('relationship') || text.includes('relacion') || text.includes('socio') || text.includes('partner') || text.includes('owner')) {
      return `Returns ties, partners, economic relationships or related people/companies for ${targetEn}.`;
    }
    if (text.includes('eleitoral') || text.includes('election') || text.includes('electoral')) {
      return `Returns electoral data associated with ${targetEn}, such as candidacies, donations, suppliers or political history when available.`;
    }
    if (text.includes('mei') || text.includes('pis') || text.includes('sintegra') || text.includes('das')) return `Returns registration or tax data specific to ${targetEn}, per the database queried by the service.`;
    if (text.includes('ai') || text.includes('prompt')) return 'Returns the AI-consolidated answer from the queried data and the prompt configured for the service.';

    return `Returns the result object for the service ${service.service} with the data available for the query, plus the processing status.`;
  }

  const exact = serviceReturnDetails[service.service];
  if (exact) return pt(exact.summary);

  const text = normalizeText(`${service.name} ${service.service}`);
  const target = normalizeText(service.category) === 'pessoa juridica' ? 'empresa/CNPJ' : 'pessoa/CPF';

  if (text.includes('rfb') || text.includes('receita') || text.includes('enriquecimento') || text.includes('registration')) {
    return pt(`Retorna dados cadastrais do ${target}, incluindo status cadastral, identificacao, datas e atributos disponiveis na base consultada.`);
  }
  if (text.includes('ocr')) return pt('Retorna dados extraidos do documento enviado, tipo documental identificado, campos oficiais/estimados e status de leitura.');
  if (text.includes('face')) return pt('Retorna status da comparacao facial, percentual/score de similaridade e indicadores usados para aprovar ou reprovar a comparacao.');
  if (text.includes('liveness')) return pt('Retorna status da prova de vida e sinais de validacao da selfie enviada.');
  if (text.includes('documentoscopia')) return pt('Retorna status da analise documental, chave da consulta e dados processados de documento, selfie e validacoes associadas.');
  if (text.includes('datavalid') || text.includes('biometric')) return pt('Retorna score/status biometrico e dados de validacao conforme a base governamental consultada.');
  if (text.includes('pep') || text.includes('politic') || text.includes('kyc') || text.includes('compliance') || text.includes('sanction')) {
    return pt(`Retorna indicadores de KYC/compliance do ${target}, como PEP, sancoes, exposicao, historicos e sinais de risco quando disponiveis.`);
  }
  if (text.includes('juridic') || text.includes('lawsuit') || text.includes('criminal') || text.includes('protest') || text.includes('nada consta') || text.includes('mandado')) {
    return pt(`Retorna ocorrencias juridicas, certidoes, protestos, antecedentes ou mandados associados ao ${target}, alem do status da consulta.`);
  }
  if (text.includes('financial') || text.includes('financeir') || text.includes('score') || text.includes('risco') || text.includes('debt') || text.includes('debito') || text.includes('divida') || text.includes('inadimplencia') || text.includes('credito')) {
    return pt(`Retorna indicadores financeiros e de risco do ${target}, como scores, debitos, renda/ativos estimados e sinais de inadimplencia quando aplicavel.`);
  }
  if (text.includes('phone') || text.includes('telefone')) return pt(`Retorna telefones, historico de contato ou resultado de validacao de telefone associado ao ${target}.`);
  if (text.includes('email')) return pt(`Retorna e-mails, historico de contato ou resultado de validacao de e-mail associado ao ${target}.`);
  if (text.includes('address') || text.includes('endereco')) return pt(`Retorna enderecos encontrados ou resultado de validacao de endereco associado ao ${target}.`);
  if (text.includes('relationship') || text.includes('relacion') || text.includes('socio') || text.includes('partner') || text.includes('owner')) {
    return pt(`Retorna vinculos, socios, relacionamentos economicos ou pessoas/empresas relacionadas ao ${target}.`);
  }
  if (text.includes('eleitoral') || text.includes('election') || text.includes('electoral')) {
    return pt(`Retorna dados eleitorais associados ao ${target}, como candidaturas, doacoes, fornecedores ou historico politico quando disponivel.`);
  }
  if (text.includes('mei') || text.includes('pis') || text.includes('sintegra') || text.includes('das')) return pt(`Retorna dados cadastrais ou fiscais especificos do ${target}, conforme a base consultada pelo service.`);
  if (text.includes('ai') || text.includes('prompt')) return pt('Retorna a resposta consolidada pela IA a partir dos dados consultados e do prompt configurado para o service.');

  return pt(`Retorna o objeto result do service ${service.service} com os dados disponiveis para a consulta, alem do status de processamento.`);
}
function isOptionalServiceField(service, name, raw) {
  const normalizedName = normalizeText(name);
  const normalizedValue = normalizeText(raw);

  if (normalizedValue.includes('opcional')) return true;
  if (service.service === 'SERVICE_OCR' && normalizedName === 'image2') return true;

  return false;
}

function fieldRowsFromService(service, lang = 'pt') {
  const body = jsonBodyFromRequestExample(service.requestExample);
  return Object.entries(body).map(([name, value]) => {
    const raw = `${value ?? ''}`;
    return {
      name,
      value,
      required: name === 'service' || !isOptionalServiceField(service, name, raw),
      description: lang === 'en' ? serviceFieldDescription(service, name, lang) : pt(serviceFieldDescription(service, name)),
    };
  });
}
function serviceResponseExample(service, lang = 'pt') {
  if (lang === 'en') {
    const exactEn = serviceReturnDetailsEn[service.service];
    const exactPt = serviceReturnDetails[service.service];
    const result = exactEn?.result || (exactPt ? localizeExample(exactPt.result) : null);
    return {
      result: result || {
        summary: serviceResponseSummary(service, lang),
        observation: `The fields returned vary depending on the service ${service.service}.`,
      },
      status: {
        code: 200,
        message: 'Success',
      },
      externalId: '{externalId}',
    };
  }

  const exact = serviceReturnDetails[service.service];
  return {
    result: exact ? localizeExample(exact.result) : {
      summary: serviceResponseSummary(service),
      observation: pt(`Os campos retornados variam conforme o service ${service.service}.`),
    },
    status: {
      code: 200,
      message: 'Success',
    },
    externalId: '{externalId}',
  };
}

const ocrServiceApiDetails = {
  SERVICE_OCR: {
    minimumPayload: { service: 'SERVICE_OCR', documentType: 'CNH', image1: 'BASE64_DA_CNH' },
    commonError: { result: {}, status: { code: 400, message: 'Imagem do documento não encontrada' }, onboardingStatus: 'REFUSED', externalId: '{externalId}' },
  },
  SERVICE_OCR_CNPJ_CARD: {
    minimumPayload: { service: 'SERVICE_OCR_CNPJ_CARD', image1: 'BASE64_DO_CARTAO_CNPJ' },
    commonError: { result: {}, status: { code: 400, message: 'CNPJ não encontrado no cartão CNPJ' }, onboardingStatus: 'REFUSED', externalId: '{externalId}' },
  },
  SERVICE_OCR_EMANCIPATION: {
    minimumPayload: { service: 'SERVICE_OCR_EMANCIPATION', image1: 'BASE64_DO_DOCUMENTO' },
    commonError: { result: {}, status: { code: 400, message: 'Não foi possível ler o documento de emancipação' }, onboardingStatus: 'REFUSED', externalId: '{externalId}' },
  },
  SERVICE_OCR_PROOF_OF_ADDRESS: {
    minimumPayload: { service: 'SERVICE_OCR_PROOF_OF_ADDRESS', image1: 'BASE64_DO_COMPROVANTE' },
    commonError: { result: {}, status: { code: 400, message: 'Não foi possível ler o comprovante de endereço' }, onboardingStatus: 'REFUSED', externalId: '{externalId}' },
  },
};

function isOcrService(service) {
  return Boolean(ocrServiceApiDetails[service.service]);
}

function pushOcrApiReferenceBlock(lines, service, lang = 'pt') {
  const details = ocrServiceApiDetails[service.service];
  if (!details) return;

  if (lang === 'en') {
    lines.push('### OCR guide');
    lines.push('');
    lines.push('For ready-made payloads, image quality and error diagnostics, see [OCR via Service API](/en/guides/service-api/sobre-ocr-service-api).');
    lines.push('');
    lines.push('### Minimum payload');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(details.minimumPayload, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('### Expected clean return');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(serviceResponseExample(service, lang), null, 2));
    lines.push('```');
    lines.push('');
    lines.push('### Common error');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(details.commonError, null, 2));
    lines.push('```');
    lines.push('');
    return;
  }

  lines.push('### Guia de OCR');
  lines.push('');
  lines.push('Para payloads prontos, qualidade de imagem e diagnóstico de erro, consulte [OCR via Service API](/guides/service-api/sobre-ocr-service-api).');
  lines.push('');
  lines.push('### Payload mínimo');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(details.minimumPayload, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### Retorno limpo esperado');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(serviceResponseExample(service), null, 2));
  lines.push('```');
  lines.push('');
  lines.push('### Erro comum');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(details.commonError, null, 2));
  lines.push('```');
  lines.push('');
}

function serviceFieldDescription(service, fieldName, lang = 'pt') {
  const field = normalizeText(fieldName);
  const serviceText = normalizeText(`${service.name} ${service.service}`);

  if (lang === 'en') {
    if (field === 'service') return 'Exact code of the product that will be executed by the central endpoint.';
    if (field === 'cpf') return "The queried individual's CPF.";
    if (field === 'cnpj') return "The queried company's CNPJ.";
    if (field === 'phone') return 'Phone number used for the query or validation, preferably with area code.';
    if (field === 'email') return 'Email that will be validated or queried.';
    if (field === 'birthdate' || field === 'datadenascimento') return 'Birth date used to increase query precision when required.';
    if (field === 'zipcode') return 'Zip code used in address validation.';
    if (field === 'numberaddress') return 'Address number used in validation.';
    if (field === 'uf') return 'State (UF) used to scope the state or legal query.';
    if (field === 'rg') return 'RG number used in certificates or document validations.';
    if (field === 'court') return 'Court or agency used in the certificate/lawsuit query.';
    if (field === 'sphere') return 'Query scope, such as civil, criminal or federal.';
    if (field === 'nit') return 'NIT/PIS/PASEP used in the registration qualification.';
    if (field === 'factor') return 'Risk factor requested in the payload, such as minimum risk or minimum attrition.';
    if (field === 'key') return serviceText.includes('documentoscopia') ? 'Documentoscopy key used to start or query the processing.' : 'Identification key used by the product.';
    if (field === 'image1') return 'First image sent as base64 or an equivalent reference, depending on the product.';
    if (field === 'image2') return 'Second image sent as base64 or an equivalent reference, when the product compares two images.';
    if (field === 'selfie1') return 'Selfie sent for documentoscopy and biometric validations.';
    if (field === 'image1url') return 'URL of the first image, an alternative to sending base64 when supported.';
    if (field === 'image2url') return 'URL of the second image, an alternative to sending base64 when supported.';
    if (field === 'nome') return 'Full name used in the query when there is no sufficient document.';
    if (field === 'mothername') return "The mother's name used to increase query accuracy.";
    if (field === 'fathername') return "The father's name used to increase query accuracy.";
    if (field === 'limit') return 'Maximum number of records that should be returned when the product supports a limit.';

    return `Parameter used by the service ${service.service}.`;
  }

  if (field === 'service') return 'Codigo exato do produto que sera executado pelo endpoint central.';
  if (field === 'cpf') return 'CPF da pessoa fisica consultada.';
  if (field === 'cnpj') return 'CNPJ da empresa consultada.';
  if (field === 'phone') return 'Telefone usado para consulta ou validacao, de preferencia com DDD.';
  if (field === 'email') return 'E-mail que sera validado ou consultado.';
  if (field === 'birthdate' || field === 'datadenascimento') return 'Data de nascimento usada para aumentar a precisao da consulta quando exigida.';
  if (field === 'zipcode') return 'CEP usado na validacao de endereco.';
  if (field === 'numberaddress') return 'Numero do endereco usado na validacao.';
  if (field === 'uf') return 'UF usada para limitar a consulta estadual ou juridica.';
  if (field === 'rg') return 'Numero do RG usado em certidoes ou validacoes documentais.';
  if (field === 'court') return 'Tribunal ou orgao usado na consulta de certidao/processo.';
  if (field === 'sphere') return 'Esfera da consulta, como civil, criminal ou federal.';
  if (field === 'nit') return 'NIT/PIS/PASEP usado na qualificacao cadastral.';
  if (field === 'factor') return 'Fator de risco solicitado no payload, como risco minimo ou atrito minimo.';
  if (field === 'key') return serviceText.includes('documentoscopia') ? 'Chave da documentoscopia usada para iniciar ou consultar o processamento.' : 'Chave de identificacao usada pelo produto.';
  if (field === 'image1') return 'Primeira imagem enviada em base64 ou referencia equivalente, conforme o produto.';
  if (field === 'image2') return 'Segunda imagem enviada em base64 ou referencia equivalente, quando o produto compara duas imagens.';
  if (field === 'selfie1') return 'Selfie enviada para validacoes de documentoscopia e biometria.';
  if (field === 'image1url') return 'URL da primeira imagem, alternativa ao envio em base64 quando suportado.';
  if (field === 'image2url') return 'URL da segunda imagem, alternativa ao envio em base64 quando suportado.';
  if (field === 'nome') return 'Nome completo usado na consulta quando nao ha documento suficiente.';
  if (field === 'mothername') return 'Nome da mae usado para aumentar a assertividade da consulta.';
  if (field === 'fathername') return 'Nome do pai usado para aumentar a assertividade da consulta.';
  if (field === 'limit') return 'Quantidade maxima de registros que devem ser retornados quando o produto suporta limite.';

  return `Parametro usado pelo service ${service.service}.`;
}


const newCompanyServiceFieldDescriptions = {
  score: 'Score de crédito retornado pelo bureau para o CNPJ consultado.',
  riskLevel: 'Nível de risco de crédito retornado na consulta.',
  riskClassification: 'Classificação de risco de crédito retornada na consulta.',
  reasonCodes: 'Motivos, códigos ou fatores retornados para explicar o score.',
  creditBureauSummary: 'Resumo textual dos principais dados de bureau de crédito retornados.',
  creditBureauDetails: 'Dados estruturados de bureau de crédito para consumo via API.',
  origin: 'Origem funcional da consulta executada.',
  queryDate: 'Data retornada pela fonte de dados para a consulta.',
  hasRestrictions: 'Indica se foram retornadas restrições de crédito.',
  restrictionCount: 'Quantidade de restrições retornadas na consulta.',
  negativeFlagsCount: 'Quantidade de flags negativos retornados na consulta.',
  totalEconomicGroupRelationships: 'Quantidade de relacionamentos do grupo econômico encontrados.',
  economicGroupRelationshipsSummary: 'Resumo da consulta de relacionamentos do grupo econômico.',
  economicGroupRelationships: 'Lista estruturada de relacionamentos do grupo econômico usada para renderização em tabela.',
  economicGroupCurrentRelationships: 'Lista estruturada dos relacionamentos atualmente vigentes do grupo econômico.',
  economicGroupHistoricalRelationships: 'Lista estruturada dos relacionamentos históricos (encerrados) do grupo econômico.',
  economicGroupRelationshipsStats: 'Estatísticas consolidadas dos relacionamentos do grupo econômico.',
  totalReputationSources: 'Quantidade de plataformas de avaliação com dados de reputação encontrados.',
  reputationSummary: 'Resumo da consulta de avaliações e reputação.',
  reputationAndReviews: 'Lista estruturada de avaliações e reputação por fonte usada para renderização em tabela.',
  reputationSummaryDetails: 'Estatísticas consolidadas de avaliações e reputação (totais por período, notas unificadas, melhores e piores notas).',
  reputationSummaryByDataSources: 'Resumo textual de reputação por combinação de fonte e empresa.',
  totalMovimentations: 'Quantidade de movimentações diárias encontradas para o fundo de investimento.',
  investmentFundDataSummary: 'Resumo da consulta de dados de fundos de investimento.',
  investmentFundData: 'Dados estruturados do fundo de investimento usados para renderização em tabela.',
  influenceScore: 'Score de influência do quadro societário da empresa.',
  ownersInfluenceSummary: 'Resumo da consulta de influência do quadro societário.',
  ownersInfluence: 'Dados estruturados de influência do quadro societário usados para renderização em tabela.',
  pgmeiStatus: 'Situação do MEI perante o Simples Nacional no ano de referência mais recente.',
  pgmeiReferenceYear: 'Ano de referência mais recente encontrado na consulta de arrecadação MEI.',
  pgmeiPendingGuides: 'Quantidade de guias de arrecadação do MEI ainda não quitadas.',
  pgmeiSummary: 'Resumo da consulta de Arrecadação Simples Nacional - MEI.',
  pgmeiGuides: 'Lista estruturada das guias mensais de arrecadação do MEI usada para renderização em tabela.',
  fgtsStatus: 'Situação simplificada da certidão de regularidade do FGTS emitida.',
  fgtsCertificateNumber: 'Número identificador da certidão de regularidade do FGTS emitida.',
  fgtsCertificateValidity: 'Período de validade da certidão de regularidade do FGTS atual.',
  fgtsCertificateText: 'Conteúdo textual da certidão de regularidade do FGTS emitida.',
  fgtsSummary: 'Resumo da consulta de Regularidade do FGTS.',
  fgtsDetails: 'Lista estruturada com os detalhes da certidão de FGTS usada para renderização em tabela.',
  totalMarketplacesUsed: 'Quantidade de marketplaces onde a empresa vende seus produtos.',
  totalStoresOperated: 'Quantidade total de lojas operadas nos diferentes marketplaces.',
  marketplaceWithMostProducts: 'Nome do marketplace com a maior quantidade de produtos.',
  marketplaceWithBestRating: 'Nome do marketplace onde a empresa tem a melhor avaliação.',
  totalProductsListed: 'Quantidade total de produtos listados nos marketplaces.',
  marketplaceSummary: 'Resumo da consulta de Marketplaces.',
  marketplaceDetails: 'Lista estruturada com os detalhes da presença da empresa em cada marketplace usada para renderização em tabela.',
  onlineAdsTotalPhones: 'Quantidade de telefones vinculados a anúncios online encontrados.',
  onlineAdsSummary: 'Resumo da consulta de Anúncios Online.',
  onlineAds: 'Lista estruturada dos anúncios online encontrados por telefone usada para renderização em tabela.',
  qsaCompanyType: 'Indica se o CNPJ consultado é MATRIZ ou FILIAL.',
  qsaCompanySize: 'Porte da empresa conforme classificação da Receita Federal.',
  qsaCapital: 'Valor do capital social da empresa.',
  qsaCapitalValue: 'Valor numérico do capital social da empresa, extraído do campo Capital Social para uso em regras e comparações.',
  qsaCnae: 'Código da atividade econômica principal.',
  qsaMainEconomicActivity: 'Descrição da atividade econômica principal.',
  qsaSecondaryActivity: 'Descrição das atividades econômicas secundárias.',
  qsaLegalNatureCode: 'Código da natureza jurídica da empresa.',
  qsaLegalNature: 'Descrição da natureza jurídica da empresa.',
  qsaIrsStatus: 'Situação cadastral da empresa na Receita Federal.',
  qsaIsActive: 'Indica se a situação cadastral do CNPJ é ATIVA, derivado do campo Situação Cadastral.',
  qsaStatusDate: 'Data da situação cadastral.',
  qsaPartnersCount: 'Quantidade de sócios e administradores encontrados no QSA.',
  qsaSummary: 'Resumo da consulta de QSA - Receita Federal.',
  qsaPartners: 'Lista estruturada dos sócios e administradores do QSA usada para renderização em tabela.',
  companyOwnersLawsuitsTotalOwners: 'Quantidade de sócios que a empresa possui.',
  companyOwnersLawsuitsMaxPerOwner: 'Quantidade máxima de processos que um dos sócios possui.',
  companyOwnersLawsuitsAvgPerOwner: 'Média de processos por sócio.',
  companyOwnersLawsuitsMinPerOwner: 'Quantidade mínima de processos que um dos sócios possui.',
  companyOwnersLawsuitsAsAuthor: 'Quantidade de processos em que os sócios figuram como autores.',
  companyOwnersLawsuitsAsDefendant: 'Quantidade de processos em que os sócios figuram como réus.',
  companyOwnersLawsuitsAsOther: 'Quantidade de processos em que os sócios participam em outra categoria.',
  companyOwnersLawsuitsTotal: 'Total de processos judiciais envolvendo os sócios da empresa.',
  companyOwnersLawsuitsRelatedToLawyers: 'Indica se algum sócio possui relação com advogados nos processos encontrados.',
  companyOwnersLawsuitsRelatedToJudges: 'Indica se algum sócio possui relação com juízes nos processos encontrados.',
  companyOwnersLawsuitsFirstDate: 'Data do processo mais antigo encontrado para os sócios.',
  companyOwnersLawsuitsLastDate: 'Data do processo mais recente encontrado para os sócios.',
  companyOwnersLawsuitsLast30Days: 'Quantidade de processos dos sócios iniciados nos últimos 30 dias.',
  companyOwnersLawsuitsLast90Days: 'Quantidade de processos dos sócios iniciados nos últimos 90 dias.',
  companyOwnersLawsuitsLast180Days: 'Quantidade de processos dos sócios iniciados nos últimos 180 dias.',
  companyOwnersLawsuitsLast365Days: 'Quantidade de processos dos sócios iniciados nos últimos 365 dias.',
  companyOwnersLawsuitsSummary: 'Resumo da consulta de Distribuição de Processos dos Sócios.',
  companyOwnersLawsuitsDistribution: 'Distribuições agregadas dos processos dos sócios por tipo, tribunal, status, estado, papel da parte e assunto, usada para renderização em tabela/gráfico.',
  companyLawsuitsTotal: 'Total de processos judiciais da empresa.',
  companyLawsuitsFirstDate: 'Data do processo mais antigo encontrado para a empresa.',
  companyLawsuitsLastDate: 'Data do processo mais recente encontrado para a empresa.',
  companyLawsuitsLast30Days: 'Quantidade de processos da empresa iniciados nos últimos 30 dias.',
  companyLawsuitsLast90Days: 'Quantidade de processos da empresa iniciados nos últimos 90 dias.',
  companyLawsuitsLast180Days: 'Quantidade de processos da empresa iniciados nos últimos 180 dias.',
  companyLawsuitsLast365Days: 'Quantidade de processos da empresa iniciados nos últimos 365 dias.',
  companyLawsuitsSummary: 'Resumo da consulta de Distribuição de Processos Judiciais.',
  companyLawsuitsDistribution: 'Distribuições agregadas dos processos da empresa por tipo, tribunal, status, estado, papel da parte e assunto, usada para renderização em tabela/gráfico.',
  laborLawsuitsStatus: 'Status simplificado da certidão de Ações Trabalhistas emitida.',
  laborLawsuitsProtocol: 'Número de protocolo da certidão emitida.',
  laborLawsuitsCertificateNumber: 'Número da certidão de Ações Trabalhistas emitida.',
  laborLawsuitsIssuedDate: 'Data de emissão da certidão de Ações Trabalhistas.',
  laborLawsuitsContent: 'Conteúdo textual da certidão de Ações Trabalhistas retornado pela fonte.',
  laborLawsuitsProcessesCount: 'Quantidade de processos trabalhistas encontrados na certidão.',
  laborLawsuitsSummary: 'Resumo da consulta de Ações Trabalhistas.',
  laborLawsuitsProcesses: 'Lista estruturada dos processos trabalhistas encontrados, com número e vara, usada para renderização em tabela.',
  employeesKycTotalEmployees: 'Quantidade total de funcionários com dados de KYC e Compliance retornados.',
  employeesKycCurrentlyPepCount: 'Quantidade de funcionários atualmente classificados como Pessoa Politicamente Exposta.',
  employeesKycCurrentlySanctionedCount: 'Quantidade de funcionários com sanção atualmente ativa.',
  employeesKycPreviouslySanctionedCount: 'Quantidade de funcionários que já possuíram alguma sanção.',
  employeesKycFlaggedCount: 'Quantidade de funcionários distintos sinalizados como PEP ou com alguma sanção.',
  employeesKycSummary: 'Resumo da consulta de KYC e Compliance dos Funcionários.',
  employeesKycFlagged: 'Lista estruturada dos funcionários classificados como PEP ou com sanções encontradas, usada para renderização em tabela.',
  historyBasicDataCurrentName: 'Nome atual da empresa na Receita Federal.',
  historyBasicDataAge: 'Idade atual da empresa em anos.',
  historyBasicDataTotalChanges: 'Quantidade total de alterações cadastrais encontradas no histórico.',
  historyBasicDataSummary: 'Resumo da consulta de Histórico de Dados Básicos.',
  historyBasicDataStats: 'Estatísticas consolidadas das alterações cadastrais encontradas.',
  historyBasicDataNameHistory: 'Lista estruturada do histórico de alterações de nome da empresa.',
  historyBasicDataTaxRegimeHistory: 'Lista estruturada do histórico de alterações de regime tributário.',
  historyBasicDataTaxIdStatusHistory: 'Lista estruturada do histórico de alterações de situação cadastral na Receita Federal.',
  historyBasicDataCnaeHistory: 'Lista estruturada do histórico de alterações de CNAE.',
  historyBasicDataCapitalHistory: 'Lista estruturada do histórico de alterações de capital social.',
  merchantCategoryHasDirectAssociation: 'Indica se a categoria comercial foi obtida por associação direta do CNPJ com a fonte Abecs.',
  merchantCategoryHasMultipleCodes: 'Indica se foram retornados múltiplos códigos comerciais (MCC) para a empresa.',
  merchantCategorySummary: 'Resumo da consulta de Categoria Comercial.',
  merchantCategoryCategories: 'Lista estruturada das categorias comerciais (MCC) associadas diretamente à empresa.',
  merchantCategoryCnaeCategories: 'Lista estruturada das categorias comerciais (MCC) associadas aos códigos CNAE da empresa.',
  syndicateAgreementsTotal: 'Quantidade total de acordos sindicais encontrados, ativos ou não.',
  syndicateAgreementsTotalActive: 'Quantidade de acordos sindicais ativos atualmente.',
  syndicateAgreementsSummary: 'Resumo da consulta de Acordos Sindicais.',
  syndicateAgreementsStats: 'Estatísticas consolidadas dos acordos sindicais encontrados.',
  syndicateAgreements: 'Lista estruturada dos acordos sindicais encontrados, usada para renderização em tabela.',
  phonesExtendedCompanyTotal: 'Quantidade total de telefones encontrados para a empresa.',
  phonesExtendedCompanyTotalActive: 'Quantidade de telefones ativos encontrados para a empresa.',
  phonesExtendedCompanySummary: 'Resumo da consulta de Telefones.',
  phonesExtendedCompanyStats: 'Estatísticas consolidadas dos telefones encontrados.',
  phonesExtendedCompany: 'Lista estruturada dos telefones encontrados, usada para renderização em tabela.',
  companyEvolutionSummary: 'Resumo da consulta de Evolução da Empresa.',
  companyEvolutionStats: 'Estatísticas consolidadas da evolução de capital, funcionários, filiais e sócios da empresa ao longo do tempo.',
  addressesExtendedTotal: 'Quantidade total de endereços encontrados para a empresa.',
  addressesExtendedTotalActive: 'Quantidade de endereços atualmente marcados como ativos.',
  addressesExtendedTotalWork: 'Quantidade de endereços do tipo comercial.',
  addressesExtendedTotalPersonal: 'Quantidade de endereços do tipo residencial.',
  addressesExtendedTotalUnique: 'Quantidade de endereços únicos, sem duplicidade.',
  addressesExtendedTotalPassages: 'Quantidade total de passagens (confirmações) registradas entre os endereços encontrados.',
  addressesExtendedTotalBadPassages: 'Quantidade de passagens sinalizadas como inconsistentes entre os endereços encontrados.',
  addressesExtendedOldestPassageDate: 'Data da passagem mais antiga registrada entre os endereços encontrados.',
  addressesExtendedNewestPassageDate: 'Data da passagem mais recente registrada entre os endereços encontrados.',
  totalCurrentPep: 'Quantidade de sócios atualmente classificados como Pessoa Politicamente Exposta.',
  totalHistoricallyPEP: 'Quantidade de sócios que já foram Pessoa Politicamente Exposta em algum momento, mesmo que não sejam atualmente.',
  totalCurrentSanctioned: 'Quantidade de sócios com sanção atualmente ativa.',
  totalHistoricallySanctioned: 'Quantidade de sócios que já possuíram alguma sanção, mesmo que não estejam sancionados atualmente.',
  averageSanctionsPerOwner: 'Média de sanções por sócio, arredondada para o número inteiro mais próximo.',
  averageSanctionsPerOwnerExact: 'Média exata de sanções por sócio, sem arredondamento.',
  pepPercentage: 'Percentual de sócios classificados como Pessoa Politicamente Exposta.',
  ownerMaxSanctions: 'Maior quantidade de sanções encontrada entre os sócios.',
  ownerMinSanctions: 'Menor quantidade de sanções encontrada entre os sócios.',
  activeOwners: 'Lista de CPFs ou CNPJs dos sócios atualmente ativos no quadro societário.',
  inactiveOwners: 'Lista de CPFs ou CNPJs dos sócios que não fazem mais parte do quadro societário.',
  totalRelatedPeopleEmails: 'Quantidade de e-mails encontrados para pessoas relacionadas ao CPF consultado.',
  relatedPeopleEmailsList: 'Lista resumida de e-mails encontrados para pessoas relacionadas ao CPF consultado.',
  relatedPeopleEmails: 'Lista estruturada dos e-mails de pessoas relacionadas, com relacionamento e sinais de uso de cada e-mail, usada para renderização em tabela.',
  totalRelatedPeoplePhones: 'Quantidade de telefones encontrados para pessoas relacionadas ao CPF consultado.',
  relatedPeoplePhonesList: 'Lista resumida de telefones encontrados para pessoas relacionadas ao CPF consultado.',
  relatedPeoplePhones: 'Lista estruturada dos telefones de pessoas relacionadas, com relacionamento e sinais de uso de cada telefone, usada para renderização em tabela.',
  totalRelatedPeopleAddresses: 'Quantidade de endereços encontrados para pessoas relacionadas ao CNPJ consultado.',
  relatedPeopleAddressesList: 'Lista resumida de endereços encontrados para pessoas relacionadas ao CNPJ consultado.',
  relatedPeopleAddresses: 'Lista estruturada dos endereços de pessoas relacionadas, com relacionamento e sinais de uso de cada endereço, usada para renderização em tabela.',
  pollingPlace: 'Nome do local de votação retornado pelo TSE.',
  pollingPlaceAddress: 'Endereço vigente do local de votação retornado pelo TSE.',
  electoralZone: 'Zona eleitoral do local de votação.',
  electoralSection: 'Seção eleitoral do local de votação.',
  hasBiometrics: 'Indica se o TSE retornou biometria cadastrada para a pessoa.',
  onlineQuery: 'Resumo legível do retorno de local de votação do TSE.',
  uboSummary: 'Resumo da consulta de Beneficiários Finais.',
  uboTotalCompaniesInGroup: 'Quantidade de empresas identificadas no grupo econômico.',
  uboTotalPeopleInGroup: 'Quantidade de pessoas identificadas no grupo econômico.',
  uboNumberOfOwners: 'Quantidade de sócios beneficiários finais identificados.',
  uboBeneficialOwners: 'Lista consolidada dos beneficiários finais, com percentual de participação agregado, usada para renderização em tabela.',
  uboParticipations: 'Lista achatada das participações societárias do grupo econômico, incluindo os níveis indiretos, usada para renderização em tabela.',
  totalPublicProjects: 'Quantidade total de projetos com financiamento público encontrados.',
  publicProjectsSummary: 'Resumo da consulta de Projetos Públicos.',
  publicProjects: 'Lista estruturada dos projetos com financiamento público encontrados, usada para renderização em tabela.',
  pgfnSummary: 'Resumo da consulta de Débitos com a PGFN.',
  pgfnBaseStatus: 'Status simplificado da certidão de débitos junto à PGFN.',
  pgfnClearance: 'Indica se não há pendências junto à Procuradoria-Geral da Fazenda Nacional.',
  pgfnEmissionDate: 'Data de emissão da certidão de débitos junto à PGFN.',
  pgfnCertificateUrl: 'Link para o arquivo da certidão de débitos junto à PGFN.',
  pcdSummary: 'Resumo da consulta de Cota de PCD.',
  pcdBaseStatus: 'Status do cumprimento da cota legal de contratação de pessoas com deficiência e beneficiários reabilitados.',
  pcdExpeditionDate: 'Data de emissão da certidão de cota de PCD.',
  pcdCertificateUrl: 'Link para o arquivo da certidão de cota de PCD.',
  pcdContent: 'Texto integral da certidão de cota de PCD.',
  totalCivilConstructionRecords: 'Quantidade total de obras civis encontradas para o CNPJ.',
  totalActiveCivilConstructionRecords: 'Quantidade de obras civis ativas encontradas para o CNPJ.',
  civilConstructionSummary: 'Resumo da consulta de Obras Civis.',
  civilConstructionRecords: 'Lista estruturada das obras civis encontradas, conforme o Cadastro Nacional de Obras (CNO), usada para renderização em tabela.',
  numberOfOwners: 'Número total de sócios da empresa.',
  numberOfPeopleAsOwners: 'Número de sócios pessoa física da empresa.',
  numberOfCompaniesAsOwners: 'Número de sócios pessoa jurídica da empresa.',
  hasMajorityStakeHolder: 'Indica se a empresa possui sócio majoritário.',
  averageParticipationPercentage: 'Percentual médio de participação societária entre os sócios da empresa.',
  maxParticipationPercentage: 'Maior percentual de participação societária entre os sócios da empresa.',
  minParticipationPercentage: 'Menor percentual de participação societária entre os sócios da empresa.',
  firstOwnerEntryDate: 'Data de entrada do sócio mais antigo da empresa.',
  lastOwnerEntryDate: 'Data de entrada do sócio mais recente da empresa.',
  ownerParticipationSummary: 'Resumo da consulta de percentual de participação societária.',
  ownerParticipations: 'Lista estruturada de cada participação societária, usada para renderização em tabela.',
  cguSummary: 'Resumo da consulta de Certidão Negativa Correcional CGU.',
  cguBaseStatus: 'Status simplificado da certidão correcional da CGU.',
  cguClearance: 'Indica se não há registros restritivos junto à CGU.',
  cguValidUntil: 'Data de validade da certidão correcional da CGU.',
  cguIssueDate: 'Data de emissão da certidão correcional da CGU.',
  cguCertificateUrl: 'Link para o arquivo da certidão correcional da CGU.',
  cnjSummary: 'Resumo da consulta de Certidão Negativa CNJ.',
  cnjBaseStatus: 'Status simplificado da certidão de condenações cíveis do CNJ.',
  cnjClearance: 'Indica se não há condenações por improbidade administrativa junto ao CNJ.',
  cnjIssueDate: 'Data de emissão da certidão de condenações cíveis do CNJ.',
  cnjCertificateUrl: 'Link para o arquivo da certidão de condenações cíveis do CNJ.',
  stateDebtSummary: 'Resumo da consulta de Certidão Negativa de Débitos Estaduais.',
  stateDebtBaseStatus: 'Status simplificado da certidão de débitos estaduais.',
  stateDebtClearance: 'Indica se não há débitos estaduais associados à empresa.',
  stateDebtState: 'Unidade federativa (UF) a que se refere a certidão de débitos estaduais.',
  stateDebtRegistration: 'Situação cadastral estadual (CAD/ICMS) da empresa.',
  stateDebtValidUntil: 'Data de validade da certidão de débitos estaduais.',
  stateDebtCertificateUrl: 'Link para o arquivo da certidão de débitos estaduais.',
  simplesSummary: 'Resumo da consulta de Optante pelo Simples Nacional.',
  simplesOfficialName: 'Nome oficial da empresa retornado pela Receita Federal.',
  simplesNationalStatus: 'Situação da empresa como optante pelo Simples Nacional.',
  simplesMeiStatus: 'Situação da empresa como optante pelo SIMEI.',
  simplesCertificateUrl: 'Link para o comprovante de Optante pelo Simples Nacional.',
  economicGroupKycSummary: 'Resumo da consulta de KYC e Compliance do Grupo Econômico.',
  economicGroupTotalCurrentPep: 'Quantidade de entidades do grupo econômico atualmente classificadas como Pessoa Politicamente Exposta.',
  economicGroupTotalHistoricalPep: 'Quantidade de entidades do grupo econômico com histórico de exposição política.',
  economicGroupTotalCurrentSanctioned: 'Quantidade de entidades do grupo econômico atualmente sancionadas em listas restritivas.',
  economicGroupTotalHistoricalSanctioned: 'Quantidade de entidades do grupo econômico com histórico de sanções em listas restritivas.',
  economicGroupAverageSanctions: 'Média de sanções encontradas por empresa do grupo econômico consultado.',
};

const newCompanyServiceFieldDescriptionsEn = {
  score: 'Credit score returned by the bureau for the queried CNPJ.',
  riskLevel: 'Credit risk level returned in the query.',
  riskClassification: 'Credit risk classification returned in the query.',
  reasonCodes: 'Reasons, codes or factors returned to explain the score.',
  creditBureauSummary: 'Text summary of the main credit bureau data returned.',
  creditBureauDetails: 'Structured credit bureau data for consumption via the API.',
  origin: 'Functional source of the executed query.',
  queryDate: 'Date returned by the data source for the query.',
  hasRestrictions: 'Indicates whether credit restrictions were returned.',
  restrictionCount: 'Number of restrictions returned in the query.',
  negativeFlagsCount: 'Number of negative flags returned in the query.',
  totalEconomicGroupRelationships: 'Number of economic group relationships found.',
  economicGroupRelationshipsSummary: 'Summary of the economic group relationships query.',
  economicGroupRelationships: 'Structured list of economic group relationships used for table rendering.',
  economicGroupCurrentRelationships: 'Structured list of the currently active economic group relationships.',
  economicGroupHistoricalRelationships: 'Structured list of the historical (ended) economic group relationships.',
  economicGroupRelationshipsStats: 'Consolidated statistics of the economic group relationships.',
  totalReputationSources: 'Number of review platforms with reputation data found.',
  reputationSummary: 'Summary of the reviews and reputation query.',
  reputationAndReviews: 'Structured list of reviews and reputation by source used for table rendering.',
  reputationSummaryDetails: 'Consolidated reviews and reputation statistics (totals by period, unified ratings, best and worst ratings).',
  reputationSummaryByDataSources: 'Text summary of reputation by source and company combination.',
  totalMovimentations: 'Number of daily movements found for the investment fund.',
  investmentFundDataSummary: 'Summary of the investment fund data query.',
  investmentFundData: 'Structured investment fund data used for table rendering.',
  influenceScore: "Influence score of the company's corporate structure.",
  ownersInfluenceSummary: "Summary of the corporate structure's influence query.",
  ownersInfluence: 'Structured corporate structure influence data used for table rendering.',
  pgmeiStatus: "MEI's status with Simples Nacional for the most recent reference year.",
  pgmeiReferenceYear: 'Most recent reference year found in the MEI collection query.',
  pgmeiPendingGuides: "Number of MEI collection slips not yet paid.",
  pgmeiSummary: 'Summary of the Simples Nacional Collection - MEI query.',
  pgmeiGuides: 'Structured list of the MEI monthly collection slips used for table rendering.',
  fgtsStatus: 'Simplified status of the issued FGTS compliance certificate.',
  fgtsCertificateNumber: 'Identifying number of the issued FGTS compliance certificate.',
  fgtsCertificateValidity: 'Validity period of the current FGTS compliance certificate.',
  fgtsCertificateText: 'Text content of the issued FGTS compliance certificate.',
  fgtsSummary: 'Summary of the FGTS compliance query.',
  fgtsDetails: 'Structured list with the FGTS certificate details used for table rendering.',
  totalMarketplacesUsed: "Number of marketplaces where the company sells its products.",
  totalStoresOperated: 'Total number of stores operated across the different marketplaces.',
  marketplaceWithMostProducts: 'Name of the marketplace with the highest number of products.',
  marketplaceWithBestRating: "Name of the marketplace where the company has the best rating.",
  totalProductsListed: 'Total number of products listed across the marketplaces.',
  marketplaceSummary: 'Summary of the Marketplaces query.',
  marketplaceDetails: "Structured list with the details of the company's presence in each marketplace, used for table rendering.",
  onlineAdsTotalPhones: 'Number of phone numbers linked to online ads found.',
  onlineAdsSummary: 'Summary of the Online Ads query.',
  onlineAds: 'Structured list of the online ads found by phone number, used for table rendering.',
  qsaCompanyType: 'Indicates whether the queried CNPJ is a HEADQUARTERS (MATRIZ) or BRANCH (FILIAL).',
  qsaCompanySize: 'Company size per Federal Revenue classification.',
  qsaCapital: "Company's share capital amount.",
  qsaCapitalValue: "Numeric value of the company's share capital, extracted from the Share Capital field for use in rules and comparisons.",
  qsaCnae: 'Main economic activity code.',
  qsaMainEconomicActivity: 'Description of the main economic activity.',
  qsaSecondaryActivity: 'Description of the secondary economic activities.',
  qsaLegalNatureCode: "Code of the company's legal nature.",
  qsaLegalNature: "Description of the company's legal nature.",
  qsaIrsStatus: "Company's registration status at the Federal Revenue.",
  qsaIsActive: "Indicates whether the CNPJ's registration status is ACTIVE (ATIVA), derived from the Registration Status field.",
  qsaStatusDate: 'Date of the registration status.',
  qsaPartnersCount: 'Number of partners and officers found in the QSA.',
  qsaSummary: 'Summary of the QSA - Federal Revenue query.',
  qsaPartners: 'Structured list of the QSA partners and officers used for table rendering.',
  companyOwnersLawsuitsTotalOwners: 'Number of partners the company has.',
  companyOwnersLawsuitsMaxPerOwner: 'Highest number of lawsuits held by one of the partners.',
  companyOwnersLawsuitsAvgPerOwner: 'Average number of lawsuits per partner.',
  companyOwnersLawsuitsMinPerOwner: 'Lowest number of lawsuits held by one of the partners.',
  companyOwnersLawsuitsAsAuthor: 'Number of lawsuits in which the partners appear as plaintiffs.',
  companyOwnersLawsuitsAsDefendant: 'Number of lawsuits in which the partners appear as defendants.',
  companyOwnersLawsuitsAsOther: 'Number of lawsuits in which the partners participate in another category.',
  companyOwnersLawsuitsTotal: "Total lawsuits involving the company's partners.",
  companyOwnersLawsuitsRelatedToLawyers: 'Indicates whether any partner has a relationship with lawyers in the lawsuits found.',
  companyOwnersLawsuitsRelatedToJudges: 'Indicates whether any partner has a relationship with judges in the lawsuits found.',
  companyOwnersLawsuitsFirstDate: 'Date of the oldest lawsuit found for the partners.',
  companyOwnersLawsuitsLastDate: 'Date of the most recent lawsuit found for the partners.',
  companyOwnersLawsuitsLast30Days: "Number of the partners' lawsuits started in the last 30 days.",
  companyOwnersLawsuitsLast90Days: "Number of the partners' lawsuits started in the last 90 days.",
  companyOwnersLawsuitsLast180Days: "Number of the partners' lawsuits started in the last 180 days.",
  companyOwnersLawsuitsLast365Days: "Number of the partners' lawsuits started in the last 365 days.",
  companyOwnersLawsuitsSummary: "Summary of the Partners' Lawsuit Distribution query.",
  companyOwnersLawsuitsDistribution: "Aggregated distribution of the partners' lawsuits by type, court, status, state, party role and subject, used for table/chart rendering.",
  companyLawsuitsTotal: "Total of the company's lawsuits.",
  companyLawsuitsFirstDate: 'Date of the oldest lawsuit found for the company.',
  companyLawsuitsLastDate: 'Date of the most recent lawsuit found for the company.',
  companyLawsuitsLast30Days: "Number of the company's lawsuits started in the last 30 days.",
  companyLawsuitsLast90Days: "Number of the company's lawsuits started in the last 90 days.",
  companyLawsuitsLast180Days: "Number of the company's lawsuits started in the last 180 days.",
  companyLawsuitsLast365Days: "Number of the company's lawsuits started in the last 365 days.",
  companyLawsuitsSummary: 'Summary of the Lawsuit Distribution query.',
  companyLawsuitsDistribution: "Aggregated distribution of the company's lawsuits by type, court, status, state, party role and subject, used for table/chart rendering.",
  laborLawsuitsStatus: 'Simplified status of the issued Labor Lawsuits certificate.',
  laborLawsuitsProtocol: 'Protocol number of the issued certificate.',
  laborLawsuitsCertificateNumber: 'Number of the issued Labor Lawsuits certificate.',
  laborLawsuitsIssuedDate: 'Issue date of the Labor Lawsuits certificate.',
  laborLawsuitsContent: 'Text content of the Labor Lawsuits certificate returned by the source.',
  laborLawsuitsProcessesCount: 'Number of labor lawsuits found in the certificate.',
  laborLawsuitsSummary: 'Summary of the Labor Lawsuits query.',
  laborLawsuitsProcesses: 'Structured list of the labor lawsuits found, with case number and court, used for table rendering.',
  employeesKycTotalEmployees: 'Total number of employees with KYC and Compliance data returned.',
  employeesKycCurrentlyPepCount: 'Number of employees currently classified as a Politically Exposed Person.',
  employeesKycCurrentlySanctionedCount: 'Number of employees with a currently active sanction.',
  employeesKycPreviouslySanctionedCount: 'Number of employees who have had any sanction in the past.',
  employeesKycFlaggedCount: 'Number of distinct employees flagged as PEP or with any sanction.',
  employeesKycSummary: 'Summary of the Employee KYC and Compliance query.',
  employeesKycFlagged: 'Structured list of the employees classified as PEP or with sanctions found, used for table rendering.',
  historyBasicDataCurrentName: "Company's current name at the Federal Revenue.",
  historyBasicDataAge: "Company's current age in years.",
  historyBasicDataTotalChanges: 'Total number of registration changes found in the history.',
  historyBasicDataSummary: 'Summary of the Basic Data History query.',
  historyBasicDataStats: 'Consolidated statistics of the registration changes found.',
  historyBasicDataNameHistory: "Structured list of the company's name change history.",
  historyBasicDataTaxRegimeHistory: 'Structured list of the tax regime change history.',
  historyBasicDataTaxIdStatusHistory: 'Structured list of the registration status change history at the Federal Revenue.',
  historyBasicDataCnaeHistory: 'Structured list of the CNAE change history.',
  historyBasicDataCapitalHistory: 'Structured list of the share capital change history.',
  merchantCategoryHasDirectAssociation: "Indicates whether the merchant category was obtained through a direct association of the CNPJ with the Abecs source.",
  merchantCategoryHasMultipleCodes: 'Indicates whether multiple merchant category codes (MCC) were returned for the company.',
  merchantCategorySummary: 'Summary of the Merchant Category query.',
  merchantCategoryCategories: "Structured list of the merchant categories (MCC) directly associated with the company.",
  merchantCategoryCnaeCategories: "Structured list of the merchant categories (MCC) associated with the company's CNAE codes.",
  syndicateAgreementsTotal: 'Total number of union agreements found, active or not.',
  syndicateAgreementsTotalActive: 'Number of currently active union agreements.',
  syndicateAgreementsSummary: 'Summary of the Union Agreements query.',
  syndicateAgreementsStats: 'Consolidated statistics of the union agreements found.',
  syndicateAgreements: 'Structured list of the union agreements found, used for table rendering.',
  phonesExtendedCompanyTotal: 'Total number of phone numbers found for the company.',
  phonesExtendedCompanyTotalActive: 'Number of active phone numbers found for the company.',
  phonesExtendedCompanySummary: 'Summary of the Phone Numbers query.',
  phonesExtendedCompanyStats: 'Consolidated statistics of the phone numbers found.',
  phonesExtendedCompany: 'Structured list of the phone numbers found, used for table rendering.',
  companyEvolutionSummary: "Summary of the Company Evolution query.",
  companyEvolutionStats: "Consolidated statistics of the company's capital, headcount, branches and partners evolution over time.",
  addressesExtendedTotal: 'Total number of addresses found for the company.',
  addressesExtendedTotalActive: 'Number of addresses currently marked as active.',
  addressesExtendedTotalWork: 'Number of addresses of the commercial type.',
  addressesExtendedTotalPersonal: 'Number of addresses of the residential type.',
  addressesExtendedTotalUnique: 'Number of unique addresses, without duplicates.',
  addressesExtendedTotalPassages: 'Total number of passages (confirmations) recorded across the addresses found.',
  addressesExtendedTotalBadPassages: 'Number of passages flagged as inconsistent across the addresses found.',
  addressesExtendedOldestPassageDate: 'Date of the oldest passage recorded across the addresses found.',
  addressesExtendedNewestPassageDate: 'Date of the most recent passage recorded across the addresses found.',
  totalCurrentPep: 'Number of partners currently classified as a Politically Exposed Person.',
  totalHistoricallyPEP: 'Number of partners who have been a Politically Exposed Person at some point, even if not currently.',
  totalCurrentSanctioned: 'Number of partners with a currently active sanction.',
  totalHistoricallySanctioned: 'Number of partners who have had any sanction in the past, even if not currently sanctioned.',
  averageSanctionsPerOwner: 'Average number of sanctions per partner, rounded to the nearest whole number.',
  averageSanctionsPerOwnerExact: 'Exact average number of sanctions per partner, without rounding.',
  pepPercentage: 'Percentage of partners classified as a Politically Exposed Person.',
  ownerMaxSanctions: 'Highest number of sanctions found among the partners.',
  ownerMinSanctions: 'Lowest number of sanctions found among the partners.',
  activeOwners: "List of CPFs or CNPJs of the partners currently active in the corporate structure.",
  inactiveOwners: "List of CPFs or CNPJs of the partners no longer part of the corporate structure.",
  totalRelatedPeopleEmails: 'Number of emails found for people related to the queried CPF.',
  relatedPeopleEmailsList: 'Short list of emails found for people related to the queried CPF.',
  relatedPeopleEmails: 'Structured list of the related people\'s emails, with relationship and usage signals for each email, used for table rendering.',
  totalRelatedPeoplePhones: 'Number of phone numbers found for people related to the queried CPF.',
  relatedPeoplePhonesList: 'Short list of phone numbers found for people related to the queried CPF.',
  relatedPeoplePhones: 'Structured list of the related people\'s phone numbers, with relationship and usage signals for each phone number, used for table rendering.',
  totalRelatedPeopleAddresses: 'Number of addresses found for people related to the queried CNPJ.',
  relatedPeopleAddressesList: 'Short list of addresses found for people related to the queried CNPJ.',
  relatedPeopleAddresses: 'Structured list of the related people\'s addresses, with relationship and usage signals for each address, used for table rendering.',
  pollingPlace: 'Name of the polling place returned by the TSE.',
  pollingPlaceAddress: 'Current address of the polling place returned by the TSE.',
  electoralZone: 'Electoral zone of the polling place.',
  electoralSection: 'Electoral section of the polling place.',
  hasBiometrics: 'Indicates whether the TSE returned registered biometrics for the person.',
  onlineQuery: "Readable summary of the TSE's polling place result.",
  uboSummary: 'Summary of the Ultimate Beneficial Owners query.',
  uboTotalCompaniesInGroup: 'Number of companies identified in the economic group.',
  uboTotalPeopleInGroup: 'Number of people identified in the economic group.',
  uboNumberOfOwners: 'Number of ultimate beneficial owner partners identified.',
  uboBeneficialOwners: 'Consolidated list of the ultimate beneficial owners, with aggregated ownership percentage, used for table rendering.',
  uboParticipations: 'Flattened list of the economic group ownership stakes, including indirect levels, used for table rendering.',
  totalPublicProjects: 'Total number of publicly funded projects found.',
  publicProjectsSummary: 'Summary of the Public Projects query.',
  publicProjects: 'Structured list of the publicly funded projects found, used for table rendering.',
  pgfnSummary: 'Summary of the PGFN Debts query.',
  pgfnBaseStatus: 'Simplified status of the PGFN debt certificate.',
  pgfnClearance: 'Indicates whether there are no pending items with the National Treasury Attorney General\'s Office.',
  pgfnEmissionDate: 'Issue date of the PGFN debt certificate.',
  pgfnCertificateUrl: 'Link to the PGFN debt certificate file.',
  pcdSummary: 'Summary of the Disability Hiring Quota query.',
  pcdBaseStatus: 'Status of compliance with the legal quota for hiring people with disabilities and rehabilitated beneficiaries.',
  pcdExpeditionDate: 'Issue date of the disability-hiring-quota certificate.',
  pcdCertificateUrl: 'Link to the disability-hiring-quota certificate file.',
  pcdContent: 'Full text of the disability-hiring-quota certificate.',
  totalCivilConstructionRecords: 'Total number of civil construction works found for the CNPJ.',
  totalActiveCivilConstructionRecords: 'Number of active civil construction works found for the CNPJ.',
  civilConstructionSummary: 'Summary of the Civil Construction Works query.',
  civilConstructionRecords: 'Structured list of the civil construction works found, per the National Works Registry (CNO), used for table rendering.',
  numberOfOwners: "Total number of the company's partners.",
  numberOfPeopleAsOwners: "Number of the company's individual (PF) partners.",
  numberOfCompaniesAsOwners: "Number of the company's corporate (PJ) partners.",
  hasMajorityStakeHolder: 'Indicates whether the company has a majority partner.',
  averageParticipationPercentage: "Average ownership share percentage among the company's partners.",
  maxParticipationPercentage: "Highest ownership share percentage among the company's partners.",
  minParticipationPercentage: "Lowest ownership share percentage among the company's partners.",
  firstOwnerEntryDate: "Entry date of the company's oldest partner.",
  lastOwnerEntryDate: "Entry date of the company's most recent partner.",
  ownerParticipationSummary: 'Summary of the ownership share percentage query.',
  ownerParticipations: 'Structured list of each ownership stake, used for table rendering.',
  cguSummary: 'Summary of the CGU Negative Disciplinary Certificate query.',
  cguBaseStatus: 'Simplified status of the CGU disciplinary certificate.',
  cguClearance: 'Indicates whether there are no restrictive records with the CGU.',
  cguValidUntil: 'Validity date of the CGU disciplinary certificate.',
  cguIssueDate: 'Issue date of the CGU disciplinary certificate.',
  cguCertificateUrl: 'Link to the CGU disciplinary certificate file.',
  cnjSummary: 'Summary of the CNJ Negative Certificate query.',
  cnjBaseStatus: "Simplified status of the CNJ's civil-conviction certificate.",
  cnjClearance: 'Indicates whether there are no convictions for administrative misconduct with the CNJ.',
  cnjIssueDate: "Issue date of the CNJ's civil-conviction certificate.",
  cnjCertificateUrl: "Link to the CNJ's civil-conviction certificate file.",
  stateDebtSummary: 'Summary of the Negative State Debt Certificate query.',
  stateDebtBaseStatus: 'Simplified status of the state debt certificate.',
  stateDebtClearance: 'Indicates whether there are no state debts associated with the company.',
  stateDebtState: 'State (UF) the state debt certificate refers to.',
  stateDebtRegistration: "Company's state registration status (CAD/ICMS).",
  stateDebtValidUntil: 'Validity date of the state debt certificate.',
  stateDebtCertificateUrl: 'Link to the state debt certificate file.',
  simplesSummary: 'Summary of the Simples Nacional Participant query.',
  simplesOfficialName: "Company's official name returned by the Federal Revenue.",
  simplesNationalStatus: "Company's status as a Simples Nacional participant.",
  simplesMeiStatus: "Company's status as a SIMEI participant.",
  simplesCertificateUrl: 'Link to the Simples Nacional Participant proof.',
  economicGroupKycSummary: 'Summary of the Economic Group KYC and Compliance query.',
  economicGroupTotalCurrentPep: 'Number of economic group entities currently classified as a Politically Exposed Person.',
  economicGroupTotalHistoricalPep: 'Number of economic group entities with a history of political exposure.',
  economicGroupTotalCurrentSanctioned: 'Number of economic group entities currently sanctioned on restrictive lists.',
  economicGroupTotalHistoricalSanctioned: 'Number of economic group entities with a history of sanctions on restrictive lists.',
  economicGroupAverageSanctions: 'Average number of sanctions found per company in the queried economic group.',
};

const newCompanyServiceAliases = new Set([
  'SERVICE_RELATED_PEOPLE_EMAILS',
  'SERVICE_RELATED_PEOPLE_PHONES',
  'SERVICE_RELATED_PEOPLE_ADDRESSES',
  'SERVICE_QUOD_CREDIT_SCORE_PERSON',
  'SERVICE_BOAVISTA_ONE_SCORE_PERSON',
  'SERVICE_BOAVISTA_CREDIT_SCORE_PERSON',
  'SERVICE_QUOD_CREDIT_RISK_PERSON',
  'SERVICE_ONDEMAND_TSE_POLLING_PLACE_PERSON_CPF',
  'SERVICE_ULTIMATE_BENEFICIAL_OWNERS',
  'SERVICE_PUBLIC_PROJECTS',
  'SERVICE_PGFN_COMPANY',
  'SERVICE_PCD_COMPANY',
  'SERVICE_CIVIL_CONSTRUCTION',
  'SERVICE_BOAVISTA_OWNER_PARTICIPATION_DATA_COMPANY',
  'SERVICE_QUANTUM_CUSTOM_SCORE_COMPANY',
  'SERVICE_CGU_NEGATIVE_CERTIFICATE_COMPANY',
  'SERVICE_CNJ_NEGATIVE_CERTIFICATE_COMPANY',
  'SERVICE_STATE_DEBT_CERTIFICATE_COMPANY',
  'SERVICE_SIMPLES_COMPANY',
  'SERVICE_ECONOMIC_GROUP_KYC_COMPANY',
  'SERVICE_ADDRESSES_EXTENDED_CNPJ',
  'SERVICE_COMPANY_KYC_OWNERS',
  'SERVICE_QUOD_CREDIT_SCORE_COMPANY',
  'SERVICE_BOAVISTA_ONE_SCORE_COMPANY',
  'SERVICE_BOAVISTA_CREDIT_SCORE_COMPANY',
  'SERVICE_QUOD_CREDIT_RISK_COMPANY',
  'SERVICE_ECONOMIC_GROUP_RELATIONSHIPS',
  'SERVICE_REPUTATIONS_AND_REVIEWS',
  'SERVICE_INVESTMENT_FUND_DATA',
  'SERVICE_OWNERS_INFLUENCE',
  'SERVICE_PGMEI',
  'SERVICE_FGTS',
  'SERVICE_MARKETPLACE_DATA',
  'SERVICE_ONLINE_ADS',
  'SERVICE_RF_QSA',
  'SERVICE_OWNERS_LAWSUITS_DISTRIBUTION',
  'SERVICE_LAWSUITS_DISTRIBUTION_DATA_COMPANY',
  'SERVICE_LABOR_LAWSUITS',
  'SERVICE_EMPLOYEES_KYC',
  'SERVICE_HISTORY_BASIC_DATA',
  'SERVICE_MERCHANT_CATEGORY_DATA',
  'SERVICE_SYNDICATE_AGREEMENTS',
  'SERVICE_PHONES_EXTENDED_COMPANY',
  'SERVICE_COMPANY_EVOLUTION',
]);

function resultFieldDescription(service, fieldName, lang = 'pt') {
  if (lang === 'en') {
    if (newCompanyServiceAliases.has(service.service) && newCompanyServiceFieldDescriptionsEn[fieldName]) {
      return newCompanyServiceFieldDescriptionsEn[fieldName];
    }

    const fieldEn = normalizeText(fieldName);
    const serviceTextEn = normalizeText(service.name + ' ' + service.service + ' ' + service.responseSummary);

    if (fieldEn === 'summary') return 'Functional summary of the data returned by the service.';
    if (fieldEn === 'observation') return 'Note about the variation or availability of the returned data.';
    if (fieldEn === 'cpf') return 'CPF related to the query result.';
    if (fieldEn === 'cnpj') return 'CNPJ related to the query result.';
    if (fieldEn === 'name' || fieldEn === 'fullname') return 'Full name returned by the query when available.';
    if (fieldEn === 'shortname') return 'Short name or abbreviated form returned by the query.';
    if (fieldEn === 'status') return 'Main status returned by the queried product.';
    if (fieldEn === 'message') return 'Readable message about the result or processing.';
    if (fieldEn === 'score') return 'Score calculated by the product for the queried indicator.';
    if (fieldEn === 'factor') return 'Factor, band or classification used to interpret the score.';
    if (fieldEn === 'similarity') return 'Similarity percentage returned in biometric or facial validations.';
    if (fieldEn === 'facefound') return 'Indicates whether the facial search found a matching face in the database.';
    if (fieldEn === 'doctype' || fieldEn === 'documenttype') return 'Document type identified in the processing.';
    if (fieldEn === 'genericocr') return 'Raw text extracted from the document by OCR.';
    if (fieldEn.includes('address')) return 'Address, list of addresses or address validation returned by the query.';
    if (fieldEn.includes('phone')) return 'Phone number, phone history or phone validation returned by the query.';
    if (fieldEn.includes('email')) return 'Email, email history or email validation returned by the query.';
    if (fieldEn.includes('date')) return 'Date returned by the query, depending on the service context.';
    if (fieldEn.includes('amount') || fieldEn.includes('value')) return 'Monetary value, estimate or amount returned by the query.';
    if (fieldEn.includes('risk')) return 'Risk indicator returned by the product.';
    if (fieldEn.includes('news') || fieldEn.includes('media')) return 'News, media exposure or public indicators associated with the document.';
    if (fieldEn.includes('relationship') || fieldEn.includes('people') || fieldEn.includes('owners')) return 'Ties, people, partners or relationships returned by the query.';
    if (fieldEn.includes('ocr')) return 'Information extracted or interpreted from the submitted image.';
    if (serviceTextEn.includes('ocr')) return 'Field extracted from the document submitted for OCR.';

    return "Field returned in the result object for the client's consumption.";
  }

  if (newCompanyServiceAliases.has(service.service) && newCompanyServiceFieldDescriptions[fieldName]) {
    return newCompanyServiceFieldDescriptions[fieldName];
  }

  const field = normalizeText(fieldName);
  const serviceText = normalizeText(service.name + ' ' + service.service + ' ' + service.responseSummary);

  if (field === 'summary') return 'Resumo funcional dos dados retornados pelo service.';
  if (field === 'observation') return 'Observação sobre variação ou disponibilidade dos dados retornados.';
  if (field === 'cpf') return 'CPF relacionado ao resultado da consulta.';
  if (field === 'cnpj') return 'CNPJ relacionado ao resultado da consulta.';
  if (field === 'name' || field === 'fullname') return 'Nome completo retornado pela consulta quando disponível.';
  if (field === 'shortname') return 'Nome curto ou forma resumida retornada pela consulta.';
  if (field === 'status') return 'Situação principal retornada pelo produto consultado.';
  if (field === 'message') return 'Mensagem de leitura do resultado ou do processamento.';
  if (field === 'score') return 'Pontuação calculada pelo produto para o indicador consultado.';
  if (field === 'factor') return 'Fator, faixa ou classificação usada para interpretar o score.';
  if (field === 'similarity') return 'Percentual de similaridade retornado em validações biométricas ou faciais.';
  if (field === 'facefound') return 'Indica se a busca facial encontrou uma face correspondente na base.';
  if (field === 'doctype' || field === 'documenttype') return 'Tipo de documento identificado no processamento.';
  if (field === 'genericocr') return 'Texto bruto extraído do documento por OCR.';
  if (field.includes('address')) return 'Endereço, lista de endereços ou validação de endereço retornada pela consulta.';
  if (field.includes('phone')) return 'Telefone, histórico de telefones ou validação de telefone retornada pela consulta.';
  if (field.includes('email')) return 'E-mail, histórico de e-mails ou validação de e-mail retornada pela consulta.';
  if (field.includes('date')) return 'Data retornada pela consulta, conforme o contexto do service.';
  if (field.includes('amount') || field.includes('value')) return 'Valor monetário, estimativa ou montante retornado pela consulta.';
  if (field.includes('risk')) return 'Indicador de risco retornado pelo produto.';
  if (field.includes('news') || field.includes('media')) return 'Notícias, exposição em mídia ou indicadores públicos associados ao documento.';
  if (field.includes('relationship') || field.includes('people') || field.includes('owners')) return 'Vínculos, pessoas, sócios ou relacionamentos retornados pela consulta.';
  if (field.includes('ocr')) return 'Informação extraída ou interpretada a partir da imagem enviada.';
  if (serviceText.includes('ocr')) return 'Campo extraído do documento enviado para OCR.';

  return 'Campo retornado no objeto result para consumo do cliente.';
}

function resultRowsFromService(service, lang = 'pt') {
  const result = serviceResponseExample(service, lang).result || {};
  return Object.keys(result).slice(0, 12).map((name) => ({
    name,
    description: resultFieldDescription(service, name, lang),
  }));
}

function resultKeysSummary(service, lang = 'pt') {
  const keys = Object.keys(serviceResponseExample(service, lang).result || {});
  if (lang === 'en') {
    if (!keys.length) return 'no fixed fields in the summarized example';
    const visibleEn = keys.slice(0, 6).map((key) => '\`' + key + '\`').join(', ');
    return keys.length > 6 ? visibleEn + ' and ' + (keys.length - 6) + ' more' : visibleEn;
  }
  if (!keys.length) return 'sem campos fixos no exemplo resumido';
  const visible = keys.slice(0, 6).map((key) => '\`' + key + '\`').join(', ');
  return keys.length > 6 ? visible + ' e mais ' + (keys.length - 6) : visible;
}

function pushServiceSummaryCards(lines, service, required, optional, lang = 'pt') {
  if (lang === 'en') {
    lines.push('<CardGroup cols={2}>');
    lines.push(' <Card icon="arrow-right-to-bracket" title="Input">');
    lines.push(' Required fields: ' + required + '.');
    lines.push(' </Card>');
    lines.push(' <Card icon="list-check" title="Result">');
    lines.push(' Main fields in \`result\`: ' + resultKeysSummary(service, lang) + '.');
    lines.push(' </Card>');
    lines.push(' <Card icon="circle-info" title="Call status">');
    lines.push(' Use \`status.code\` and \`status.message\` to understand whether the query processed correctly.');
    lines.push(' </Card>');
    lines.push(' <Card icon="sliders" title="Optional fields">');
    lines.push(' ' + optional);
    lines.push(' </Card>');
    lines.push('</CardGroup>');
    lines.push('');
    return;
  }
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card icon="arrow-right-to-bracket" title="Entrada">');
  lines.push(' Campos obrigatórios: ' + required + '.');
  lines.push(' </Card>');
  lines.push(' <Card icon="list-check" title="Resultado">');
  lines.push(' Principais campos em \`result\`: ' + resultKeysSummary(service) + '.');
  lines.push(' </Card>');
  lines.push(' <Card icon="circle-info" title="Status da chamada">');
  lines.push(' Use \`status.code\` e \`status.message\` para entender se a consulta processou corretamente.');
  lines.push(' </Card>');
  lines.push(' <Card icon="sliders" title="Campos opcionais">');
  lines.push(' ' + optional);
  lines.push(' </Card>');
  lines.push('</CardGroup>');
  lines.push('');
}

function pushPublicResponseCards(lines, lang = 'pt') {
  if (lang === 'en') {
    lines.push('### How to consume the response');
    lines.push('');
    lines.push('<CardGroup cols={2}>');
    lines.push(' <Card icon="database" title="result">');
    lines.push(' Public data from the service. It is the main object to map into the client\'s system.');
    lines.push(' </Card>');
    lines.push(' <Card icon="circle-check" title="status">');
    lines.push(' Technical status of the call, with \`code\` and \`message\`.');
    lines.push(' </Card>');
    lines.push(' <Card icon="flag" title="onboardingStatus">');
    lines.push(' When returned, summarizes the operational outcome: \`APPROVED\`, \`REFUSED\` or \`ERROR\`.');
    lines.push(' </Card>');
    lines.push(' <Card icon="fingerprint" title="externalId">');
    lines.push(' Identifier to trace the query in support, logs or audits.');
    lines.push(' </Card>');
    lines.push('</CardGroup>');
    lines.push('');
    return;
  }
  lines.push('### Como consumir o retorno');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card icon="database" title="result">');
  lines.push(' Dados públicos do service. É o objeto principal para mapear no sistema do cliente.');
  lines.push(' </Card>');
  lines.push(' <Card icon="circle-check" title="status">');
  lines.push(' Status técnico da chamada, com \`code\` e \`message\`.');
  lines.push(' </Card>');
  lines.push(' <Card icon="flag" title="onboardingStatus">');
  lines.push(' Quando retornado, resume o desfecho operacional: \`APPROVED\`, \`REFUSED\` ou \`ERROR\`.');
  lines.push(' </Card>');
  lines.push(' <Card icon="fingerprint" title="externalId">');
  lines.push(' Identificador para rastrear a consulta em suporte, logs ou auditoria.');
  lines.push(' </Card>');
  lines.push('</CardGroup>');
  lines.push('');
}

function pushServiceExecutionTabs(lines, body, hmlCurl, prodCurl, lang = 'pt') {
  if (lang === 'en') {
    lines.push('### Copy and test');
    lines.push('');
    lines.push('<Tabs>');
    lines.push('<Tab title="JSON body">');
    lines.push('');
    lines.push('Use this body in Postman under `Body > raw > JSON`. Only change the test values.');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(body, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('</Tab>');
    lines.push('<Tab title="Curl HML">');
    lines.push('');
    lines.push('```bash');
    lines.push(hmlCurl);
    lines.push('```');
    lines.push('');
    lines.push('</Tab>');
    lines.push('<Tab title="Curl production">');
    lines.push('');
    lines.push('```bash');
    lines.push(prodCurl);
    lines.push('```');
    lines.push('');
    lines.push('</Tab>');
    lines.push('</Tabs>');
    lines.push('');
    return;
  }
  lines.push('### Copiar e testar');
  lines.push('');
  lines.push('<Tabs>');
  lines.push('<Tab title="Body JSON">');
  lines.push('');
  lines.push('Use este body no Postman em `Body > raw > JSON`. Troque apenas os valores de teste.');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(body, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</Tab>');
  lines.push('<Tab title="Curl HML">');
  lines.push('');
  lines.push('```bash');
  lines.push(hmlCurl);
  lines.push('```');
  lines.push('');
  lines.push('</Tab>');
  lines.push('<Tab title="Curl produção">');
  lines.push('');
  lines.push('```bash');
  lines.push(prodCurl);
  lines.push('```');
  lines.push('');
  lines.push('</Tab>');
  lines.push('</Tabs>');
  lines.push('');
}

function pushApiReferenceReturnCards(lines, lang = 'pt') {
  if (lang === 'en') {
    lines.push('## How to interpret any response');
    lines.push('');
    lines.push('<CardGroup cols={2}>');
    lines.push(' <Card icon="database" title="Useful data">');
    lines.push(' Read the `result` object first. It concentrates the business fields the client should consume.');
    lines.push(' </Card>');
    lines.push(' <Card icon="gauge" title="Technical status">');
    lines.push(' Use `status.code` and `status.message` to understand whether the call processed, was refused or failed.');
    lines.push(' </Card>');
    lines.push(' <Card icon="magnifying-glass" title="Traceability">');
    lines.push(' Keep `externalId` for tests, support and audits. It is the most practical identifier for the query.');
    lines.push(' </Card>');
    lines.push(' <Card icon="file-lines" title="Clean contract">');
    lines.push(' Do not rely on internal metadata. The integration should only map the documented public fields.');
    lines.push(' </Card>');
    lines.push('</CardGroup>');
    lines.push('');
    return;
  }
  lines.push('## Como interpretar qualquer retorno');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card icon="database" title="Dados úteis">');
  lines.push(' Leia primeiro o objeto `result`. Ele concentra os campos de negócio que o cliente deve consumir.');
  lines.push(' </Card>');
  lines.push(' <Card icon="gauge" title="Status técnico">');
  lines.push(' Use `status.code` e `status.message` para entender se a chamada processou, recusou ou falhou.');
  lines.push(' </Card>');
  lines.push(' <Card icon="magnifying-glass" title="Rastreio">');
  lines.push(' Guarde `externalId` em testes, suporte e auditoria. Ele é o identificador mais prático da consulta.');
  lines.push(' </Card>');
  lines.push(' <Card icon="file-lines" title="Contrato limpo">');
  lines.push(' Não dependa de metadados internos. A integração deve mapear somente os campos públicos documentados.');
  lines.push(' </Card>');
  lines.push('</CardGroup>');
  lines.push('');
}

function pushApiReferenceChecklist(lines, lang = 'pt') {
  if (lang === 'en') {
    lines.push('## Checklist before opening a ticket');
    lines.push('');
    lines.push('<CardGroup cols={2}>');
    lines.push(' <Card icon="key" title="Access">');
    lines.push(' Confirm the token belongs to the right product and that the service is enabled for the API.');
    lines.push(' </Card>');
    lines.push(' <Card icon="code" title="Payload">');
    lines.push(' Confirm the exact `service` value and the required fields listed in the accordion.');
    lines.push(' </Card>');
    lines.push(' <Card icon="globe" title="Environment">');
    lines.push(' Validate whether the call was made in HML or production with the token from the same environment.');
    lines.push(' </Card>');
    lines.push(' <Card icon="camera" title="Evidence">');
    lines.push(' Keep the body without sensitive data, timestamp, environment, `status.message` and `externalId`.');
    lines.push(' </Card>');
    lines.push('</CardGroup>');
    lines.push('');
    return;
  }
  lines.push('## Checklist antes de abrir chamado');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card icon="key" title="Acesso">');
  lines.push(' Confirme se o token pertence ao produto certo e se o service está ativo para API.');
  lines.push(' </Card>');
  lines.push(' <Card icon="code" title="Payload">');
  lines.push(' Confirme o valor exato de `service` e os campos obrigatórios listados no accordion.');
  lines.push(' </Card>');
  lines.push(' <Card icon="globe" title="Ambiente">');
  lines.push(' Valide se a chamada foi feita em HML ou produção com o token do mesmo ambiente.');
  lines.push(' </Card>');
  lines.push(' <Card icon="camera" title="Evidência">');
  lines.push(' Separe body sem dados sensíveis, horário, ambiente, `status.message` e `externalId`.');
  lines.push(' </Card>');
  lines.push('</CardGroup>');
  lines.push('');
}

function pushResultFieldsTable(lines, service, lang = 'pt') {
  const rows = resultRowsFromService(service, lang);
  if (!rows.length) return;
  if (lang === 'en') {
    lines.push('### Main result fields');
    lines.push('');
    lines.push('| Field | Description |');
    lines.push('| --- | --- |');
    for (const row of rows) {
      lines.push('| \`result.' + row.name + '\` | ' + row.description + ' |');
    }
    lines.push('');
    return;
  }
  lines.push('### Campos principais do result');
  lines.push('');
  lines.push('| Campo | Descrição |');
  lines.push('| --- | --- |');
  for (const row of rows) {
    lines.push('| \`result.' + row.name + '\` | ' + row.description + ' |');
  }
  lines.push('');
}

function renderServiceGuideBlock(service) {
  const body = jsonBodyFromRequestExample(service.requestExample);
  const fields = fieldRowsFromService(service);
  const requiredFields = fields.filter((field) => field.required && field.name !== 'service').map((field) => `\`${field.name}\``);
  const resultKeys = Object.keys(serviceResponseExample(service).result);
  const lines = [];

  lines.push(`<Accordion title="${escapeAttribute(service.name)}">`);
  lines.push('');
  if (service.familyLabel) {
    lines.push(`**Famlia:** ${service.familyLabel}`);
    lines.push('');
  }
  lines.push(`**Service:** \`${service.service}\``);
  lines.push('');
  lines.push(`**Termos de busca:** ${displaySearchTerms(service, 10)}`);
  lines.push('');
  lines.push(`**Quando usar:** ${serviceUseCase(service)}`);
  lines.push('');
  lines.push(`**O que retorna:** ${service.responseSummary}`);
  lines.push('');
  pushServiceSummaryCards(lines, service, requiredFields.length ? requiredFields.join(', ') : 'os campos exigidos pelo produto', 'Confira o API Reference para opcionais e variações por produto.');
  lines.push('**Passo a passo:**');
  lines.push('');
  lines.push('1. Gere um token em `POST /api/token-generate`.');
  lines.push(`2. Envie ${requiredFields.length ? requiredFields.join(', ') : 'os campos exigidos'} junto com \`service: ${service.service}\` em \`POST /api/service-api\`.`);
  lines.push('3. Confira `status.code` e `status.message` para saber se a consulta processou.');
  lines.push(`4. Leia \`result\`, que neste service costuma trazer: ${resultKeys.map((key) => `\`${key}\``).join(', ')}.`);
  lines.push('');
  lines.push('**Body exemplo:**');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(body, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('**Response resumido:**');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(serviceResponseExample(service), null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</Accordion>');

  return lines.join('\n');
}

function serviceErrorExamples(lang = 'pt') {
  if (lang === 'en') {
    return [
      {
        title: 'Missing or invalid token',
        body: {
          status: {
            code: 401,
            message: 'Unauthorized',
          },
        },
      },
      {
        title: 'Missing required parameter',
        body: {
          status: {
            code: 400,
            message: 'Required field is missing or invalid',
          },
        },
      },
      {
        title: 'Service not enabled or unavailable',
        body: {
          status: {
            code: 403,
            message: 'Service unavailable or not enabled for this client',
          },
        },
      },
    ];
  }

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

function renderServiceRequestBlock(service, lang = 'pt') {
  const body = jsonBodyFromRequestExample(service.requestExample);
  const fieldRows = fieldRowsFromService(service, lang);
  const hmlCurl = renderCurl({ baseUrl: 'https://backoffice-hml.idcerberus.com', path: '/api/service-api', body });
  const prodCurl = renderCurl({ baseUrl: 'https://backoffice.idcerberus.com', path: '/api/service-api', body });
  const lines = [];

  if (lang === 'en') {
    const requiredEn = fieldRows.filter((field) => field.required).map((field) => `\`${field.name}\``).join(', ');
    const optionalEn = fieldRows.filter((field) => !field.required).map((field) => `\`${field.name}\``).join(', ') || 'No optional field mapped in this example.';

    lines.push(`<Accordion title="${escapeAttribute(service.name)}" id="${escapeAttribute(service.service)}">`);
    lines.push('');
    lines.push(`**Service:** \`${service.service}\``);
    lines.push('');
    lines.push(`**When to use:** ${serviceUseCase(service, lang)}`);
    lines.push('');
    lines.push(`**What it returns:** ${service.responseSummary}`);
    lines.push('');
    pushServiceSummaryCards(lines, service, requiredEn || 'no additional field besides `service`', optionalEn, lang);
    lines.push('**Endpoint:** `POST /api/service-api`');
    lines.push('');
    lines.push(`**Required fields:** ${requiredEn}`);
    lines.push('');
    lines.push(`**Optional fields:** ${optionalEn}`);
    lines.push('');
    if (isOcrService(service)) {
      pushOcrApiReferenceBlock(lines, service, lang);
    }
    lines.push('### Step by step');
    lines.push('');
    lines.push('1. Generate the token at `POST /api/token-generate` and send it in the `Authorization: Bearer {jwt_token}` header.');
    lines.push('2. Build the body with the exact `service` and the required fields listed below.');
    lines.push('3. Run `POST /api/service-api` in the chosen environment.');
    lines.push('4. Check `status.code` and `status.message` to validate the technical processing.');
    lines.push('5. Map the `result` fields per the summary and the response example for this service.');
    lines.push('');
    pushServiceExecutionTabs(lines, body, hmlCurl, prodCurl, lang);
    lines.push('### Body fields');
    lines.push('');
    lines.push('| Field | Required | Description |');
    lines.push('| --- | --- | --- |');
    for (const field of fieldRows) {
      lines.push(`| \`${field.name}\` | ${field.required ? 'Yes' : 'No'} | ${field.description} |`);
    }
    lines.push('');
    pushResultFieldsTable(lines, service, lang);
    pushPublicResponseCards(lines, lang);
    lines.push('### Summarized response');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(serviceResponseExample(service, lang), null, 2));
    lines.push('```');
    lines.push('');
    lines.push(`In this service, the \`result\` object represents: ${service.responseSummary}`);
    lines.push('');
    lines.push('</Accordion>');

    return lines.join('\n');
  }

  const required = fieldRows.filter((field) => field.required).map((field) => `\`${field.name}\``).join(', ');
  const optional = fieldRows.filter((field) => !field.required).map((field) => `\`${field.name}\``).join(', ') || 'Nenhum campo opcional mapeado neste exemplo.';

  lines.push(`<Accordion title="${escapeAttribute(service.name)}" id="${escapeAttribute(service.service)}">`);
  lines.push('');
  lines.push(`**Service:** \`${service.service}\``);
  lines.push('');
  lines.push(`**Quando usar:** ${serviceUseCase(service)}`);
  lines.push('');
  lines.push(`**O que retorna:** ${service.responseSummary}`);
  lines.push('');
  pushServiceSummaryCards(lines, service, required || 'nenhum campo adicional além de `service`', optional);
  lines.push('**Endpoint:** `POST /api/service-api`');
  lines.push('');
  lines.push(`**Campos obrigatórios:** ${required}`);
  lines.push('');
  lines.push(`**Campos opcionais:** ${optional}`);
  lines.push('');
  if (isOcrService(service)) {
    pushOcrApiReferenceBlock(lines, service);
  }
  lines.push('### Passo a passo');
  lines.push('');
  lines.push('1. Gere o token em `POST /api/token-generate` e envie no header `Authorization: Bearer {jwt_token}`.');
  lines.push('2. Monte o body com o `service` exato e os campos obrigatórios listados abaixo.');
  lines.push('3. Execute `POST /api/service-api` no ambiente escolhido.');
  lines.push('4. Confira `status.code` e `status.message` para validar o processamento técnico.');
  lines.push('5. Mapeie os campos de `result` conforme o resumo e o exemplo de response deste service.');
  lines.push('');
  pushServiceExecutionTabs(lines, body, hmlCurl, prodCurl);
  lines.push('### Campos do body');
  lines.push('');
  lines.push('| Campo | Obrigatório | Descrição |');
  lines.push('| --- | --- | --- |');
  for (const field of fieldRows) {
    lines.push(`| \`${field.name}\` | ${field.required ? 'Sim' : 'Não'} | ${field.description} |`);
  }
  lines.push('');
  pushResultFieldsTable(lines, service);
  pushPublicResponseCards(lines);
  lines.push('### Response resumido');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(serviceResponseExample(service), null, 2));
  lines.push('```');
  lines.push('');
  lines.push(`Neste service, o objeto \`result\` representa: ${service.responseSummary}`);
  lines.push('');
  lines.push('</Accordion>');

  return lines.join('\n');
}

function renderServiceQuickstartPage(lang = 'pt') {
  const lines = [];

  if (lang === 'en') {
    lines.push('---');
    lines.push('title: How to run a service');
    lines.push('description: Step by step to authenticate, choose the environment, build the body and call a service in the idCerberus API.');
    lines.push('boost: 4');
    lines.push('---');
    lines.push('');
    lines.push('# How to run a service');
    lines.push('');
    lines.push('This page explains the standard flow to run any product documented in the API Reference.');
    lines.push('');
    lines.push('<Info>');
    lines.push('Most queries use the `POST /api/service-api` endpoint. The `service` field defines which product will be executed.');
    lines.push('</Info>');
    lines.push('');
    pushServiceAliasNote(lines, {}, lang);
    lines.push('## Step by step');
    lines.push('');
    lines.push('<Steps>');
    lines.push('<Step title="Choose the environment">');
    lines.push('');
    lines.push('| Environment | Base URL | When to use |');
    lines.push('| --- | --- | --- |');
    lines.push('| Homologation | `https://backoffice-hml.idcerberus.com` | Tests, validations and development. |');
    lines.push('| Production | `https://backoffice.idcerberus.com` | Real use, after the client has been released. |');
    lines.push('');
    lines.push('</Step>');
    lines.push('<Step title="Generate the token">');
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
    lines.push('Use the value returned in `access_token` in the `Authorization` header of the next calls.');
    lines.push('');
    lines.push('</Step>');
    lines.push('<Step title="Choose the service">');
    lines.push('');
    lines.push('Use the individual (PF) and business (PJ) catalogs to copy the exact value of the `service` field.');
    lines.push('');
    lines.push('1. [Individual (PF) services](/en/api-reference/services-pessoa-fisica)');
    lines.push('2. [Business (PJ) services](/en/api-reference/services-pessoa-juridica)');
    lines.push('3. [Services by use case](/en/api-reference/services-por-caso-de-uso)');
    lines.push('');
    lines.push('</Step>');
    lines.push('<Step title="Build the body">');
    lines.push('');
    lines.push('The body always needs `service`. The other fields depend on the chosen product.');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify({ service: 'SERVICE_RFB_PF', cpf: 'cpf' }, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('</Step>');
    lines.push('<Step title="Run the query">');
    lines.push('');
    lines.push('```bash');
    lines.push(renderCurl({
      baseUrl: 'https://backoffice-hml.idcerberus.com',
      path: '/api/service-api',
      body: { service: 'SERVICE_RFB_PF', cpf: 'cpf' },
    }));
    lines.push('```');
    lines.push('');
    lines.push('</Step>');
    lines.push('<Step title="Interpret the response">');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify({
      result: {},
      status: { code: 200, message: 'Success' },
      externalId: '{externalId}',
    }, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('1. `result`: data returned by the product.');
    lines.push('2. `status.code`: processing code.');
    lines.push('3. `status.message`: short processing message.');
    lines.push('4. `externalId`: external identifier for the query, when returned.');
    lines.push('');
    lines.push('</Step>');
    lines.push('</Steps>');
    lines.push('');
    lines.push('## Common errors');
    lines.push('');
    lines.push('| Situation | How to fix |');
    lines.push('| --- | --- |');
    lines.push('| Missing, expired or invalid token | Generate a new token and send `Authorization: Bearer {jwt_token}`. |');
    lines.push('| `service` field written incorrectly | Copy the service from the API Reference catalog. |');
    lines.push('| Product uses a short alias | Confirm with the product which alias is enabled and send that value in the `service` field. |');
    lines.push('| Missing CPF, CNPJ, image or required parameter | Check the fields section for the chosen service. |');
    lines.push('| Document, OCR or biometrics service returned a parameter error | Send a real image/base64, URL or `key`. Short payloads only test authentication and product access. |');
    lines.push('| Product not released to the client | Confirm commercial/technical release before running in production. |');
    lines.push('| Response without data in `result` | Confirm whether the queried document has information available for that product. |');

    return lines.join('\n');
  }

  lines.push('---');
  lines.push('title: Como executar um service');
  lines.push('description: Passo a passo para autenticar, escolher ambiente, montar o body e chamar um service da API idCerberus.');
  lines.push('boost: 4');
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
  pushServiceAliasNote(lines);
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
  lines.push('1. [Services de pessoa física](/api-reference/services-pessoa-fisica)');
  lines.push('2. [Services de pessoa jurídica](/api-reference/services-pessoa-juridica)');
  lines.push('3. [Services por caso de uso](/api-reference/services-por-caso-de-uso)');
  lines.push('');
  lines.push('</Step>');
  lines.push('<Step title="Monte o body">');
  lines.push('');
  lines.push('O body sempre precisa ter `service`. Os outros campos dependem do produto escolhido.');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({ service: 'SERVICE_RFB_PF', cpf: 'cpf' }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</Step>');
  lines.push('<Step title="Execute a consulta">');
  lines.push('');
  lines.push('```bash');
  lines.push(renderCurl({
    baseUrl: 'https://backoffice-hml.idcerberus.com',
    path: '/api/service-api',
    body: { service: 'SERVICE_RFB_PF', cpf: 'cpf' },
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
  lines.push('1. `result`: dados retornados pelo produto.');
  lines.push('2. `status.code`: código do processamento.');
  lines.push('3. `status.message`: mensagem resumida do processamento.');
  lines.push('4. `externalId`: identificador externo da consulta, quando retornado.');
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
  lines.push('| Produto usa alias curto | Confirme no produto qual alias está liberado e envie esse valor no campo `service`. |');
  lines.push('| CPF, CNPJ, imagem ou parâmetro obrigatório ausente | Confira a seção de campos do service escolhido. |');
  lines.push('| Serviço de documento, OCR ou biometria retornou erro de parâmetro | Envie imagem/base64, URL ou `key` real. Payloads curtos servem apenas para testar autenticação e liberação do produto. |');
  lines.push('| Produto não liberado para o cliente | Confirme a liberação comercial/técnica antes de executar em produção. |');
  lines.push('| Retorno sem dados no `result` | Confirme se o documento consultado possui informação disponível para aquele produto. |');

  return lines.join('\n');
}

function renderUseCasePage(catalog, lang = 'pt') {
  const groups = new Map();
  for (const service of catalog) {
    const family = serviceFamily(service, lang);
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(service);
  }

  const lines = [];

  if (lang === 'en') {
    lines.push('---');
    lines.push('title: Services by use case');
    lines.push('description: Quick map to find the right service based on the goal of the integration.');
    lines.push('---');
    lines.push('');
    lines.push('# Services by use case');
    lines.push('');
    lines.push('Use this page when you know the goal of the integration but do not yet know which `service` to call.');
    lines.push('');
    lines.push('<Info>');
    lines.push('After choosing the service, open the individual or business catalog to copy the full request.');
    lines.push('</Info>');
    lines.push('');
    lines.push('<CardGroup cols={3}>');
    lines.push(' <Card icon="id-card" title="Individuals" href="/en/api-reference/services-pessoa-fisica">');
    lines.push(' CPF, registration data, OCR, biometrics, risk, compliance and contacts.');
    lines.push(' </Card>');
    lines.push(' <Card icon="building" title="Businesses" href="/en/api-reference/services-pessoa-juridica">');
    lines.push(' CNPJ, Federal Revenue, credit risk, partners, domains, compliance and OCR.');
    lines.push(' </Card>');
    lines.push(' <Card icon="list-check" title="Ready-made recipes" href="/en/guides/receitas-prontas">');
    lines.push(' Ready-made flows with payload, expected return and common error.');
    lines.push(' </Card>');
    lines.push('</CardGroup>');
    lines.push('');
    lines.push('## How to choose');
    lines.push('');
    lines.push('1. Start with the goal of the query.');
    lines.push('2. Copy the indicated `service`.');
    lines.push('3. Open the individual or business catalog to see the payload and return.');
    lines.push('4. If it is OCR, check the image guide before testing.');
    lines.push('5. If you want a ready-made flow, use [Ready-made recipes](/en/guides/receitas-prontas).');
    lines.push('');

    for (const [family, services] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`## ${family}`);
      lines.push('');
      lines.push('| Goal | Service | Document |');
      lines.push('| --- | --- | --- |');
      for (const service of services.sort((a, b) => a.name.localeCompare(b.name))) {
        const doc = service.category === 'Pessoa Jurídica' ? 'CNPJ' : service.category === 'Pessoa Física' ? 'CPF' : '-';
        lines.push(`| ${escapeTable(service.name)} | \`${service.service}\` | ${doc} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

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
  lines.push('<CardGroup cols={3}>');
  lines.push(' <Card icon="id-card" title="Pessoa física" href="/api-reference/services-pessoa-fisica">');
  lines.push(' CPF, dados cadastrais, OCR, biometria, risco, compliance e contatos.');
  lines.push(' </Card>');
  lines.push(' <Card icon="building" title="Pessoa jurídica" href="/api-reference/services-pessoa-juridica">');
  lines.push(' CNPJ, Receita Federal, risco de crédito, sócios, domínios, compliance e OCR.');
  lines.push(' </Card>');
  lines.push(' <Card icon="list-check" title="Receitas prontas" href="/guides/receitas-prontas">');
  lines.push(' Fluxos prontos com payload, retorno esperado e erro comum.');
  lines.push(' </Card>');
  lines.push('</CardGroup>');
  lines.push('');
  lines.push('## Como escolher');
  lines.push('');
  lines.push('1. Comece pelo objetivo da consulta.');
  lines.push('2. Copie o `service` indicado.');
  lines.push('3. Abra o catálogo de pessoa física ou jurídica para ver payload e retorno.');
  lines.push('4. Se for OCR, confira o guia de imagem antes de testar.');
  lines.push('5. Se quiser um fluxo pronto, use [Receitas prontas](/guides/receitas-prontas).');
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

function renderApiReferenceServicesPage(catalog, category, title, description, lang = 'pt') {
  const items = catalog.filter((service) => service.category === category);
  const grouped = new Map();
  for (const service of items) {
    const family = serviceFamily(service, lang);
    if (!grouped.has(family)) grouped.set(family, []);
    grouped.get(family).push(service);
  }

  const orderedFamilies = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const orderedServices = orderedFamilies.flatMap(([family, services]) =>
    services
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((service) => ({ ...service, familyLabel: family })),
  );
  const lines = [];

  if (lang === 'en') {
    lines.push('---');
    lines.push(`title: ${title}`);
    lines.push(`description: ${description}`);
    lines.push('---');
    lines.push('');
    lines.push('<Info>');
    lines.push(`${description} All services use \`POST /api/service-api\`; the product executed is defined by the \`service\` field in the body.`);
    lines.push('</Info>');
    lines.push('');
    lines.push('<Warning>');
    lines.push('Use exactly the value shown in `Service`. Do not send an internal alias or integration name.');
    lines.push('</Warning>');
    lines.push('');
    lines.push('## Before testing');
    lines.push('');
    lines.push('<CardGroup cols={2}>');
    lines.push(' <Card icon="file-contract" title="Base contract" href="/en/api-reference/como-executar-service">');
    lines.push(' See the token, headers, standard body, `result`, `status` and `externalId`.');
    lines.push(' </Card>');
    lines.push(' <Card icon="paper-plane" title="Postman from scratch" href="/en/guides/postman-do-zero">');
    lines.push(' Set up HML, generate a token and run `POST /api/service-api` with a real payload.');
    lines.push(' </Card>');
    if (category === 'Pessoa Jurídica') {
      lines.push(' <Card icon="id-card" title="OCR of the CNPJ card" href="/en/guides/service-api/sobre-ocr-service-api#ocr-de-cartao-cnpj">');
      lines.push(' Payload, expected image, clean return and error diagnostics for the CNPJ card.');
      lines.push(' </Card>');
      lines.push(' <Card icon="list-check" title="Ready-made flows" href="/en/guides/receitas-prontas">');
      lines.push(' Full examples for CNPJ, risk, registration and OCR.');
      lines.push(' </Card>');
    } else {
      lines.push(' <Card icon="image" title="OCR and images" href="/en/guides/service-api/sobre-ocr-service-api">');
      lines.push(' Payloads for CNH, RG, proof of address, CNPJ card, base64 and image errors.');
      lines.push(' </Card>');
      lines.push(' <Card icon="list-check" title="Ready-made flows" href="/en/guides/receitas-prontas">');
      lines.push(' Full examples for CPF, OCR, Face Index, risk and score.');
      lines.push(' </Card>');
    }
    lines.push('</CardGroup>');
    lines.push('');
    lines.push('## How to use this page');
    lines.push('');
    lines.push('<Steps>');
    lines.push(' <Step title="Choose the family">');
    lines.push(' Use the cards below to find the right group of services.');
    lines.push(' </Step>');
    lines.push(' <Step title="Open the service">');
    lines.push(' In the full catalog, open the service accordion and copy the example body.');
    lines.push(' </Step>');
    lines.push(' <Step title="Read the response">');
    lines.push(' Use `result` as the public contract and preserve `status`, `onboardingStatus` and `externalId`.');
    lines.push(' </Step>');
    lines.push('</Steps>');
    lines.push('');
    pushApiReferenceReturnCards(lines, lang);
    lines.push('## Service families');
    lines.push('');
    lines.push('<CardGroup cols={2}>');
    for (const [family, services] of orderedFamilies) {
      const sorted = services.slice().sort((a, b) => a.name.localeCompare(b.name));
      const examples = sorted.slice(0, 3).map((service) => `\`${service.service}\``).join(', ');
      const suffix = sorted.length > 3 ? ` and ${sorted.length - 3} more` : '';
      lines.push(` <Card icon="layer-group" title="${escapeAttribute(family)}">`);
      lines.push(` ${sorted.length} service${sorted.length === 1 ? '' : 's'}: ${examples}${suffix}.`);
      lines.push(' </Card>');
    }
    lines.push('</CardGroup>');
    lines.push('');
    lines.push('## Full catalog');
    lines.push('');
    lines.push('Open a service to see when to use it, required fields, body, curl and a summarized response.');
    lines.push('');
    lines.push('<AccordionGroup>');
    for (const service of orderedServices) {
      lines.push(renderServiceRequestBlock(service, lang));
      lines.push('');
    }
    lines.push('</AccordionGroup>');
    lines.push('');
    pushApiReferenceChecklist(lines, lang);
    lines.push('## Error patterns');
    lines.push('');
    lines.push('The examples below show common formats. The message may vary depending on validation, product and environment.');
    lines.push('');
    lines.push('<AccordionGroup>');
    for (const example of serviceErrorExamples(lang)) {
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

  lines.push('---');
  lines.push(`title: ${title}`);
  lines.push(`description: ${description}`);
  lines.push('---');
  lines.push('');
  lines.push('<Info>');
  lines.push(`${description} Todos os services usam \`POST /api/service-api\`; o produto executado é definido pelo campo \`service\` no body.`);
  lines.push('</Info>');
  lines.push('');
  lines.push('<Warning>');
  lines.push('Use exatamente o valor exibido em `Service`. Não envie alias interno nem nome de integração.');
  lines.push('</Warning>');
  lines.push('');
  lines.push('## Antes de testar');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card icon="file-contract" title="Contrato base" href="/api-reference/como-executar-service">');
  lines.push(' Veja token, headers, body padrão, `result`, `status` e `externalId`.');
  lines.push(' </Card>');
  lines.push(' <Card icon="paper-plane" title="Postman do zero" href="/guides/postman-do-zero">');
  lines.push(' Configure HML, gere token e execute `POST /api/service-api` com um payload real.');
  lines.push(' </Card>');
  if (category === 'Pessoa Jurídica') {
    lines.push(' <Card icon="id-card" title="OCR de cartão CNPJ" href="/guides/service-api/sobre-ocr-service-api#ocr-de-cartao-cnpj">');
    lines.push(' Payload, imagem esperada, retorno limpo e diagnóstico de erro para cartão CNPJ.');
    lines.push(' </Card>');
    lines.push(' <Card icon="list-check" title="Fluxos prontos" href="/guides/receitas-prontas">');
    lines.push(' Exemplos completos para CNPJ, risco, cadastro e OCR.');
    lines.push(' </Card>');
  } else {
    lines.push(' <Card icon="image" title="OCR e imagem" href="/guides/service-api/sobre-ocr-service-api">');
    lines.push(' Payloads para CNH, RG, comprovante, cartão CNPJ, base64 e erros de imagem.');
    lines.push(' </Card>');
    lines.push(' <Card icon="list-check" title="Fluxos prontos" href="/guides/receitas-prontas">');
    lines.push(' Exemplos completos para CPF, OCR, Face Index, risco e score.');
    lines.push(' </Card>');
  }
  lines.push('</CardGroup>');
  lines.push('');
  lines.push('## Como usar esta página');
  lines.push('');
  lines.push('<Steps>');
  lines.push(' <Step title="Escolha a família">');
  lines.push(' Use os cards abaixo para localizar o grupo certo de services.');
  lines.push(' </Step>');
  lines.push(' <Step title="Abra o service">');
  lines.push(' No catálogo completo, abra o accordion do service e copie o body de exemplo.');
  lines.push(' </Step>');
  lines.push(' <Step title="Leia o retorno">');
  lines.push(' Use `result` como contrato público e preserve `status`, `onboardingStatus` e `externalId`.');
  lines.push(' </Step>');
  lines.push('</Steps>');
  lines.push('');
  pushApiReferenceReturnCards(lines);
  lines.push('## Famílias de services');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  for (const [family, services] of orderedFamilies) {
    const sorted = services.slice().sort((a, b) => a.name.localeCompare(b.name));
    const examples = sorted.slice(0, 3).map((service) => `\`${service.service}\``).join(', ');
    const suffix = sorted.length > 3 ? ` e mais ${sorted.length - 3}` : '';
    lines.push(` <Card icon="layer-group" title="${escapeAttribute(family)}">`);
    lines.push(` ${sorted.length} service${sorted.length === 1 ? '' : 's'}: ${examples}${suffix}.`);
    lines.push(' </Card>');
  }
  lines.push('</CardGroup>');
  lines.push('');
  lines.push('## Catálogo completo');
  lines.push('');
  lines.push('Abra um service para ver quando usar, campos obrigatórios, body, curl e response resumido.');
  lines.push('');
  lines.push('<AccordionGroup>');
  for (const service of orderedServices) {
    lines.push(renderServiceRequestBlock(service));
    lines.push('');
  }
  lines.push('</AccordionGroup>');
  lines.push('');
  pushApiReferenceChecklist(lines);
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
let mdxPages = pages.filter((page) => !page.openapi).map((page) => ({
  ...page,
  ...getPageMeta(page.slug),
}));
const openApiContent = read(openApiPath);
const openApiSummary = extractOpenApiSummary(openApiContent);
const baseServicesCatalog = filterActiveServiceApiServices(mergeAdditionalPublicApiServices(buildServicesCatalog(openApiSummary.services)));
const exampleFiles = writeExampleFiles(baseServicesCatalog);
const servicesCatalog = baseServicesCatalog.map((service) => enrichServiceForMcp(service, exampleFiles));
function pushLlmFileMap(lines) {
  lines.push('## Como escolher o arquivo certo');
  lines.push('');
  lines.push('| Necessidade | Use |');
  lines.push('| --- | --- |');
  lines.push(`| Entender a estrutura da documentação | ${siteUrl}/llms.txt |`);
  lines.push(`| Gerar integração, curl ou escolher service | ${siteUrl}/llms-small.txt |`);
  lines.push(`| Consultar payloads e responses por service | ${siteUrl}/llms-api-reference.txt |`);
  lines.push(`| Buscar service em um índice leve | ${siteUrl}/services-catalog.min.json |`);
  lines.push(`| Fazer busca estruturada por automação | ${siteUrl}/services-catalog.json |`);
  lines.push(`| Configurar MCP ou agente com recursos estruturados | ${siteUrl}/mcp-manifest.json |`);
  lines.push(`| Responder com todo o contexto da documentação | ${siteUrl}/llms-full.txt |`);
  lines.push('');
}

function pushMcpUsageNotes(lines) {
  lines.push('## Uso como base para MCP e agentes');
  lines.push('');
  lines.push('Estes arquivos podem ser usados como fonte de contexto para um MCP da documentação. O MCP deve consultar a documentação, não executar chamadas na API idCerberus.');
  lines.push('');
  lines.push('### Ordem recomendada de leitura');
  lines.push('');
  lines.push('1. Leia `llms.txt` como manifesto inicial da documentação.');
  lines.push('2. Use `services-catalog.min.json` para busca rápida por service, nome, categoria, campo e tag.');
  lines.push('3. Use `services-catalog.json` quando precisar do contrato completo do service.');
  lines.push('4. Use `mcp-manifest.json` para listar recursos, ferramentas sugeridas, regras de segurança e ordem de leitura.');
  lines.push('5. Use `llms-api-reference.txt` para payloads, responses resumidos e exemplos por service.');
  lines.push('6. Use `examples/*.curl` quando a resposta precisar de um curl pronto.');
  lines.push('7. Use `llms-full.txt` apenas quando a pergunta exigir contexto completo dos guias, API Reference e OpenAPI.');
  lines.push('');
  lines.push('### Recursos que um MCP pode expor');
  lines.push('');
  lines.push('| Recurso | Uso no MCP |');
  lines.push('| --- | --- |');
  lines.push(`| ${siteUrl}/llms.txt | Manifesto, regras, URLs principais e atalhos. |`);
  lines.push(`| ${siteUrl}/llms-small.txt | Contexto curto para gerar integração, curl e explicação. |`);
  lines.push(`| ${siteUrl}/llms-api-reference.txt | Payloads, responses e exemplos por service. |`);
  lines.push(`| ${siteUrl}/llms-full.txt | Contexto completo para perguntas amplas. |`);
  lines.push(`| ${siteUrl}/services-catalog.min.json | Índice leve para busca rápida por service, categoria, tag e campos. |`);
  lines.push(`| ${siteUrl}/services-catalog.json | Busca estruturada e filtros por service/categoria/campo. |`);
  lines.push(`| ${siteUrl}/mcp-manifest.json | Manifesto com recursos, ferramentas sugeridas, regras e ordem de leitura. |`);
  lines.push(`| ${siteUrl}/examples/*.curl | Exemplos prontos para copiar e testar. |`);
  lines.push('');
  lines.push('### Regras para o MCP');
  lines.push('');
  lines.push('1. Operar como fonte somente leitura da documentação.');
  lines.push('2. Não chamar HML, produção, banco ou endpoints idCerberus.');
  lines.push('3. Não solicitar nem armazenar `client`, `secret`, JWT, CPF, CNPJ ou imagem real.');
  lines.push('4. Usar homologação como ambiente padrão quando gerar exemplos.');
  lines.push('5. Se o service não existir no catálogo, responder que precisa ser confirmado antes de integrar.');
  lines.push('6. Preferir `result` como contrato público; não usar `fieldsOutput` ou metadados internos.');
  lines.push('');
}

function pushServiceApiContract(lines) {
  lines.push('## Contrato base do POST /api/service-api');
  lines.push('');
  lines.push('1. Endpoint de homologação: `POST https://backoffice-hml.idcerberus.com/api/service-api`.');
  lines.push('2. Endpoint de produção: `POST https://backoffice.idcerberus.com/api/service-api`.');
  lines.push('3. Header obrigatório: `Authorization: Bearer {jwt_token}`.');
  lines.push('4. Header recomendado: `Content-Type: application/json`.');
  lines.push('5. Campo obrigatório no body: `service`.');
  lines.push('6. O alias enviado em `service` deve ser o alias configurado no produto do cliente.');
  lines.push('7. Leia dados públicos em `result`; não trate `fieldsOutput` ou metadados internos como contrato público.');
  lines.push('8. Preserve `status`, `onboardingStatus` e `externalId` ao explicar respostas.');
  lines.push('');
}

function pushOcrLlmNotes(lines) {
  lines.push('## Notas rápidas para OCR e imagem');
  lines.push('');
  lines.push('1. OCR usa imagem do documento, não selfie.');
  lines.push('2. Face, FaceMatch e Face Index usam selfie/rosto, não foto de RG ou CNH.');
  lines.push('3. `image1` recebe o base64 da imagem, com ou sem prefixo `data:image/...;base64,`: os dois formatos funcionam.');
  lines.push('4. RG normalmente usa frente e verso: `image1` e `image2`.');
  lines.push('5. CNH usa `SERVICE_OCR`, `documentType: CNH` e `image1`.');
  lines.push('6. Cartão CNPJ usa `SERVICE_OCR_CNPJ_CARD` e `image1`.');
  lines.push('7. Comprovante de endereço usa `SERVICE_OCR_PROOF_OF_ADDRESS` e `image1`.');
  lines.push('8. Emancipação usa `SERVICE_OCR_EMANCIPATION`; o documento varia e o sucesso depende de OCR com texto útil.');
  lines.push('9. Se a imagem estiver ausente, ilegível ou for do tipo errado, espere `REFUSED` com mensagem clara, não invente sucesso.');
  lines.push('');
}

function pushServiceAliasLlmNotes(lines) {
  lines.push('## Aliases importantes de chamada');
  lines.push('');
  lines.push('Use o service p\u00fablico liberado no produto no campo `service`.');
  lines.push('');
  lines.push('| Service |');
  lines.push('| --- |');
  for (const alias of [...new Set(serviceAliasRows.map(([, callingAlias]) => callingAlias))].sort()) {
    lines.push(`| \`${alias}\` |`);
  }
  lines.push('');
}

function pushFeaturedServiceShortcuts(lines, catalog) {
  lines.push('## Atalhos de services mais usados');
  lines.push('');
  lines.push('| Caso | Service | Campos principais | Guia/API |');
  lines.push('| --- | --- | --- | --- |');
  const aliases = [
    ['CPF na Receita Federal', 'SERVICE_RFB_PF'],
    ['CNPJ na Receita Federal', 'SERVICE_RFB_PJ'],
    ['OCR React', 'SERVICE_OCR'],
    ['OCR cartão CNPJ', 'SERVICE_OCR_CNPJ_CARD'],
    ['OCR comprovante de endereço', 'SERVICE_OCR_PROOF_OF_ADDRESS'],
    ['Face Index', 'SERVICE_FACE_INDEX'],
    ['Risco de crédito PJ', 'SERVICE_CREDIT_RISK_COMPANY'],
    ['Score de crédito PF', 'SERVICE_CREDIT_SCORE'],
    ['Processos jurídicos PJ', 'SERVICE_JURIDICAL_PROCESSES_PJ'],
    ['Benefícios sociais familiares', 'SERVICE_FAMILY_SOCIAL_BENEFITS'],
  ];
  for (const [label, alias] of aliases) {
    const service = catalog.find((item) => item.service === alias);
    if (!service) continue;
    const fields = service.requestFields.length ? service.requestFields.map((field) => `\`${field}\``).join(', ') : '-';
    lines.push(`| ${label} | \`${service.service}\` | ${fields} | ${service.documentationUrl} |`);
  }
  lines.push('');
}

function pushLlmCommonErrors(lines) {
  lines.push('## Diagnóstico rápido de erro');
  lines.push('');
  lines.push('| Sintoma | Interpretação provável | Ação recomendada |');
  lines.push('| --- | --- | --- |');
  lines.push('| `401 Unauthorized` | Token ausente, expirado ou inválido. | Gerar novo token em `/api/token-generate`. |');
  lines.push('| `Don\'t have access to the service` | Produto sem service ativo/API habilitada ou alias errado. | Conferir configuração do produto e alias de chamada. |');
  lines.push('| Imagem ausente | Payload não enviou `image1`, `image2`, URL ou `key` esperado. | Conferir o OCR chamado e montar o JSON novamente. |');
  lines.push('| `result: {}` | Consulta processou, mas não retornou dado útil. | Validar imagem, massa, configuração do produto e tipo correto do service. |');
  lines.push('| `onboardingStatus: ERROR` | Falha técnica no processamento, no storage ou em fonte externa. | Usar `externalId`, horário e ambiente para investigar. |');
  lines.push('| Campo esperado ausente | O campo pode não existir no documento/base ou não ter sido extraído. | Não inventar valor; explicar que o retorno traz apenas dados disponíveis. |');
  lines.push('');
}

function buildMcpManifest(servicesCatalog, exampleFiles) {
  const serviceCountByCategory = servicesCatalog.reduce((acc, service) => {
    acc[service.category] = (acc[service.category] || 0) + 1;
    return acc;
  }, {});

  const tags = [...new Set(servicesCatalog.flatMap((service) => service.tags || []))].sort();
  const familyMatches = {
    ocr: ['ocr', 'imagem', 'rg', 'cnh', 'cartao-cnpj', 'comprovante-endereco'],
    faceBiometrics: ['face'],
    cpf: ['cpf'],
    cnpj: ['cnpj'],
    creditRisk: ['risco-credito'],
    legal: ['juridico'],
    compliance: ['compliance'],
    contact: ['contato'],
    socialBenefits: ['beneficios-sociais'],
    registration: ['cadastral'],
  };
  const serviceFamilies = Object.fromEntries(Object.entries(familyMatches).map(([family, familyTags]) => [
    family,
    servicesCatalog
      .filter((service) => service.tags?.some((tag) => familyTags.includes(tag)))
      .map((service) => ({
        service: service.service,
        callingAlias: service.callingAlias,
        name: service.name,
        tags: service.tags,
        documentationUrl: service.documentationUrl,
      })),
  ]));

  return {
    name: 'idcerberus-docs',
    title: 'idCerberus API Docs',
    description: 'Manifesto somente leitura para MCPs e agentes consultarem a documentação pública da API idCerberus.',
    version: '1.0.0',
    generatedBy,
    artifactVersion,
    baseUrl: siteUrl,
    generatedFrom: [
      'docs.json',
      'api-reference/openapi.json',
      'guides/*.mdx',
      'api-reference/*.mdx',
      'services-catalog.json',
      'services-catalog.min.json',
    ],
    recommendedReadOrder: [
      `${siteUrl}/llms.txt`,
      `${siteUrl}/services-catalog.min.json`,
      `${siteUrl}/services-catalog.json`,
      `${siteUrl}/mcp-manifest.json`,
      `${siteUrl}/llms-api-reference.txt`,
      `${siteUrl}/examples/*.curl`,
      `${siteUrl}/llms-full.txt`,
    ],
    resources: [
      {
        name: 'llms.txt',
        url: `${siteUrl}/llms.txt`,
        contentType: 'text/plain',
        use: 'Manifesto inicial, regras principais, atalhos e URLs importantes.',
      },
      {
        name: 'llms-small.txt',
        url: `${siteUrl}/llms-small.txt`,
        contentType: 'text/plain',
        use: 'Contexto curto para gerar payload, curl e explicação de integração.',
      },
      {
        name: 'llms-api-reference.txt',
        url: `${siteUrl}/llms-api-reference.txt`,
        contentType: 'text/plain',
        use: 'Resumo operacional dos services, payloads e responses esperados.',
      },
      {
        name: 'llms-full.txt',
        url: `${siteUrl}/llms-full.txt`,
        contentType: 'text/plain',
        use: 'Contexto completo para perguntas amplas ou comparação entre guias.',
      },
      {
        name: 'services-catalog.json',
        url: `${siteUrl}/services-catalog.json`,
        contentType: 'application/json',
        use: 'Catálogo estruturado para buscar services por alias, campo, categoria, tag ou erro comum.',
      },
      {
        name: 'services-catalog.min.json',
        url: `${siteUrl}/services-catalog.min.json`,
        contentType: 'application/json',
        use: 'Catálogo leve para busca rápida antes de abrir o contrato completo do service.',
      },
      {
        name: 'mcp-manifest.json',
        url: `${siteUrl}/mcp-manifest.json`,
        contentType: 'application/json',
        use: 'Mapa de recursos, ordem de leitura, ferramentas sugeridas e regras para MCPs/agentes.',
      },
      {
        name: 'examples',
        url: `${siteUrl}/examples/`,
        contentType: 'text/plain',
        use: 'Arquivos curl prontos para testes em homologação.',
      },
    ],
    suggestedTools: [
      {
        name: 'search_services',
        source: 'services-catalog.json',
        purpose: 'Encontrar services por texto, tag, categoria, campo de entrada ou alias.',
        inputs: ['query', 'category', 'tag', 'field'],
        returns: ['service', 'callingAlias', 'name', 'requestFields', 'documentationUrl'],
      },
      {
        name: 'get_service',
        source: 'services-catalog.json',
        purpose: 'Buscar o contrato de um service específico.',
        inputs: ['service'],
        returns: ['payloadExample', 'successResponseExample', 'commonErrors', 'curlExampleUrls'],
      },
      {
        name: 'get_curl_example',
        source: 'examples/*.curl',
        purpose: 'Retornar exemplo de curl pronto para homologação.',
        inputs: ['service', 'useCase'],
        returns: ['curl'],
      },
      {
        name: 'read_full_context',
        source: 'llms-full.txt',
        purpose: 'Consultar contexto completo quando o catálogo não for suficiente.',
        inputs: ['topic'],
        returns: ['relevant_sections'],
      },
    ],
    safetyRules: [
      'Operar como fonte somente leitura da documentação.',
      'Não chamar HML, produção, banco de dados ou endpoints reais da idCerberus.',
      'Não solicitar, armazenar ou repetir client, secret, JWT, CPF, CNPJ ou imagens reais.',
      'Usar placeholders em exemplos e preferir homologação como ambiente padrão.',
      'Não inventar service, campo, endpoint ou retorno ausente da documentação.',
      'Usar `result` como contrato público da API e ignorar `fieldsOutput`/metadados internos.',
    ],
    doNotAnswerAs: [
      'Não afirmar que Face Index valida identidade definitiva; ele busca correspondência na base de faces.',
      'Não tratar `fieldsOutput` como contrato público da API.',
      'Não dizer que OCR garante extração de todos os campos; o retorno depende da imagem e do documento.',
      'Não inventar retorno de campo quando o campo não aparece na documentação.',
      'Não pedir CPF, CNPJ, token, client, secret ou imagem real para montar exemplo.',
      'Não sugerir chamada real em HML/produção; este MCP é fonte de documentação.',
    ],
    troubleshootingByStatus: {
      '401': {
        meaning: 'Token ausente, expirado ou inválido.',
        action: 'Gerar novo token em `/api/token-generate` e reenviar com `Authorization: Bearer {jwt_token}`.',
      },
      '400': {
        meaning: 'Payload inválido, service sem acesso, imagem ausente ou campo obrigatório não enviado.',
        action: 'Conferir `service`, campos obrigatórios, produto configurado e exemplo de payload no catálogo.',
      },
      REFUSED: {
        meaning: 'A chamada foi processada, mas a regra do serviço recusou o resultado.',
        action: 'Ler `status.message`, conferir imagem/massa e não tratar como falha técnica automaticamente.',
      },
      ERROR: {
        meaning: 'Falha técnica no processamento, no storage ou em fonte externa.',
        action: 'Investigar com `externalId`, horário, ambiente e service chamado.',
      },
      'result:{}': {
        meaning: 'A chamada respondeu, mas não trouxe dado público útil.',
        action: 'Conferir se o service tem retorno esperado para a massa usada e se a imagem/documento está correto.',
      },
      "Don't have access to the service": {
        meaning: 'Produto sem service ativo/API habilitada ou alias de chamada incorreto.',
        action: 'Conferir configuração do produto, alias de chamada e flag de API.',
      },
    },
    catalogSummary: {
      totalServices: servicesCatalog.length,
      categories: serviceCountByCategory,
      tags,
      serviceFamilies,
      examples: exampleFiles.map((example) => ({
        title: example.title,
        url: example.url,
      })),
    },
    exampleQuestionsByUseCase: {
      ocr: [
        'Qual service devo usar para OCR de CNH?',
        'Como montar payload para OCR de RG frente e verso?',
        'Qual retorno público esperado do OCR de cartão CNPJ?',
        'O que conferir quando o OCR retorna result vazio?',
      ],
      cpfCnpj: [
        'Qual service usar para consultar CPF na Receita Federal?',
        'Qual payload mínimo para consultar CNPJ na Receita Federal?',
        'Como diferenciar alias de chamada e alias documentado?',
      ],
      faceBiometrics: [
        'Como testar SERVICE_FACE_INDEX em HML?',
        'Face Index confirma identidade ou só busca face na base?',
        'Qual imagem devo usar para Face Index?',
      ],
      errors: [
        "O que significa Don't have access to the service?",
        'O que fazer quando a resposta vem com onboardingStatus ERROR?',
        'Como investigar uma chamada usando externalId?',
      ],
      payloadAndCurl: [
        'Gere um curl de homologação para SERVICE_CREDIT_RISK_COMPANY.',
        'Gere um curl de homologação para SERVICE_OCR_PROOF_OF_ADDRESS.',
        'Quais headers são obrigatórios no POST /api/service-api?',
      ],
    },
  };
}

const llmRules = [
  '## Regras para assistentes de IA',
  '',
  '1. Use a documentação como fonte principal e não invente endpoints, parâmetros ou services.',
  '2. Para consultas externas, use `POST /api/service-api` e selecione o produto pelo campo `service`.',
  '3. Use `Authorization: Bearer {jwt_token}` em chamadas protegidas.',
  '4. Use homologação para testes e produção somente quando o usuário pedir explicitamente.',
  '5. Nunca exponha tokens, secrets, CPFs, CNPJs ou imagens reais em exemplos.',
  '6. Para OCR, envie o base64 completo em `image1`/`image2` (com ou sem prefixo `data:image/...;base64,`, os dois formatos funcionam).',
  '7. Não use `fieldsOutput`, campos nulos ou metadados internos como contrato público; use `result`.',
  '8. Se um service não aparecer no catálogo, informe que ele precisa ser confirmado antes de documentar ou integrar.',
  '',
].join('\n');

write(path.join(root, 'services-catalog.json'), `${JSON.stringify({
  generatedBy,
  artifactVersion,
  totalServices: servicesCatalog.length,
  services: servicesCatalog,
}, null, 2)}\n`);
write(path.join(root, 'services-catalog.min.json'), `${JSON.stringify(buildServicesCatalogMin(servicesCatalog), null, 2)}\n`);
write(path.join(root, 'mcp-manifest.json'), `${JSON.stringify(buildMcpManifest(servicesCatalog, exampleFiles), null, 2)}\n`);
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

const openApiContentEn = read(path.join(root, 'en', 'api-reference', 'openapi.json'));
const openApiSummaryEn = extractOpenApiSummary(openApiContentEn);
const baseServicesCatalogEn = filterActiveServiceApiServices(mergeAdditionalPublicApiServices(buildServicesCatalog(openApiSummaryEn.services, 'en'), 'en'));
const servicesCatalogEn = baseServicesCatalogEn.map((service) => enrichServiceForMcp(service, exampleFiles));

write(path.join(root, 'en', 'guides', 'indice-de-services.mdx'), renderServicesIndex(servicesCatalogEn, 'en'));
write(path.join(root, 'en', 'api-reference', 'como-executar-service.mdx'), renderServiceQuickstartPage('en'));
write(path.join(root, 'en', 'api-reference', 'services-por-caso-de-uso.mdx'), renderUseCasePage(servicesCatalogEn, 'en'));
write(path.join(root, 'en', 'api-reference', 'services-pessoa-fisica.mdx'), renderApiReferenceServicesPage(
  servicesCatalogEn,
  'Pessoa Física',
  'Individual (PF) services',
  'Explicit catalog of individual (PF) services available via API, with expected fields and request examples.',
  'en',
));
write(path.join(root, 'en', 'api-reference', 'services-pessoa-juridica.mdx'), renderApiReferenceServicesPage(
  servicesCatalogEn,
  'Pessoa Jurídica',
  'Business (PJ) services',
  'Explicit catalog of business (PJ) services available via API, with expected fields and request examples.',
  'en',
));

mdxPages = pages.filter((page) => !page.openapi).map((page) => ({
  ...page,
  ...getPageMeta(page.slug),
}));

function searchBodyText(body, maxLen) {
  const collapsed = (body || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`<>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return collapsed.length > maxLen ? `${collapsed.slice(0, maxLen)}...` : collapsed;
}

const guidesSearchIndex = mdxPages
  .filter((page) => page.tab === 'Guias')
  .map((page) => ({
    title: page.title,
    description: page.description,
    group: page.group,
    url: slugToUrl(page.slug),
    body: searchBodyText(page.body, 2000),
  }));

write(path.join(root, 'guides-search-index.json'), `${JSON.stringify({ generatedBy, artifactVersion, guides: guidesSearchIndex }, null, 2)}\n`);

const llmsLines = [];
llmsLines.push('# idCerberus API Docs');
llmsLines.push('');
llmsLines.push('> Documentação da API idCerberus para onboarding digital, KYC, biometria, FaceMatch, Liveness, análise de risco, compliance, enriquecimento cadastral e consultas de pessoa física e pessoa jurídica.');
llmsLines.push('');
llmsLines.push('Base URLs:');
llmsLines.push('');
llmsLines.push('1. Homologação: `https://backoffice-hml.idcerberus.com`');
llmsLines.push('2. Produção: `https://backoffice.idcerberus.com`');
llmsLines.push('3. Documentação publicada: `https://api-docs.idcerberus.com/`');
llmsLines.push('');
llmsLines.push(llmRules);
pushLlmFileMap(llmsLines);
pushMcpUsageNotes(llmsLines);
pushServiceApiContract(llmsLines);
pushFeaturedServiceShortcuts(llmsLines, servicesCatalog);
pushOcrLlmNotes(llmsLines);
llmsLines.push('## Conteúdo principal');
llmsLines.push('');

let currentGroup = '';
let groupItemIdx = 0;
for (const page of mdxPages) {
  const groupName = `${page.tab} / ${page.group}`;
  if (groupName !== currentGroup) {
    if (currentGroup !== '') {
      llmsLines.push('');
    }
    currentGroup = groupName;
    groupItemIdx = 0;
    llmsLines.push(`### ${groupName}`);
    llmsLines.push('');
  }
  groupItemIdx++;
  const desc = page.description ? `: ${page.description}` : '';
  llmsLines.push(`${groupItemIdx}. [${page.title}](${slugToUrl(page.slug)})${desc}`);
}

llmsLines.push('');
llmsLines.push('## API Reference');
llmsLines.push('');
llmsLines.push(`1. [OpenAPI reference](${slugToUrl('api-reference/boas-vindas')}): endpoints, exemplos de request/response e schemas.`);
llmsLines.push('2. Endpoint principal de consultas: `POST /api/service-api`.');
llmsLines.push('3. Autenticação: `POST /api/token-generate` retorna `access_token`; use `Authorization: Bearer {jwt_token}` nas chamadas protegidas.');
llmsLines.push('');
llmsLines.push('## Arquivo completo para LLM');
llmsLines.push('');
llmsLines.push(`1. [llms-small.txt](${siteUrl}/llms-small.txt): resumo operacional com fluxos, autenticação, service-api e services documentados.`);
llmsLines.push(`2. [llms-full.txt](${siteUrl}/llms-full.txt): versão consolidada dos guias e da API Reference.`);
llmsLines.push(`3. [llms-api-reference.txt](${siteUrl}/llms-api-reference.txt): referência operacional dos services com exemplos de curl.`);
llmsLines.push(`4. [services-catalog.min.json](${siteUrl}/services-catalog.min.json): índice leve para busca rápida por service, categoria, tag e campos.`);
llmsLines.push(`5. [services-catalog.json](${siteUrl}/services-catalog.json): catálogo estruturado para ferramentas e automações.`);
llmsLines.push(`6. [mcp-manifest.json](${siteUrl}/mcp-manifest.json): manifesto para MCPs e agentes com recursos, regras e ferramentas sugeridas.`);
llmsLines.push('');
llmsLines.push('## Exemplos curl');
llmsLines.push('');
exampleFiles.forEach((example, idx) => llmsLines.push(`${idx + 1}. [${example.file}](${example.url}): ${example.title}. ${example.description}`));

write(path.join(root, 'llms.txt'), llmsLines.join('\n'));

const smallLines = [];
smallLines.push('# idCerberus API Docs - resumo operacional para LLM');
smallLines.push('');
smallLines.push('Use este arquivo quando precisar de contexto rápido para integrar com a API idCerberus.');
smallLines.push('');
smallLines.push(llmRules);
pushLlmFileMap(smallLines);
pushMcpUsageNotes(smallLines);
pushServiceApiContract(smallLines);
pushFeaturedServiceShortcuts(smallLines, servicesCatalog);
pushOcrLlmNotes(smallLines);
pushLlmCommonErrors(smallLines);
smallLines.push('## Ambientes');
smallLines.push('');
smallLines.push('1. Homologação: `https://backoffice-hml.idcerberus.com`');
smallLines.push('2. Produção: `https://backoffice.idcerberus.com`');
smallLines.push('');
smallLines.push('## Autenticação');
smallLines.push('');
smallLines.push('1. Gere token em `POST /api/token-generate` com `client` e `secret`.');
smallLines.push('2. Envie o token nas chamadas protegidas com `Authorization: Bearer {jwt_token}`.');
smallLines.push('3. Quando expirar, gere um novo token.');
smallLines.push('');
smallLines.push('## Endpoint principal');
smallLines.push('');
smallLines.push('1. Use `POST /api/service-api` para consultas de dados, risco, compliance, biometria e enriquecimento.');
smallLines.push('2. O campo `service` define qual produto será executado.');
smallLines.push('3. Os demais campos variam conforme o serviço escolhido.');
smallLines.push('');
smallLines.push('## Fluxos principais');
smallLines.push('');
{
  let flowIdx = 1;
  for (const slug of [
    'guides/quickstart',
    'guides/autenticacao',
    'guides/primeira-consulta-cpf',
    'guides/primeira-consulta-cnpj',
    'guides/onboarding-sdk',
    'guides/matriz-de-servicos',
  ]) {
    const page = mdxPages.find((item) => item.slug === slug);
    if (page) smallLines.push(`${flowIdx++}. [${page.title}](${slugToUrl(page.slug)}): ${page.description || 'Guia da documentação idCerberus.'}`);
  }
}
smallLines.push('');
smallLines.push('## Services documentados no API Reference');
smallLines.push('');
for (const item of servicesCatalog) {
  const terms = displaySearchTerms(item, 4);
  smallLines.push(`**${item.category} - ${item.name}**: \`${item.service}\` | campos: ${item.requestFields.length ? item.requestFields.join(', ') : 'nenhum campo adicional'} | busca: ${terms}`);
}
smallLines.push('');
smallLines.push('## Arquivos auxiliares');
smallLines.push('');
smallLines.push(`1. Catálogo JSON: ${siteUrl}/services-catalog.json`);
smallLines.push(`2. Catálogo leve: ${siteUrl}/services-catalog.min.json`);
smallLines.push(`3. API Reference para LLM: ${siteUrl}/llms-api-reference.txt`);
smallLines.push(`4. Manifesto MCP: ${siteUrl}/mcp-manifest.json`);
smallLines.push('5. Exemplos curl: ' + siteUrl + '/examples/auth.hml.curl');
smallLines.push('6. Lista de exemplos curl: ' + siteUrl + '/llms.txt#exemplos-curl');

write(path.join(root, 'llms-small.txt'), smallLines.join('\n'));

const fullLines = [];
fullLines.push('# idCerberus API Docs - conteúdo completo para LLM');
fullLines.push('');
fullLines.push('Este arquivo consolida os guias e a referência da API idCerberus em texto simples para uso por LLMs, agentes e assistentes de desenvolvimento.');
fullLines.push('');
fullLines.push('Base URLs:');
fullLines.push('');
fullLines.push('1. Homologação: `https://backoffice-hml.idcerberus.com`');
fullLines.push('2. Produção: `https://backoffice.idcerberus.com`');
fullLines.push('');
fullLines.push(llmRules);
pushLlmFileMap(fullLines);
pushMcpUsageNotes(fullLines);
pushServiceApiContract(fullLines);
pushServiceAliasLlmNotes(fullLines);
pushFeaturedServiceShortcuts(fullLines, servicesCatalog);
pushOcrLlmNotes(fullLines);
pushLlmCommonErrors(fullLines);

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
console.log('Generated services-catalog.min.json.');
console.log('Generated mcp-manifest.json.');
console.log(`Generated guides-search-index.json with ${guidesSearchIndex.length} guides.`);
console.log('Generated guides/indice-de-services.mdx.');
console.log('Generated api-reference/como-executar-service.mdx.');
console.log('Generated api-reference/services-por-caso-de-uso.mdx.');
console.log('Generated api-reference/services-pessoa-fisica.mdx.');
console.log('Generated api-reference/services-pessoa-juridica.mdx.');
console.log(`Generated ${exampleFiles.length} curl examples.`);
