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

function pushServiceAliasNote(lines, { includeDocumentPayloadNote = false } = {}) {
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
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
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
        responseSummary: serviceResponseSummary({
          name: item.summary.replace(/^(PF|PJ)\s+-\s+/i, ''),
          service: item.service,
          category: serviceCategory(item.summary, item.service),
        }),
      };
    });
}

const partnerApiServices = [
  ['SERVICE_ACTIVITIES_INDICATORS', 'Indicadores de atividades', 'Pessoa Física', { service: 'SERVICE_ACTIVITIES_INDICATORS', cpf: 'cpf' }],
  ['SERVICE_ACTIVE_DEBT_PF', 'Débitos ativos PF', 'Pessoa Física', { service: 'SERVICE_ACTIVE_DEBT_PF', cpf: 'cpf' }],
  ['SERVICE_ADDRESS', 'Endereços', 'Pessoa Física', { service: 'SERVICE_ADDRESS', cpf: 'cpf' }],
  ['SERVICE_AWARDS_AND_CERTIFICATIONS_CPF', 'Prêmios e certificações PF', 'Pessoa Física', { service: 'SERVICE_AWARDS_AND_CERTIFICATIONS_CPF', cpf: 'cpf' }],
  ['SERVICE_CREDIT_SCORE', 'Score de crédito', 'Pessoa Física', { service: 'SERVICE_CREDIT_SCORE', cpf: 'cpf' }],
  ['SERVICE_CPF_ADDRESS_VALIDATION', 'Validação de CPF com endereço', 'Pessoa Física', { service: 'SERVICE_CPF_ADDRESS_VALIDATION', cpf: 'cpf', zipcode: '00000-000', numberAddress: 13 }],
  ['SERVICE_CPF_PHONE_VALIDATION', 'Validação de CPF com telefone', 'Pessoa Física', { service: 'SERVICE_CPF_PHONE_VALIDATION', cpf: 'cpf', phone: '11900000000' }],
  ['SERVICE_CPF_PHONE_VALIDATION', 'Validação de CPF com telefone', 'Pessoa Física', { service: 'SERVICE_CPF_PHONE_VALIDATION', cpf: 'cpf', phone: '11900000000' }],
  ['SERVICE_CONFIRM_PHONE', 'Obtenção de dados pelo telefone', 'Pessoa Física', { service: 'SERVICE_CONFIRM_PHONE', phone: '+5561123456789' }],
  ['SERVICE_CRIMINAL_RECORD_CIVIL', 'Antecedentes criminais civis', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_CIVIL', cpf: 'cpf', rg: 'rg', uf: 'uf' }],
  ['SERVICE_CRIMINAL_RECORD_FEDERAL', 'Antecedentes criminais federais', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_FEDERAL', cpf: 'cpf' }],
  ['SERVICE_DEFAULT_RISK_SCORE', 'Score de inadimplência', 'Pessoa Física', { service: 'SERVICE_DEFAULT_RISK_SCORE', cpf: 'cpf' }],
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
  ['SERVICE_FACE_MATCH', 'FaceMatch', 'Pessoa Física', { service: 'SERVICE_FACE_MATCH', image1: 'base64', image2: 'base64' }],
  ['SERVICE_FAMILY_SOCIAL_BENEFITS', 'Benefícios sociais familiares', 'Pessoa Física', { service: 'SERVICE_FAMILY_SOCIAL_BENEFITS', cpf: 'cpf' }],
  ['SERVICE_FAMILY_POLITICAL_HISTORY_CPF', 'Histórico político familiar PF', 'Pessoa Física', { service: 'SERVICE_FAMILY_POLITICAL_HISTORY_CPF', cpf: 'cpf' }],
  ['SERVICE_FINANCIAL_INFORMATION', 'Informações financeiras', 'Pessoa Física', { service: 'SERVICE_FINANCIAL_INFORMATION', cpf: 'cpf' }],
  ['SERVICE_FRAUD_RISK_SCORE', 'Score de risco de fraude', 'Pessoa Física', { service: 'SERVICE_FRAUD_RISK_SCORE', cpf: 'cpf', factor: 'minRisk or minattrition' }],
  ['SERVICE_JURIDICAL_PROCESSES', 'Processos jurídicos e administrativos', 'Pessoa Física', { service: 'SERVICE_JURIDICAL_PROCESSES', cpf: 'cpf' }],
  ['SERVICE_LIVENESS_2D', 'Liveness 2D', 'Pessoa Física', { service: 'SERVICE_LIVENESS_2D', image1: 'selfie' }],
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
  ['SERVICE_PROTEST_PF', 'Certidão negativa de protesto PF', 'Pessoa Física', { service: 'SERVICE_PROTEST_PF', cpf: 'cpf' }],
  ['SERVICE_PUBLIC_SERVANTS', 'Servidores públicos', 'Pessoa Física', { service: 'SERVICE_PUBLIC_SERVANTS', cpf: 'cpf' }],
  ['SERVICE_RELATED_PEOPLE', 'Pessoas relacionadas', 'Pessoa Física', { service: 'SERVICE_RELATED_PEOPLE', cpf: 'cpf' }],
  ['SERVICE_RFB_PF', 'CPF na Receita Federal', 'Pessoa Física', { service: 'SERVICE_RFB_PF', cpf: 'cpf', dataDeNascimento: 'yyyy-MM-dd (opcional)' }],
  ['SERVICE_SOCIAL_ASSISTANCE_EXTENDED', 'Benefícios sociais estendidos PF', 'Pessoa Física', { service: 'SERVICE_SOCIAL_ASSISTANCE_EXTENDED', cpf: 'cpf' }],
  ['SERVICE_ACTIVE_DEBT_PJ', 'Débitos ativos PJ', 'Pessoa Jurídica', { service: 'SERVICE_ACTIVE_DEBT_PJ', cnpj: 'cnpj' }],
  ['SERVICE_ADDRESSES_EXTENDED_CNPJ', 'Endereços estendidos CNPJ', 'Pessoa Jurídica', { service: 'SERVICE_ADDRESSES_EXTENDED_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_KYC_OWNERS', 'KYC e compliance dos sócios', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_KYC_OWNERS', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RELATIONSHIP', 'Relacionamentos de empresa', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RELATIONSHIP', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RFB_OWNERS', 'Sócios na Receita Federal', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RFB_OWNERS', cnpj: 'cnpj' }],
  ['SERVICE_COMPLIANCE_BET', 'Compliance de casas de apostas', 'Pessoa Jurídica', { service: 'SERVICE_COMPLIANCE_BET', cnpj: 'cnpj' }],
  ['SERVICE_COMPLIANCE_BET_PJ', 'Compliance de casas de apostas PJ', 'Pessoa Jurídica', { service: 'SERVICE_COMPLIANCE_BET_PJ', cnpj: 'cnpj' }],
  ['SERVICE_CORPORATE_DATA_ENRICHMENT', 'Enriquecimento de dados PJ', 'Pessoa Jurídica', { service: 'SERVICE_CORPORATE_DATA_ENRICHMENT', cnpj: 'cnpj' }],
  ['SERVICE_CREDIT_RISK_COMPANY', 'Risco de crédito PJ', 'Pessoa Jurídica', { service: 'SERVICE_CREDIT_RISK_COMPANY', cnpj: 'cnpj' }],
  ['SERVICE_CREDIT_RISK_COMPANY', 'Risco de crédito PJ ', 'Pessoa Jurídica', { service: 'SERVICE_CREDIT_RISK_COMPANY', cnpj: 'cnpj' }],
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
  ['SERVICE_PROTEST_PJ', 'Certidão negativa de protesto PJ', 'Pessoa Jurídica', { service: 'SERVICE_PROTEST_PJ', cnpj: 'cnpj' }],
  ['SERVICE_OCR_CNPJ_CARD', 'OCR de cartão CNPJ', 'Pessoa Jurídica', { service: 'SERVICE_OCR_CNPJ_CARD', image1: 'base64' }],
  ['SERVICE_REGISTRATION_DATA_CNPJ', 'Dados cadastrais de CNPJ', 'Pessoa Jurídica', { service: 'SERVICE_REGISTRATION_DATA_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_RFB_PJ', 'CNPJ na Receita Federal', 'Pessoa Jurídica', { service: 'SERVICE_RFB_PJ', cnpj: 'cnpj' }],
  ['SERVICE_SINTEGRA_CONSULTATION', 'Consulta do SINTEGRA', 'Pessoa Jurídica', { service: 'SERVICE_SINTEGRA_CONSULTATION', cnpj: 'cnpj', uf: 'uf (opcional)' }],
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
      responseSummary: serviceResponseSummary({ name, service, category }),
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
  addTag(tags, /ocr|image|base64|documento|cartao|comprovante|emancipacao/.test(searchable), 'imagem');
  addTag(tags, /ocr/.test(searchable), 'ocr');
  addTag(tags, /rg/.test(searchable), 'rg');
  addTag(tags, /cnh/.test(searchable), 'cnh');
  addTag(tags, /cartao cnpj|cartao-cnpj/.test(searchable), 'cartao-cnpj');
  addTag(tags, /comprovante|endereco/.test(searchable), 'comprovante-endereco');
  addTag(tags, /face|selfie|biometria/.test(searchable), 'face');
  addTag(tags, /bigdatacorp/.test(searchable), 'bigdatacorp');
  addTag(tags, /aws|textract/.test(searchable), 'aws');
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
    notes.push('Use imagem real e legível do documento. Base64 deve ser puro, sem prefixo data:image.');
    notes.push('Se o OCR não extrair um campo, explique que o retorno depende da leitura da imagem e não invente valor.');
  }

  if (tags.has('face')) {
    notes.push('Use selfie real, frontal e nítida. Não use foto de RG, CNH ou print de documento.');
    notes.push('Face Index busca correspondência na base de faces; isso não é validação definitiva de identidade.');
  }

  if (tags.has('risco-credito')) {
    notes.push('Explique score, rating e risco apenas quando esses campos aparecerem no result.');
  }

  if (tags.has('bigdatacorp') || tags.has('assertiva') || tags.has('quantum') || tags.has('aws')) {
    notes.push('Pode depender de massa dispon\u00edvel e configura\u00e7\u00e3o do produto.');
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
  'SERVICE_CPF_PHONE_VALIDATION',
  'SERVICE_CRIMINAL_RECORD_CIVIL',
  'SERVICE_CRIMINAL_RECORD_FEDERAL',
  'SERVICE_CREDIT_RISK_COMPANY',
  'SERVICE_CREDIT_RISK_COMPANY',
  'SERVICE_CREDIT_SCORE',
  'SERVICE_DAS_MEI',
  'SERVICE_DATAVALID_CNH',
  'SERVICE_DEFAULT_RISK_SCORE',
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
  'SERVICE_LIVENESS_2D',
  'SERVICE_MEDIA_PROFILE_EXPOSURE_PF',
  'SERVICE_MEDIA_PROFILE_EXPOSURE_PJ',
  'SERVICE_MEI',
  'SERVICE_NOTHING_RECORD_LAWSUITS',
  'SERVICE_OCR',
  'SERVICE_OCR_CNPJ_CARD',
  'SERVICE_OCR_EMANCIPATION',
  'SERVICE_OCR_PROOF_OF_ADDRESS',
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
  'SERVICE_PROTEST_PF',
  'SERVICE_PROTEST_PJ',
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
]);

function filterActiveServiceApiServices(catalog) {
  return catalog.filter((service) => activeServiceApiAliases.has(service.service));
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
  if (text.includes('kyc')) terms.add('compliance KYC sanções PEP mídia');
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

function apiReferenceServiceUrl(item) {
  const base = `${siteUrl}/api-reference/servi%C3%A7os--pessoas/executar-servi%C3%A7o-de-dados-risco-ou-compliance`;
  return base;
}

function guideUrlForCategory(category) {
  const map = {
    'Pessoa Física': `${siteUrl}/guides/servicos-pessoa-fisica`,
    'Pessoa Jurídica': `${siteUrl}/guides/servicos-pessoa-juridica`,
    Customers: `${siteUrl}/api-reference/boas-vindas`,
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
        body: { service: 'SERVICE_RFB_PF', cpf: '00000000000', dataDeNascimento: 'yyyy-MM-dd (opcional)' },
      }),
    },
    {
      file: 'service-api-cpf.prod.curl',
      title: 'Consulta simples de CPF em produção',
      description: 'Mesmo payload da consulta de CPF, apontando para produção.',
      content: renderCurl({
        baseUrl: 'https://backoffice.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_RFB_PF', cpf: '00000000000', dataDeNascimento: 'yyyy-MM-dd (opcional)' },
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
  lines.push('- Não invente endpoints, parâmetros ou services.');
  '- Para consultas externas, use `POST /api/service-api` e selecione o produto pelo campo `service`.',
  '- Antes de responder payload, confirme se o alias é o alias de chamada configurado no produto.',
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
    lines.push(`- Service: \`${service.service}\``);
    lines.push(`- Endpoint: \`${service.endpoint}\``);
    lines.push(`- Campos do request: ${service.requestFields.length ? service.requestFields.map((field) => `\`${field}\``).join(', ') : 'sem campos adicionais mapeados'}`);
    lines.push(`- Termos de busca: ${displaySearchTerms(service, 10)}`);
    lines.push(`- Retorno principal: ${service.responseSummary}`);
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

function pushSearchHowTo(lines) {
  lines.push('## Como pesquisar melhor');
  lines.push('');
  lines.push('A busca funciona melhor quando o termo aparece como título, alias ou texto da página. Se não souber o alias exato, pesquise pelo tipo de documento, dado ou problema que quer resolver.');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card title="Tenho um CPF" href="#pessoa-fisica">');
  lines.push(' Pesquise por \`cpf\`, \`receita\`, \`score\`, \`risco\`, \`telefone\`, \`email\`, \`ocr\`, \`face\` ou \`processos\`.');
  lines.push(' </Card>');
  lines.push(' <Card title="Tenho um CNPJ" href="#pessoa-juridica">');
  lines.push(' Pesquise por \`cnpj\`, \`receita\`, \`risco de crédito\`, \`sócios\`, \`domínios\`, \`cartão CNPJ\` ou \`compliance\`.');
  lines.push(' </Card>');
  lines.push(' <Card title="Tenho uma imagem" href="/guides/service-api/sobre-ocr-service-api">');
  lines.push(' Pesquise por \`OCR\`, \`CNH\`, \`RG\`, \`cartão CNPJ\`, \`comprovante de endereço\`, \`base64\` ou \`image1\`.');
  lines.push(' </Card>');
  lines.push(' <Card title="Quero copiar payload" href="/api-reference/services-pessoa-fisica">');
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
    lines.push(' <Card title="' + title + '">');
    lines.push(' ' + body);
    lines.push(' </Card>');
  }
  lines.push('</CardGroup>');
  lines.push('');
}

function renderServiceIndexCard(service) {
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

function renderServicesIndex(catalog) {
  const lines = [];
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
  lines.push(' <Card title="Pessoa Física" href="#pessoa-fisica">');
  lines.push(' ' + catalog.filter((service) => service.category === 'Pessoa Física').length + ' services para CPF, biometria, OCR, contatos, risco, crédito, compliance e dados eleitorais.');
  lines.push(' </Card>');
  lines.push(' <Card title="Pessoa Jurídica" href="#pessoa-juridica">');
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
  lines.push(' <Card title="Services de pessoa física" href="/api-reference/services-pessoa-fisica">');
  lines.push(' Catálogo completo com payloads e responses para services de CPF.');
  lines.push(' </Card>');
  lines.push(' <Card title="Services de pessoa jurídica" href="/api-reference/services-pessoa-juridica">');
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
    summary: 'Retorna enderecos associados ao CNPJ, incluindo logradouro, bairro, cidade, UF, CEP, pais, tipo de endereco e dados complementares quando disponiveis.',
    result: { cnpj: 'cnpj', totalAddresses: 1, addresses: [{ address: 'Av Exemplo', city: 'Sao Paulo', state: 'SP', zipcode: '01001000', addressType: 'COMMERCIAL' }] },
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
    summary: 'Retorna checagens de KYC e compliance dos socios da empresa, incluindo PEP, sancoes, midia, risco e alertas encontrados por socio.',
    result: { cnpj: 'cnpj', ownersChecked: 2, owners: [{ name: 'Nome do socio', isPep: false, sanctions: [], riskAlerts: [] }] },
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
    summary: 'Retorna se o telefone informado tem associacao com o CPF, incluindo nivel de match, tipo de linha, status e sinais de validacao.',
    result: { cpf: 'cpf', phone: '11900000000', match: true, confidence: 'HIGH', lineType: 'MOBILE' },
  },
  SERVICE_CPF_PHONE_VALIDATION: {
    summary: 'Retorna validacao da associacao entre CPF e telefone, com status de match, mensagem da consulta e dados retornados na consulta.',
    result: { cpf: 'cpf', phone: '11900000000', match: true, statusMessage: 'Telefone associado ao documento' },
  },
  SERVICE_CREDIT_RISK_COMPANY: {
    summary: 'Retorna dados públicos de risco de crédito da empresa, como status, score, rating, risco esperado e processos legais quando disponíveis.',
    result: { cnpj: 'cnpj', creditRisk: { status: 'APPROVED', score: '750', rating: 'A', expectedDefault: 'LOW', legalProcess: false } },
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
    summary: 'Retorna score de inadimplencia do CPF, faixa de risco, probabilidade estimada e indicadores usados na avaliacao.',
    result: { cpf: 'cpf', score: 742, riskLevel: 'LOW', defaultProbability: '3%' },
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
  SERVICE_LIVENESS_2D: {
    summary: 'Retorna resultado da prova de vida 2D, com status, score ou confianca da selfie e sinais de validacao contra fraude simples.',
    result: { liveness: true, confidence: 0.97, status: 'APPROVED' },
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
    result: { cpf: 'cpf', name: 'Nome completo', birthDate: 'yyyy-MM-dd', registrationStatus: 'REGULAR', motherName: 'Nome da mae' },
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
  SERVICE_PROTEST_PF: {
    summary: 'Retorna certidao/consulta de protestos para CPF, com status, cartorios consultados, protestos e mensagens.',
    result: { cpf: 'cpf', hasProtests: false, notaryOffices: [], protests: [] },
  },
  SERVICE_PROTEST_PJ: {
    summary: 'Retorna certidao/consulta de protestos para CNPJ, com status, cartorios consultados, protestos, valores e datas.',
    result: { cnpj: 'cnpj', hasProtests: false, notaryOffices: [], protests: [] },
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
    result: { cpf: 'cpf', name: 'Nome completo', birthDate: 'yyyy-MM-dd', registrationStatus: 'REGULAR', protocol: 'protocolo' },
  },
  SERVICE_RFB_PF_ON_DEMAND: {
    summary: 'Retorna situacao atualizada do CPF consultada sob demanda na Receita Federal, com nome, nascimento, status cadastral e protocolo.',
    result: { cpf: 'cpf', name: 'Nome completo', birthDate: 'yyyy-MM-dd', registrationStatus: 'REGULAR', protocol: 'protocolo' },
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
    summary: 'Retorna propensao do CPF a apostas online, com score, faixa de propensao, indicadores comportamentais e sinais associados quando disponiveis.',
    result: { cpf: 'cpf', propensityScore: 78, propensityLevel: 'HIGH', indicators: ['sinal encontrado'] },
  },
};

function serviceResponseSummary(service) {
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

function fieldRowsFromService(service) {
  const body = jsonBodyFromRequestExample(service.requestExample);
  return Object.entries(body).map(([name, value]) => {
    const raw = `${value ?? ''}`;
    return {
      name,
      value,
      required: name === 'service' || !isOptionalServiceField(service, name, raw),
      description: pt(serviceFieldDescription(service, name)),
    };
  });
}
function serviceResponseExample(service) {
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

function pushOcrApiReferenceBlock(lines, service) {
  const details = ocrServiceApiDetails[service.service];
  if (!details) return;

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

function serviceFieldDescription(service, fieldName) {
  const field = normalizeText(fieldName);
  const serviceText = normalizeText(`${service.name} ${service.service}`);

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


function resultFieldDescription(service, fieldName) {
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

function resultRowsFromService(service) {
  const result = serviceResponseExample(service).result || {};
  return Object.keys(result).slice(0, 12).map((name) => ({
    name,
    description: resultFieldDescription(service, name),
  }));
}

function resultKeysSummary(service) {
  const keys = Object.keys(serviceResponseExample(service).result || {});
  if (!keys.length) return 'sem campos fixos no exemplo resumido';
  const visible = keys.slice(0, 6).map((key) => '\`' + key + '\`').join(', ');
  return keys.length > 6 ? visible + ' e mais ' + (keys.length - 6) : visible;
}

function pushServiceSummaryCards(lines, service, required, optional) {
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card title="Entrada">');
  lines.push(' Campos obrigatórios: ' + required + '.');
  lines.push(' </Card>');
  lines.push(' <Card title="Resultado">');
  lines.push(' Principais campos em \`result\`: ' + resultKeysSummary(service) + '.');
  lines.push(' </Card>');
  lines.push(' <Card title="Status da chamada">');
  lines.push(' Use \`status.code\` e \`status.message\` para entender se a consulta processou corretamente.');
  lines.push(' </Card>');
  lines.push(' <Card title="Campos opcionais">');
  lines.push(' ' + optional);
  lines.push(' </Card>');
  lines.push('</CardGroup>');
  lines.push('');
}

function pushPublicResponseCards(lines) {
  lines.push('### Como consumir o retorno');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card title="result">');
  lines.push(' Dados públicos do service. É o objeto principal para mapear no sistema do cliente.');
  lines.push(' </Card>');
  lines.push(' <Card title="status">');
  lines.push(' Status técnico da chamada, com \`code\` e \`message\`.');
  lines.push(' </Card>');
  lines.push(' <Card title="onboardingStatus">');
  lines.push(' Quando retornado, resume o desfecho operacional: \`APPROVED\`, \`REFUSED\` ou \`ERROR\`.');
  lines.push(' </Card>');
  lines.push(' <Card title="externalId">');
  lines.push(' Identificador para rastrear a consulta em suporte, logs ou auditoria.');
  lines.push(' </Card>');
  lines.push('</CardGroup>');
  lines.push('');
}

function pushResultFieldsTable(lines, service) {
  const rows = resultRowsFromService(service);
  if (!rows.length) return;
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

function renderServiceQuickstartPage() {
  const lines = [];

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
  lines.push('| Produto usa alias curto | Confirme no produto qual alias está liberado e envie esse valor no campo `service`. |');
  lines.push('| CPF, CNPJ, imagem ou parâmetro obrigatório ausente | Confira a seção de campos do service escolhido. |');
  lines.push('| Serviço de documento, OCR ou biometria retornou erro de parâmetro | Envie imagem/base64, URL ou `key` real. Payloads curtos servem apenas para testar autenticação e liberação do produto. |');
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
  lines.push('<CardGroup cols={3}>');
  lines.push(' <Card title="Pessoa física" href="/api-reference/services-pessoa-fisica">');
  lines.push(' CPF, dados cadastrais, OCR, biometria, risco, compliance e contatos.');
  lines.push(' </Card>');
  lines.push(' <Card title="Pessoa jurídica" href="/api-reference/services-pessoa-juridica">');
  lines.push(' CNPJ, Receita Federal, risco de crédito, sócios, domínios, compliance e OCR.');
  lines.push(' </Card>');
  lines.push(' <Card title="Receitas prontas" href="/guides/receitas-prontas">');
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

function renderApiReferenceServicesPage(catalog, category, title, description) {
  const items = catalog.filter((service) => service.category === category);
  const grouped = new Map();
  for (const service of items) {
    const family = serviceFamily(service);
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

  lines.push('---');
  lines.push(`title: ${title}`);
  lines.push(`description: ${description}`);
  lines.push('---');
  lines.push('');
  lines.push('<Info>');
  lines.push(`${description} Todos os services usam \`POST /api/service-api\`; o produto executado \u00e9 definido pelo campo \`service\` no body.`);
  lines.push('</Info>');
  lines.push('');
  lines.push('<Warning>');
  lines.push('Use exatamente o valor exibido em `Service`. N\u00e3o envie alias interno nem nome de integra\u00e7\u00e3o.');
  lines.push('</Warning>');
  lines.push('');
  lines.push('## Antes de testar');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  lines.push(' <Card title="Contrato base" href="/api-reference/como-executar-service">');
  lines.push(' Veja token, headers, body padr\u00e3o, `result`, `status` e `externalId`.');
  lines.push(' </Card>');
  lines.push(' <Card title="Postman do zero" href="/guides/postman-do-zero">');
  lines.push(' Configure HML, gere token e execute `POST /api/service-api` com um payload real.');
  lines.push(' </Card>');
  if (category === 'Pessoa Jurdica') {
    lines.push(' <Card title="OCR de cart\u00e3o CNPJ" href="/guides/service-api/sobre-ocr-service-api#ocr-de-cartao-cnpj">');
    lines.push(' Payload, imagem esperada, retorno limpo e diagn\u00f3stico de erro para cart\u00e3o CNPJ.');
    lines.push(' </Card>');
    lines.push(' <Card title="Fluxos prontos" href="/guides/receitas-prontas">');
    lines.push(' Exemplos completos para CNPJ, risco, cadastro e OCR.');
    lines.push(' </Card>');
  } else {
    lines.push(' <Card title="OCR e imagem" href="/guides/service-api/sobre-ocr-service-api">');
    lines.push(' Payloads para CNH, RG, comprovante, cart\u00e3o CNPJ, base64 e erros de imagem.');
    lines.push(' </Card>');
    lines.push(' <Card title="Fluxos prontos" href="/guides/receitas-prontas">');
    lines.push(' Exemplos completos para CPF, OCR, Face Index, risco e score.');
    lines.push(' </Card>');
  }
  lines.push('</CardGroup>');
  lines.push('');
  lines.push('## Como usar esta p\u00e1gina');
  lines.push('');
  lines.push('<Steps>');
  lines.push(' <Step title="Escolha a fam\u00edlia">');
  lines.push(' Use os cards abaixo para localizar o grupo certo de services.');
  lines.push(' </Step>');
  lines.push(' <Step title="Abra o service">');
  lines.push(' No cat\u00e1logo completo, abra o accordion do service e copie o body de exemplo.');
  lines.push(' </Step>');
  lines.push(' <Step title="Leia o retorno">');
  lines.push(' Use `result` como contrato p\u00fablico e preserve `status`, `onboardingStatus` e `externalId`.');
  lines.push(' </Step>');
  lines.push('</Steps>');
  lines.push('');
  lines.push('## Fam\u00edlias de services');
  lines.push('');
  lines.push('<CardGroup cols={2}>');
  for (const [family, services] of orderedFamilies) {
    const sorted = services.slice().sort((a, b) => a.name.localeCompare(b.name));
    const examples = sorted.slice(0, 3).map((service) => `\`${service.service}\``).join(', ');
    const suffix = sorted.length > 3 ? ` e mais ${sorted.length - 3}` : '';
    lines.push(` <Card title="${escapeAttribute(family)}">`);
    lines.push(` ${sorted.length} service${sorted.length === 1 ? '' : 's'}: ${examples}${suffix}.`);
    lines.push(' </Card>');
  }
  lines.push('</CardGroup>');
  lines.push('');
  lines.push('## Catálogo completo');
  lines.push('');
  lines.push('Abra um service para ver quando usar, campos obrigat\u00f3rios, body, curl e response resumido.');
  lines.push('');
  lines.push('<AccordionGroup>');
  for (const service of orderedServices) {
    lines.push(renderServiceRequestBlock(service));
    lines.push('');
  }
  lines.push('</AccordionGroup>');
  lines.push('');
  lines.push('## Padr\u00f5es de erro');
  lines.push('');
  lines.push('Os exemplos abaixo mostram formatos comuns. A mensagem pode variar conforme valida\u00e7\u00e3o, produto e ambiente.');
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
const baseServicesCatalog = filterActiveServiceApiServices(mergePartnerApiServices(buildServicesCatalog(openApiSummary.services)));
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
  lines.push('- Operar como fonte somente leitura da documentação.');
  lines.push('- Não chamar HML, produção, banco ou endpoints idCerberus.');
  lines.push('- Não solicitar nem armazenar `client`, `secret`, JWT, CPF, CNPJ ou imagem real.');
  lines.push('- Usar homologação como ambiente padrão quando gerar exemplos.');
  lines.push('- Se o service não existir no catálogo, responder que precisa ser confirmado antes de integrar.');
  lines.push('- Preferir `result` como contrato público; não usar `fieldsOutput` ou metadados internos.');
  lines.push('');
}

function pushServiceApiContract(lines) {
  lines.push('## Contrato base do POST /api/service-api');
  lines.push('');
  lines.push('- Endpoint de homologação: `POST https://backoffice-hml.idcerberus.com/api/service-api`.');
  lines.push('- Endpoint de produção: `POST https://backoffice.idcerberus.com/api/service-api`.');
  lines.push('- Header obrigatório: `Authorization: Bearer {jwt_token}`.');
  lines.push('- Header recomendado: `Content-Type: application/json`.');
  lines.push('- Campo obrigatório no body: `service`.');
  lines.push('- O alias enviado em `service` deve ser o alias configurado no produto do cliente.');
  lines.push('- Leia dados públicos em `result`; não trate `fieldsOutput` ou metadados internos como contrato público.');
  lines.push('- Preserve `status`, `onboardingStatus` e `externalId` ao explicar respostas.');
  lines.push('');
}

function pushOcrLlmNotes(lines) {
  lines.push('## Notas rápidas para OCR e imagem');
  lines.push('');
  lines.push('- OCR usa imagem do documento, não selfie.');
  lines.push('- Face, FaceMatch e Face Index usam selfie/rosto, não foto de RG ou CNH.');
  lines.push('- `image1` deve receber base64 puro, sem prefixo `data:image/...;base64,`.');
  lines.push('- RG normalmente usa frente e verso: `image1` e `image2`.');
  lines.push('- CNH usa `SERVICE_OCR`, `documentType: CNH` e `image1`.');
  lines.push('- Cartão CNPJ usa `SERVICE_OCR_CNPJ_CARD` e `image1`.');
  lines.push('- Comprovante de endereço usa `SERVICE_OCR_PROOF_OF_ADDRESS` e `image1`.');
  lines.push('- Emancipação usa `SERVICE_OCR_EMANCIPATION`; o documento varia e o sucesso depende de OCR com texto útil.');
  lines.push('- Se a imagem estiver ausente, ilegível ou for do tipo errado, espere `REFUSED` com mensagem clara, não invente sucesso.');
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
  lines.push('| `onboardingStatus: ERROR` | Falha técnica , storage, processamento externo ou processamento. | Usar `externalId`, horário e ambiente para investigar. |');
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
        meaning: 'Falha técnica , storage, processamento ou processamento externo.',
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
  '- Use a documentação como fonte principal e não invente endpoints, parâmetros ou services.',
  '- Para consultas externas, use `POST /api/service-api` e selecione o produto pelo campo `service`.',
  '- Use `Authorization: Bearer {jwt_token}` em chamadas protegidas.',
  '- Use homologação para testes e produção somente quando o usuário pedir explicitamente.',
  '- Nunca exponha tokens, secrets, CPFs, CNPJs ou imagens reais em exemplos.',
  '- Para OCR, use base64 puro em `image1`/`image2` e não inclua prefixo `data:image/...;base64,`.',
  '- Não use `fieldsOutput`, campos nulos ou metadados internos como contrato público; use `result`.',
  '- Se um service não aparecer no catálogo, informe que ele precisa ser confirmado antes de documentar ou integrar.',
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

mdxPages = pages.filter((page) => !page.openapi).map((page) => ({
  ...page,
  ...getPageMeta(page.slug),
}));

const llmsLines = [];
llmsLines.push('# idCerberus API Docs');
llmsLines.push('');
llmsLines.push('> Documentação da API idCerberus para onboarding digital, KYC, biometria, FaceMatch, Liveness, análise de risco, compliance, enriquecimento cadastral e consultas de pessoa física e pessoa jurídica.');
llmsLines.push('');
llmsLines.push('Base URLs:');
llmsLines.push('');
llmsLines.push('- Homologação: `https://backoffice-hml.idcerberus.com`');
llmsLines.push('- Produção: `https://backoffice.idcerberus.com`');
llmsLines.push('- Documentação publicada: `https://api-docs.idcerberus.com/`');
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
llmsLines.push(`- [services-catalog.min.json](${siteUrl}/services-catalog.min.json): índice leve para busca rápida por service, categoria, tag e campos.`);
llmsLines.push(`- [services-catalog.json](${siteUrl}/services-catalog.json): catálogo estruturado para ferramentas e automações.`);
llmsLines.push(`- [mcp-manifest.json](${siteUrl}/mcp-manifest.json): manifesto para MCPs e agentes com recursos, regras e ferramentas sugeridas.`);
llmsLines.push('');
llmsLines.push('## Exemplos curl');
llmsLines.push('');
for (const example of exampleFiles) llmsLines.push(`- [${example.file}](${example.url}): ${example.title}. ${example.description}`);

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
  const terms = displaySearchTerms(item, 4);
  smallLines.push(`- ${item.category} - ${item.name}: \`${item.service}\` | campos: ${item.requestFields.length ? item.requestFields.join(', ') : '-'} | busca: ${terms}`);
}
smallLines.push('');
smallLines.push('## Arquivos auxiliares');
smallLines.push('');
smallLines.push(`- Catálogo JSON: ${siteUrl}/services-catalog.json`);
smallLines.push(`- Catálogo leve: ${siteUrl}/services-catalog.min.json`);
smallLines.push(`- API Reference para LLM: ${siteUrl}/llms-api-reference.txt`);
smallLines.push(`- Manifesto MCP: ${siteUrl}/mcp-manifest.json`);
smallLines.push('- Exemplos curl: ' + siteUrl + '/examples/auth.hml.curl');
smallLines.push('- Lista de exemplos curl: ' + siteUrl + '/llms.txt#exemplos-curl');

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
console.log('Generated guides/indice-de-services.mdx.');
console.log('Generated api-reference/como-executar-service.mdx.');
console.log('Generated api-reference/services-por-caso-de-uso.mdx.');
console.log('Generated api-reference/services-pessoa-fisica.mdx.');
console.log('Generated api-reference/services-pessoa-juridica.mdx.');
console.log(`Generated ${exampleFiles.length} curl examples.`);
