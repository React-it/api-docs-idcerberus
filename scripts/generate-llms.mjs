import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://api-docs.idcerberus.com';
const docsJsonPath = path.join(root, 'docs.json');
const openApiPath = path.join(root, 'api-reference', 'openapi.json');

const serviceAliasRows = [
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX', 'SERVICE_DOCUMENTOSCOPY'],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT_ACERTPIX', 'SERVICE_DIGITAL_DOCUMENTOSCOPY'],
  ['SERVICE_ECONOMIC_RELATIONSHIP_BIGDATACORP', 'economic_relationships'],
  ['SERVICE_EMAIL_VALIDATION_BIGDATACORP', 'SERVICE_EMAIL_VALIDATION1'],
  ['SERVICE_PROTEST_CLEARANCE_CERTIFICATE_BIGDATACORP, SERVICE_PROTEST_PF_INFOSIMPLES, SERVICE_PROTEST_PF_NETRIN', 'SERVICE_PROTEST_CLEARANCE_CERTIFICATE'],
  ['SERVICE_PROTEST_PJ_INFOSIMPLES, SERVICE_PROTEST_PJ_NETRIN', 'SERVICE_PROTEST_CLEARANCE_CERTIFICATE_PJ'],
  ['SERVICE_PERSON_AI_PROMPT_OPENAI', 'SERVICE_PERSON_AI_PROMPT'],
  ['SERVICE_ACTIVITIES_INDICATORS_BIGDATACORP', 'SERVICE_ACTIVITIES_INDICATORS'],
  ['SERVICE_AWARDS_AND_CERTIFICATIONS_CPF_BIGDATACORP', 'SERVICE_AWARDS_AND_CERTIFICATIONS_CPF'],
  ['SERVICE_COMPLIANCE_BET_BIGDATACORP', 'SERVICE_COMPLIANCE_BET'],
  ['SERVICE_CREDIT_RISK_COMPANY_BIGDATACORP', 'SERVICE_CREDIT_RISK_COMPANY'],
  ['SERVICE_CREDIT_RISK_COMPANY_MURABEI_BIGDATACORP', 'SERVICE_CREDIT_RISK_COMPANY_MURABEI'],
  ['SERVICE_CREDIT_SCORE_ASSERTIVA', 'SERVICE_CREDIT_SCORE'],
  ['SERVICE_DEFAULT_RISK_SCORE_QUANTUM_BIGDATACORP', 'SERVICE_DEFAULT_RISK_SCORE_QUANTUM'],
  ['SERVICE_DEMOGRAPHIC_DATA_CPF_BIGDATACORP', 'SERVICE_DEMOGRAPHIC_DATA_CPF'],
  ['SERVICE_DOMAINS_CNPJ_BIGDATACORP', 'SERVICE_DOMAINS_CNPJ'],
  ['SERVICE_DOMAINS_CPF_BIGDATACORP', 'SERVICE_DOMAINS_CPF'],
  ['SERVICE_FACE_INDEX_AWS', 'SERVICE_FACE_INDEX'],
  ['SERVICE_FAMILY_SOCIAL_BENEFITS_BIGDATACORP', 'SERVICE_FAMILY_SOCIAL_BENEFITS'],
  ['SERVICE_JURIDICAL_PROCESSES_PJ_BIGDATACORP', 'SERVICE_JURIDICAL_PROCESSES_PJ'],
  ['SERVICE_OCR_CNPJ_CARD_TEXTRACT', 'SERVICE_OCR_CNPJ_CARD'],
  ['SERVICE_OCR_PROOF_OF_ADDRESS_TEXTRACT', 'SERVICE_OCR_PROOF_OF_ADDRESS'],
  ['SERVICE_OCR_REACT', 'SERVICE_OCR'],
  ['SERVICE_REGISTRATION_DATA_CNPJ_BIGDATACORP', 'SERVICE_REGISTRATION_DATA_CNPJ'],
  ['SERVICE_SOCIAL_ASSISTANCE_EXTENDED_BIGDATACORP', 'SERVICE_SOCIAL_ASSISTANCE_EXTENDED'],
];

const serviceAliasRowsPessoaFisica = serviceAliasRows.filter(([documentedAlias]) => !documentedAlias.includes('SERVICE_PROTEST_PJ'));
const serviceAliasRowsPessoaJuridica = serviceAliasRows.filter(([documentedAlias]) => documentedAlias.includes('SERVICE_PROTEST_PJ'));

function pushServiceAliasNote(lines, { includeDocumentPayloadNote = false, rows = serviceAliasRows } = {}) {
  lines.push('<Warning>');
  lines.push('  Antes de executar a chamada, confirme qual alias está liberado no produto');
  lines.push('  do cliente. O campo `service` deve receber esse alias de chamada. Em alguns');
  lines.push('  casos, ele é mais curto que o alias técnico do parceiro exibido no catálogo.');
  lines.push('</Warning>');
  lines.push('');
  lines.push('Na prática: se o alias configurado no produto for diferente do alias abaixo,');
  lines.push('use o alias do produto no body. Isso evita erro de acesso ao serviço mesmo');
  lines.push('quando o produto está ativo.');
  lines.push('');
  lines.push('| Alias documentado/parceiro | Alias de chamada quando configurado no produto |');
  lines.push('| --- | --- |');
  for (const [documentedAlias, callAlias] of rows) {
    const documented = documentedAlias.split(', ').map((alias) => `\`${alias}\``).join(', ');
    lines.push(`| ${documented} | \`${callAlias}\` |`);
  }
  lines.push('');

  if (includeDocumentPayloadNote) {
    lines.push('<Info>');
    lines.push('  OCR, documentoscopia, FaceMatch e Liveness precisam de imagem/base64,');
    lines.push('  URL ou `key` real para retornar dados completos. Payload curto ajuda a');
    lines.push('  validar autenticação, acesso ao produto e formato básico da chamada, mas');
    lines.push('  não valida o retorno completo do parceiro.');
    lines.push('</Info>');
    lines.push('');
  }
}

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
        responseSummary: serviceResponseSummary({
          name: item.summary.replace(/^(PF|PJ)\s+-\s+/i, ''),
          service: item.service,
          category: serviceCategory(item.summary, item.service),
        }),
      };
    });
}

const partnerApiServices = [
  ['SERVICE_ACTIVITIES_INDICATORS', 'Indicadores de atividades (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ACTIVITIES_INDICATORS', cpf: 'cpf' }],
  ['SERVICE_ACTIVE_DEBT_PF_BIGDATACORP', 'Débitos ativos PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ACTIVE_DEBT_PF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_ADDRESS_BIGDATACORP', 'Endereços (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ADDRESS_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_AWARDS_AND_CERTIFICATIONS_CPF', 'Prêmios e certificações PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_AWARDS_AND_CERTIFICATIONS_CPF', cpf: 'cpf' }],
  ['SERVICE_CREDIT_SCORE', 'Score de crédito (Assertiva)', 'Pessoa Física', { service: 'SERVICE_CREDIT_SCORE', cpf: 'cpf' }],
  ['SERVICE_CPF_ADDRESS_VALIDATION_BIGDATACORP', 'Validação de CPF com endereço (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_CPF_ADDRESS_VALIDATION_BIGDATACORP', cpf: 'cpf', zipcode: '00000-000', numberAddress: 13 }],
  ['SERVICE_CPF_PHONE_VALIDATION_BIGDATACORP', 'Validação de CPF com telefone (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_CPF_PHONE_VALIDATION_BIGDATACORP', cpf: 'cpf', phone: '11900000000' }],
  ['SERVICE_CPF_PHONE_VALIDATION_FACETEC', 'Validação de CPF com telefone (Facetec)', 'Pessoa Física', { service: 'SERVICE_CPF_PHONE_VALIDATION_FACETEC', cpf: 'cpf', phone: '11900000000' }],
  ['SERVICE_CONFIRM_PHONE_FACETEC', 'Obtenção de dados pelo telefone (Facetec)', 'Pessoa Física', { service: 'SERVICE_CONFIRM_PHONE_FACETEC', phone: '+5561123456789' }],
  ['SERVICE_CRIMINAL_RECORD_CIVIL_BIGDATACORP', 'Antecedentes criminais civis (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_CIVIL_BIGDATACORP', cpf: 'cpf', rg: 'rg', uf: 'uf' }],
  ['SERVICE_CRIMINAL_RECORD_FEDERAL_BIGDATACORP', 'Antecedentes criminais federais (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_CRIMINAL_RECORD_FEDERAL_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_DEFAULT_RISK_SCORE_BIGDATACORP', 'Score de inadimplência (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_DEFAULT_RISK_SCORE_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_DEFAULT_RISK_SCORE_QUANTUM', 'Score de risco de inadimplência Quantum (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_DEFAULT_RISK_SCORE_QUANTUM', cpf: 'cpf' }],
  ['SERVICE_DEMOGRAPHIC_DATA_CPF', 'Dados sociodemográficos PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_DEMOGRAPHIC_DATA_CPF', cpf: 'cpf', birthDate: 'yyyy-MM-dd (opcional)' }],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX', 'Documentoscopia digital (Acertpix)', 'Pessoa Física', { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX', key: '{key}', image1: 'base64', image2: 'base64', selfie1: 'base64' }],
  ['SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT_ACERTPIX', 'Consulta da documentoscopia digital (Acertpix)', 'Pessoa Física', { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT_ACERTPIX', key: '{key}' }],
  ['SERVICE_DOMAINS_CPF', 'Domínios PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_DOMAINS_CPF', cpf: 'cpf' }],
  ['SERVICE_ECONOMIC_RELATIONSHIP_BIGDATACORP', 'Relacionamentos econômicos (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ECONOMIC_RELATIONSHIP_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_ELECTION_CANDIDATE_DATA_CPF_BIGDATACORP', 'Dados eleitorais de candidato PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ELECTION_CANDIDATE_DATA_CPF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_ELECTORAL_DONORS_CPF_BIGDATACORP', 'Doações eleitorais PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ELECTORAL_DONORS_CPF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_ELECTORAL_PROVIDERS_CPF_BIGDATACORP', 'Prestadores de serviços eleitorais PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ELECTORAL_PROVIDERS_CPF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_EMAILS_EXTENDED_BIGDATACORP', 'Histórico de e-mails (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_EMAILS_EXTENDED_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_EMAIL_VALIDATION_BIGDATACORP', 'Validação de e-mail (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_EMAIL_VALIDATION_BIGDATACORP', email: 'email@email.com' }],
  ['SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION_BIGDATACORP', 'Qualificação cadastral no eSocial (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION_BIGDATACORP', cpf: 'cpf', nit: 'nit (opcional)' }],
  ['SERVICE_FACE_INDEX', 'Busca de face na base (AWS)', 'Pessoa Física', { service: 'SERVICE_FACE_INDEX', cpf: 'cpf (opcional para busca)', image1: 'base64' }],
  ['SERVICE_FACE_MATCH_AWS', 'FaceMatch (AWS)', 'Pessoa Física', { service: 'SERVICE_FACE_MATCH_AWS', image1: 'base64', image2: 'base64' }],
  ['SERVICE_FACE_MATCH_BIGDATACORP', 'FaceMatch (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_FACE_MATCH_BIGDATACORP', image1: 'base64', image2: 'base64' }],
  ['SERVICE_FAMILY_SOCIAL_BENEFITS', 'Benefícios sociais familiares (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_FAMILY_SOCIAL_BENEFITS', cpf: 'cpf' }],
  ['SERVICE_FAMILY_POLITICAL_HISTORY_CPF_BIGDATACORP', 'Histórico político familiar PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_FAMILY_POLITICAL_HISTORY_CPF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_FINANCIAL_INFORMATION_BIGDATACORP', 'Informações financeiras (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_FINANCIAL_INFORMATION_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_FRAUD_RISK_SCORE_BIGDATACORP', 'Score de risco de fraude (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_FRAUD_RISK_SCORE_BIGDATACORP', cpf: 'cpf', factor: 'minRisk or minattrition' }],
  ['SERVICE_JURIDICAL_PROCESSES_BIGDATACORP', 'Processos jurídicos e administrativos (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_JURIDICAL_PROCESSES_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_LIVENESS_2D_FACETEC', 'Liveness 2D (Facetec)', 'Pessoa Física', { service: 'SERVICE_LIVENESS_2D_FACETEC', image1: 'selfie' }],
  ['SERVICE_MEDIA_PROFILE_EXPOSURE_PF_BIGDATACORP', 'Exposição e perfil na mídia PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PF_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_MEI_BIGDATACORP', 'Consulta de MEI (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_MEI_BIGDATACORP', cpf: 'cpf' }],
  ['SERVICE_NOTHING_RECORD_LAWSUITS_BIGDATACORP', 'Nada consta de ações judiciais (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_NOTHING_RECORD_LAWSUITS_BIGDATACORP', cpf: 'cpf', court: 'TRF1', uf: 'uf', sphere: 'CIVIL' }],
  ['SERVICE_OCR', 'OCR React de documentos (RG/CNH)', 'Pessoa Física', { service: 'SERVICE_OCR', documentType: 'CNH ou RG', image1: 'base64', image2: 'base64 (opcional para CNH; obrigatorio para RG)' }],
  ['SERVICE_OCR_BIGDATACORP', 'OCR de documentos (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_OCR_BIGDATACORP', image1: 'base64', image2: 'base64 (opcional conforme documento)', image1Url: 'url_image (opcional, alternativa ao base64)', image2Url: 'urlImageMatch (opcional, alternativa ao base64)' }],
  ['SERVICE_OCR_EMANCIPATION', 'OCR de documento de emancipação', 'Pessoa Física', { service: 'SERVICE_OCR_EMANCIPATION', image1: 'base64' }],
  ['SERVICE_OCR_PROOF_OF_ADDRESS', 'OCR de comprovante de endereço (Textract)', 'Pessoa Física', { service: 'SERVICE_OCR_PROOF_OF_ADDRESS', image1: 'base64' }],
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
  ['SERVICE_SOCIAL_ASSISTANCE_EXTENDED', 'Benefícios sociais estendidos PF (BigDataCorp)', 'Pessoa Física', { service: 'SERVICE_SOCIAL_ASSISTANCE_EXTENDED', cpf: 'cpf' }],
  ['SERVICE_ACTIVE_DEBT_PJ_BIGDATACORP', 'Débitos ativos PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_ACTIVE_DEBT_PJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_ADDRESSES_EXTENDED_CNPJ_BIGDATACORP', 'Endereços estendidos CNPJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_ADDRESSES_EXTENDED_CNPJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_KYC_OWNERS_BIGDATACORP', 'KYC e compliance dos sócios (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_KYC_OWNERS_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RELATIONSHIP_BIGDATACORP', 'Relacionamentos de empresa (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RELATIONSHIP_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_COMPANY_RFB_OWNERS_BIGDATACORP', 'Sócios na Receita Federal (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_COMPANY_RFB_OWNERS_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_COMPLIANCE_BET', 'Compliance de casas de apostas (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_COMPLIANCE_BET', cnpj: 'cnpj' }],
  ['SERVICE_COMPLIANCE_BET_PJ_BIGDATACORP', 'Compliance de casas de apostas PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_COMPLIANCE_BET_PJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_CORPORATE_DATA_ENRICHMENT_BIGDATACORP', 'Enriquecimento de dados PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_CORPORATE_DATA_ENRICHMENT_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_CREDIT_RISK_COMPANY', 'Risco de crédito PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_CREDIT_RISK_COMPANY', cnpj: 'cnpj' }],
  ['SERVICE_CREDIT_RISK_COMPANY_MURABEI', 'Risco de crédito PJ Murabei (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_CREDIT_RISK_COMPANY_MURABEI', cnpj: 'cnpj' }],
  ['SERVICE_DAS_MEI_INFOSIMPLES', 'DAS MEI na Receita (InfoSimples)', 'Pessoa Jurídica', { service: 'SERVICE_DAS_MEI_INFOSIMPLES', cnpj: 'cnpj' }],
  ['SERVICE_DOMAINS_CNPJ', 'Domínios CNPJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_DOMAINS_CNPJ', cnpj: 'cnpj' }],
  ['SERVICE_ELECTORAL_DONORS_CNPJ_BIGDATACORP', 'Doações eleitorais PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_ELECTORAL_DONORS_CNPJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_ELECTORAL_PROVIDERS_CNPJ_BIGDATACORP', 'Fornecedores eleitorais PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_ELECTORAL_PROVIDERS_CNPJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_FIRST_LEVEL_PARTNER_BIGDATACORP', 'Sócios de primeiro nível (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_FIRST_LEVEL_PARTNER_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_JURIDICAL_PROCESSES_PJ', 'Processos jurídicos PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_JURIDICAL_PROCESSES_PJ', cnpj: 'cnpj' }],
  ['SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS_BIGDATACORP', 'Processos jurídicos dos sócios (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_MEDIA_PROFILE_EXPOSURE_PJ_BIGDATACORP', 'Exposição e perfil na mídia PJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ_BIGDATACORP', 'Doações eleitorais dos sócios (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ_BIGDATACORP', cnpj: 'cnpj' }],
  ['SERVICE_PROTEST_PJ_INFOSIMPLES', 'Certidão negativa de protesto PJ (InfoSimples)', 'Pessoa Jurídica', { service: 'SERVICE_PROTEST_PJ_INFOSIMPLES', cnpj: 'cnpj' }],
  ['SERVICE_PROTEST_PJ_NETRIN', 'Certidão negativa de protesto PJ (Netrin)', 'Pessoa Jurídica', { service: 'SERVICE_PROTEST_PJ_NETRIN', cnpj: 'cnpj' }],
  ['SERVICE_OCR_CNPJ_CARD', 'OCR de cartão CNPJ (Textract)', 'Pessoa Jurídica', { service: 'SERVICE_OCR_CNPJ_CARD', image1: 'base64' }],
  ['SERVICE_REGISTRATION_DATA_CNPJ', 'Dados cadastrais de CNPJ (BigDataCorp)', 'Pessoa Jurídica', { service: 'SERVICE_REGISTRATION_DATA_CNPJ', cnpj: 'cnpj' }],
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
      responseSummary: serviceResponseSummary({ name, service, category }),
    });
  }

  return [...catalog, ...extras].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

const activeServiceApiAliases = new Set([
  'SERVICE_ACTIVITIES_INDICATORS',
  'SERVICE_ACTIVE_DEBT_PF_BIGDATACORP',
  'SERVICE_ACTIVE_DEBT_PJ_BIGDATACORP',
  'SERVICE_ADDRESSES_EXTENDED_CNPJ_BIGDATACORP',
  'SERVICE_ADDRESS_BIGDATACORP',
  'SERVICE_ARREST_WARRANT',
  'SERVICE_AWARDS_AND_CERTIFICATIONS_CPF',
  'SERVICE_COMPANY_KYC_OWNERS_BIGDATACORP',
  'SERVICE_COMPANY_RELATIONSHIP_BIGDATACORP',
  'SERVICE_COMPANY_RFB_OWNERS_BIGDATACORP',
  'SERVICE_COMPLIANCE_BET_PJ_BIGDATACORP',
  'SERVICE_COMPLIANCE_BET',
  'SERVICE_CONFIRM_PHONE_FACETEC',
  'SERVICE_CORPORATE_DATA_ENRICHMENT_BIGDATACORP',
  'SERVICE_CPF_ADDRESS_VALIDATION_BIGDATACORP',
  'SERVICE_CPF_PHONE_VALIDATION_BIGDATACORP',
  'SERVICE_CPF_PHONE_VALIDATION_FACETEC',
  'SERVICE_CRIMINAL_RECORD_CIVIL_BIGDATACORP',
  'SERVICE_CRIMINAL_RECORD_FEDERAL_BIGDATACORP',
  'SERVICE_CREDIT_RISK_COMPANY',
  'SERVICE_CREDIT_RISK_COMPANY_MURABEI',
  'SERVICE_CREDIT_SCORE',
  'SERVICE_DAS_MEI_INFOSIMPLES',
  'SERVICE_DATAVALID_CNH_SERPRO',
  'SERVICE_DEFAULT_RISK_SCORE_BIGDATACORP',
  'SERVICE_DEFAULT_RISK_SCORE_QUANTUM',
  'SERVICE_DEMOGRAPHIC_DATA_CPF',
  'SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX',
  'SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT_ACERTPIX',
  'SERVICE_DOMAINS_CNPJ',
  'SERVICE_DOMAINS_CPF',
  'SERVICE_ECONOMIC_RELATIONSHIP_BIGDATACORP',
  'SERVICE_ELECTION_CANDIDATE_DATA_CPF_BIGDATACORP',
  'SERVICE_ELECTORAL_DONORS_CNPJ_BIGDATACORP',
  'SERVICE_ELECTORAL_DONORS_CPF_BIGDATACORP',
  'SERVICE_ELECTORAL_PROVIDERS_CNPJ_BIGDATACORP',
  'SERVICE_ELECTORAL_PROVIDERS_CPF_BIGDATACORP',
  'SERVICE_EMAILS_EXTENDED_BIGDATACORP',
  'SERVICE_EMAIL_VALIDATION_BIGDATACORP',
  'SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION_BIGDATACORP',
  'SERVICE_FACE_INDEX',
  'SERVICE_FACE_MATCH_AWS',
  'SERVICE_FACE_MATCH_BIGDATACORP',
  'SERVICE_FAMILY_POLITICAL_HISTORY_CPF_BIGDATACORP',
  'SERVICE_FAMILY_SOCIAL_BENEFITS',
  'SERVICE_FINANCIAL_INFORMATION_BIGDATACORP',
  'SERVICE_FINANCIAL_RISK_SCORE_BIGDATACORP',
  'SERVICE_FIRST_LEVEL_PARTNER_BIGDATACORP',
  'SERVICE_FRAUD_RISK_SCORE_BIGDATACORP',
  'SERVICE_JURIDICAL_PROCESSES_BIGDATACORP',
  'SERVICE_JURIDICAL_PROCESSES_PJ',
  'SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS_BIGDATACORP',
  'SERVICE_LIVENESS_2D_FACETEC',
  'SERVICE_MEDIA_PROFILE_EXPOSURE_PF_BIGDATACORP',
  'SERVICE_MEDIA_PROFILE_EXPOSURE_PJ_BIGDATACORP',
  'SERVICE_MEI_BIGDATACORP',
  'SERVICE_NOTHING_RECORD_LAWSUITS_BIGDATACORP',
  'SERVICE_OCR',
  'SERVICE_OCR_BIGDATACORP',
  'SERVICE_OCR_CNPJ_CARD',
  'SERVICE_OCR_EMANCIPATION',
  'SERVICE_OCR_PROOF_OF_ADDRESS',
  'SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ_BIGDATACORP',
  'SERVICE_PEP',
  'SERVICE_PERSON_AI_PROMPT_OPENAI',
  'SERVICE_PERSON_DATA_ENRICHMENT_BIGDATACORP',
  'SERVICE_PERSON_DATA_MODELING_BIGDATACORP',
  'SERVICE_PERSON_KYC_BIGDATACORP',
  'SERVICE_PF_FINANCIAL_AND_ADDRESS_BIGDATACORP',
  'SERVICE_PHONE_HISTORY_BIGDATACORP',
  'SERVICE_PIS_CONSULTATION_BIGDATACORP',
  'SERVICE_POLITICAL_INVOLVEMENT_BIGDATACORP',
  'SERVICE_POLITICAL_INVOLVEMENT_CPF_BIGDATACORP',
  'SERVICE_PROFESSIONAL_HISTORY_BIGDATACORP',
  'SERVICE_PROFESSIONAL_HISTORY_OWNER_ONLY_BIGDATACORP',
  'SERVICE_PROTEST_CLEARANCE_CERTIFICATE_BIGDATACORP',
  'SERVICE_PROTEST_PF_INFOSIMPLES',
  'SERVICE_PROTEST_PF_NETRIN',
  'SERVICE_PROTEST_PJ_INFOSIMPLES',
  'SERVICE_PROTEST_PJ_NETRIN',
  'SERVICE_PUBLIC_SERVANTS_BIGDATACORP',
  'SERVICE_RELATED_PEOPLE_BIGDATACORP',
  'SERVICE_REGISTRATION_DATA_CNPJ',
  'SERVICE_RFB_PF_BIGDATACORP',
  'SERVICE_RFB_PF_ON_DEMAND_BIGDATACORP',
  'SERVICE_RFB_PJ_BIGDATACORP',
  'SERVICE_RFB_PJ_ON_DEMAND_BIGDATACORP',
  'SERVICE_SINTEGRA_CONSULTATION_BIGDATACORP',
  'SERVICE_SOCIAL_ASSISTANCE_EXTENDED',
  'SEVICE_ONLINE_BETTING_PROPENSITY_BIGDATACORP',
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
        body: { service: 'SERVICE_RFB_PF_BIGDATACORP', cpf: 'cpf', dataDeNascimento: 'yyyy-MM-dd (opcional)' },
      }),
    },
    {
      file: 'service-api-cpf.prod.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_RFB_PF_BIGDATACORP', cpf: 'cpf', dataDeNascimento: 'yyyy-MM-dd (opcional)' },
      }),
    },
    {
      file: 'service-api-cnpj.hml.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_RFB_PJ_BIGDATACORP', cnpj: 'cnpj' },
      }),
    },
    {
      file: 'service-api-cnpj.prod.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_RFB_PJ_BIGDATACORP', cnpj: 'cnpj' },
      }),
    },
    {
      file: 'facematch.hml.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_FACE_MATCH_BIGDATACORP', image1: 'base64', image2: 'base64' },
      }),
    },
    {
      file: 'documentoscopia.hml.curl',
      content: renderCurl({
        baseUrl: 'https://backoffice-hml.idcerberus.com',
        path: '/api/service-api',
        body: { service: 'SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX', key: '{key}', image1: 'base64', image2: 'base64', selfie1: 'base64' },
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
    lines.push(`- Retorno principal: ${service.responseSummary}`);
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
  pushServiceAliasNote(lines);

  let currentCategory = '';
  for (const service of catalog) {
    if (service.category !== currentCategory) {
      currentCategory = service.category;
      lines.push(`## ${currentCategory}`);
      lines.push('');
      lines.push('| Nome | Service | Campos principais | Retorno principal |');
      lines.push('| --- | --- | --- | --- |');
    }
    const fields = service.requestFields.length ? service.requestFields.map((field) => `\`${field}\``).join(', ') : '-';
    lines.push(`| [${service.name}](${service.documentationUrl}) | \`${service.service}\` | ${fields} | ${escapeTable(service.responseSummary)} |`);
  }

  lines.push('');
  lines.push('## Passo a passo por service');
  lines.push('');
  lines.push('Use esta parte quando precisar explicar para o cliente exatamente o que enviar e o que esperar de volta em cada produto.');
  lines.push('');

  currentCategory = '';
  for (const service of catalog) {
    if (service.category !== currentCategory) {
      if (currentCategory) {
        lines.push('</AccordionGroup>');
        lines.push('');
      }
      currentCategory = service.category;
      lines.push(`### ${currentCategory}`);
      lines.push('');
      lines.push('<AccordionGroup>');
    }

    lines.push(renderServiceGuideBlock(service));
    lines.push('');
  }

  if (currentCategory) {
    lines.push('</AccordionGroup>');
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
  SERVICE_ACTIVE_DEBT_PF_BIGDATACORP: {
    summary: 'Retorna dividas ativas vinculadas ao CPF, com origem do debito, valores, situacao, orgao credor e status da consulta.',
    result: { cpf: 'cpf', totalDebts: 2, totalValue: '1234.56', debts: [{ source: 'PGFN', value: '1234.56', status: 'ACTIVE' }] },
  },
  SERVICE_ACTIVE_DEBT_PJ_BIGDATACORP: {
    summary: 'Retorna dividas ativas vinculadas ao CNPJ, com origem do debito, valores, situacao, orgao credor e status da consulta.',
    result: { cnpj: 'cnpj', totalDebts: 1, totalValue: '9800.00', debts: [{ source: 'PGFN', value: '9800.00', status: 'ACTIVE' }] },
  },
  SERVICE_ACTIVITIES_INDICATORS: {
    summary: 'Retorna indicadores de atividades vinculadas ao CPF, como sinais profissionais, segmentos, ocupacoes e registros disponiveis.',
    result: { cpf: 'cpf', activityIndicators: [{ type: 'PROFESSIONAL', description: 'Indicador encontrado' }], hasActivityIndicators: true },
  },
  SERVICE_ADDRESS_BIGDATACORP: {
    summary: 'Retorna enderecos associados ao CPF, incluindo logradouro, numero, bairro, cidade, UF, CEP, pais, tipo e indicadores de atualidade quando disponiveis.',
    result: { cpf: 'cpf', totalAddresses: 2, addresses: [{ address: 'Rua Exemplo', number: '100', neighborhood: 'Centro', city: 'Sao Paulo', state: 'SP', zipcode: '01001000' }] },
  },
  SERVICE_ADDRESSES_EXTENDED_CNPJ_BIGDATACORP: {
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
  SERVICE_COMPANY_KYC_OWNERS_BIGDATACORP: {
    summary: 'Retorna checagens de KYC e compliance dos socios da empresa, incluindo PEP, sancoes, midia, risco e alertas encontrados por socio.',
    result: { cnpj: 'cnpj', ownersChecked: 2, owners: [{ name: 'Nome do socio', isPep: false, sanctions: [], riskAlerts: [] }] },
  },
  SERVICE_COMPANY_RELATIONSHIP_BIGDATACORP: {
    summary: 'Retorna relacionamentos da empresa, como socios, proprietarios, empresas relacionadas, participacoes e vinculos societarios identificados.',
    result: { cnpj: 'cnpj', owners: [{ name: 'Nome do socio', document: 'cpf', share: '50%' }], relatedCompanies: [] },
  },
  SERVICE_COMPANY_RFB_OWNERS_BIGDATACORP: {
    summary: 'Retorna o quadro societario na Receita Federal, com nome dos socios, documentos mascarados, qualificacao, participacao e data de entrada quando disponivel.',
    result: { cnpj: 'cnpj', owners: [{ name: 'Nome do socio', qualification: 'SOCIO-ADMINISTRADOR', entryDate: 'yyyy-MM-dd' }] },
  },
  SERVICE_COMPLIANCE_BET: {
    summary: 'Retorna indicadores de exposicao da empresa a apostas, bets e compliance regulatorio, incluindo sinais de operacao, dominio, atividade e alertas.',
    result: { cnpj: 'cnpj', hasBettingExposure: true, indicators: ['atividade relacionada'], riskLevel: 'MEDIUM' },
  },
  SERVICE_COMPLIANCE_BET_PJ_BIGDATACORP: {
    summary: 'Retorna indicadores de exposicao da empresa a apostas, bets e compliance regulatorio, incluindo sinais de operacao, dominio, atividade e alertas.',
    result: { cnpj: 'cnpj', hasBettingExposure: true, indicators: ['atividade relacionada'], riskLevel: 'MEDIUM' },
  },
  SERVICE_CONFIRM_PHONE_FACETEC: {
    summary: 'Retorna dados associados ao telefone informado, como possivel titular, documento relacionado, status de confirmacao e atributos disponiveis.',
    result: { phone: '+5561123456789', matched: true, person: { name: 'Nome encontrado', document: 'cpf' } },
  },
  SERVICE_CORPORATE_DATA_ENRICHMENT_BIGDATACORP: {
    summary: 'Retorna cadastro completo da empresa, incluindo razao social, nome fantasia, situacao cadastral, CNAEs, natureza juridica, porte, capital e endereco.',
    result: { cnpj: 'cnpj', officialName: 'EMPRESA EXEMPLO LTDA', tradeName: 'EMPRESA EXEMPLO', status: 'ATIVA', mainActivity: 'CNAE principal' },
  },
  SERVICE_CPF_ADDRESS_VALIDATION_BIGDATACORP: {
    summary: 'Retorna se o endereco informado tem associacao com o CPF, incluindo nivel de match, endereco normalizado e sinais usados na validacao.',
    result: { cpf: 'cpf', zipcode: '01001000', match: true, confidence: 'HIGH', normalizedAddress: 'Rua Exemplo, 100' },
  },
  SERVICE_CPF_PHONE_VALIDATION_BIGDATACORP: {
    summary: 'Retorna se o telefone informado tem associacao com o CPF, incluindo nivel de match, tipo de linha, status e sinais de validacao.',
    result: { cpf: 'cpf', phone: '11900000000', match: true, confidence: 'HIGH', lineType: 'MOBILE' },
  },
  SERVICE_CPF_PHONE_VALIDATION_FACETEC: {
    summary: 'Retorna validacao da associacao entre CPF e telefone, com status de match, mensagem da consulta e dados retornados pelo parceiro.',
    result: { cpf: 'cpf', phone: '11900000000', match: true, statusMessage: 'Telefone associado ao documento' },
  },
  SERVICE_CREDIT_RISK_COMPANY: {
    summary: 'Retorna dados publicos de risco de credito da empresa, como status, score, rating, risco esperado e processos legais quando disponiveis.',
    result: { cnpj: 'cnpj', creditRisk: { status: 'APPROVED', score: '750', rating: 'A', expectedDefault: 'LOW', legalProcess: false } },
  },
  SERVICE_CREDIT_RISK_COMPANY_MURABEI: {
    summary: 'Retorna dados de risco de credito PJ no fluxo Murabei, com score, rating, risco esperado e sinais juridicos quando disponiveis.',
    result: { cnpj: 'cnpj', creditRisk: { status: 'APPROVED', score: '720', rating: 'B', expectedDefault: 'MEDIUM', legalProcess: false } },
  },
  SERVICE_CREDIT_SCORE: {
    summary: 'Retorna score de credito associado ao CPF via Assertiva, com pontuacao, faixa de risco e mensagem da consulta quando disponiveis.',
    result: { cpf: 'cpf', score: 750, riskLevel: 'LOW', message: 'Score calculado com sucesso' },
  },
  SERVICE_CRIMINAL_RECORD_CIVIL_BIGDATACORP: {
    summary: 'Retorna resultado de antecedentes criminais civis, com status da certidao, ocorrencias encontradas, UF, RG e mensagens da consulta.',
    result: { cpf: 'cpf', rg: 'rg', state: 'SP', hasRecords: false, records: [] },
  },
  SERVICE_CRIMINAL_RECORD_FEDERAL_BIGDATACORP: {
    summary: 'Retorna resultado de antecedentes criminais federais, com status da certidao, ocorrencias encontradas e mensagens da consulta.',
    result: { cpf: 'cpf', hasFederalCriminalRecord: false, records: [] },
  },
  SERVICE_DAS_MEI_INFOSIMPLES: {
    summary: 'Retorna informacoes de DAS MEI e situacao fiscal relacionada ao CNPJ, incluindo periodos, pagamentos, pendencias e status quando disponiveis.',
    result: { cnpj: 'cnpj', meiStatus: 'ACTIVE', periods: [{ period: '2026-01', paid: true }] },
  },
  SERVICE_DATAVALID_CNH_SERPRO: {
    summary: 'Retorna validacao DataValid/Serpro da CNH, incluindo score biometrico, similaridade facial, status de validacao e campos conferidos.',
    result: { cpf: 'cpf', biometricScore: 0.98, validated: true, validationStatus: 'APPROVED' },
  },
  SERVICE_DEFAULT_RISK_SCORE_BIGDATACORP: {
    summary: 'Retorna score de inadimplencia do CPF, faixa de risco, probabilidade estimada e indicadores usados na avaliacao.',
    result: { cpf: 'cpf', score: 742, riskLevel: 'LOW', defaultProbability: '3%' },
  },
  SERVICE_DEFAULT_RISK_SCORE_QUANTUM: {
    summary: 'Retorna score de risco de inadimplencia Quantum para CPF, com pontuacao, faixa de risco e probabilidade estimada quando disponivel.',
    result: { cpf: 'cpf', score: 690, riskLevel: 'MEDIUM', defaultProbability: '8%' },
  },
  SERVICE_DEMOGRAPHIC_DATA_CPF: {
    summary: 'Retorna dados demograficos associados ao CPF, com dados regionais, estimativas e indicadores retornados pela base consultada.',
    result: { cpf: 'cpf', demographicData: [{ indicator: 'Faixa de renda', value: 'Media' }], totalIndicators: 1 },
  },
  SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX: {
    summary: 'Retorna status da documentoscopia, chave da consulta, dados extraidos do documento, validacoes de documento/selfie e resultado de aprovacao.',
    result: { key: '{key}', status: 'APPROVED', documentData: { name: 'Nome extraido', cpf: 'cpf' }, validations: [{ name: 'faceMatch', status: 'APPROVED' }] },
  },
  SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT_ACERTPIX: {
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
  SERVICE_ECONOMIC_RELATIONSHIP_BIGDATACORP: {
    summary: 'Retorna vinculos economicos associados ao CPF, como empresas relacionadas, participacoes, relacoes profissionais e indicadores de relacionamento.',
    result: { cpf: 'cpf', relationships: [{ type: 'OWNER', relatedDocument: 'cnpj', relatedName: 'Empresa relacionada' }] },
  },
  SERVICE_ELECTION_CANDIDATE_DATA_CPF_BIGDATACORP: {
    summary: 'Retorna historico de candidaturas eleitorais do CPF, incluindo cargo, partido, ano, unidade eleitoral, bens declarados e situacao quando disponivel.',
    result: { cpf: 'cpf', candidacies: [{ year: 2024, role: 'VEREADOR', party: 'PARTIDO', status: 'DEFERIDO' }] },
  },
  SERVICE_ELECTORAL_DONORS_CNPJ_BIGDATACORP: {
    summary: 'Retorna doacoes eleitorais realizadas pela empresa, com ano, candidato/partido, valor, cargo, UF e detalhes da prestacao de contas.',
    result: { cnpj: 'cnpj', donations: [{ year: 2024, recipient: 'Candidato', amount: '1000.00' }] },
  },
  SERVICE_ELECTORAL_DONORS_CPF_BIGDATACORP: {
    summary: 'Retorna doacoes eleitorais realizadas pelo CPF, com ano, candidato/partido, valor, cargo, UF e detalhes da prestacao de contas.',
    result: { cpf: 'cpf', donations: [{ year: 2024, recipient: 'Candidato', amount: '500.00' }] },
  },
  SERVICE_ELECTORAL_PROVIDERS_CNPJ_BIGDATACORP: {
    summary: 'Retorna prestacoes de servico eleitorais vinculadas ao CNPJ, com campanha, candidato/partido, valor, ano e natureza do servico.',
    result: { cnpj: 'cnpj', providers: [{ year: 2024, campaign: 'Campanha', amount: '2500.00', serviceType: 'Servico' }] },
  },
  SERVICE_ELECTORAL_PROVIDERS_CPF_BIGDATACORP: {
    summary: 'Retorna prestacoes de servico eleitorais vinculadas ao CPF, com campanha, candidato/partido, valor, ano e natureza do servico.',
    result: { cpf: 'cpf', providers: [{ year: 2024, campaign: 'Campanha', amount: '800.00', serviceType: 'Servico' }] },
  },
  SERVICE_EMAILS_EXTENDED_BIGDATACORP: {
    summary: 'Retorna e-mails associados ao CPF, incluindo prioridade, status de validacao, origem, data de atualizacao e sinais de uso quando disponiveis.',
    result: { cpf: 'cpf', emails: [{ email: 'email@exemplo.com', priority: 1, isValid: true, lastUpdate: 'yyyy-MM-dd' }] },
  },
  SERVICE_EMAIL_VALIDATION_BIGDATACORP: {
    summary: 'Retorna validacao do e-mail informado, incluindo formato, existencia provavel, dominio, entregabilidade e indicadores de risco.',
    result: { email: 'email@email.com', validFormat: true, deliverable: true, domain: 'email.com', riskLevel: 'LOW' },
  },
  SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION_BIGDATACORP: {
    summary: 'Retorna qualificacao cadastral no eSocial, com status de consistencia entre CPF, NIT/PIS e dados cadastrais informados.',
    result: { cpf: 'cpf', nit: 'nit', qualified: true, inconsistencies: [] },
  },
  SERVICE_FACE_MATCH_AWS: {
    summary: 'Retorna comparacao facial entre duas imagens, com score de similaridade, status do match e mensagem de aprovacao ou reprovacao.',
    result: { match: true, similarity: 98.2, status: 'APPROVED' },
  },
  SERVICE_FACE_MATCH_BIGDATACORP: {
    summary: 'Retorna comparacao facial entre duas imagens, com score de similaridade, status do match e mensagem de aprovacao ou reprovacao.',
    result: { match: true, similarity: 98.2, status: 'APPROVED' },
  },
  SERVICE_FACE_INDEX: {
    summary: 'Busca uma selfie na base de faces indexadas e retorna se encontrou face, CPF associado e similaridade quando disponiveis.',
    result: { cpf: 'cpf', faceFound: true, similarity: 98.42 },
  },
  SERVICE_FAMILY_POLITICAL_HISTORY_CPF_BIGDATACORP: {
    summary: 'Retorna historico politico familiar do CPF, incluindo familiares com candidaturas, doacoes, cargos, partidos e vinculos eleitorais quando encontrados.',
    result: { cpf: 'cpf', familyPoliticalHistory: [{ relativeName: 'Nome relacionado', relationship: 'PARENTE', role: 'Candidato' }] },
  },
  SERVICE_FAMILY_SOCIAL_BENEFITS: {
    summary: 'Retorna beneficios sociais familiares vinculados ao CPF, com programas, situacao, quantidade e registros encontrados quando disponiveis.',
    result: { cpf: 'cpf', totalBenefits: 1, benefits: [{ program: 'Programa social', status: 'ACTIVE' }] },
  },
  SERVICE_FINANCIAL_INFORMATION_BIGDATACORP: {
    summary: 'Retorna informacoes financeiras estimadas do CPF, como renda presumida, poder aquisitivo, classe economica e indicadores financeiros disponiveis.',
    result: { cpf: 'cpf', estimatedIncome: '5000-10000', purchasingPower: 'MEDIUM', financialIndicators: [] },
  },
  SERVICE_FINANCIAL_RISK_SCORE_BIGDATACORP: {
    summary: 'Retorna score de risco financeiro do CPF, faixa de risco, recomendacao resumida e fatores que influenciam a avaliacao.',
    result: { cpf: 'cpf', score: 681, riskLevel: 'MEDIUM', recommendation: 'REVIEW' },
  },
  SERVICE_FIRST_LEVEL_PARTNER_BIGDATACORP: {
    summary: 'Retorna socios de primeiro nivel da empresa, com nome, documento, participacao, qualificacao e vinculos diretos ao CNPJ.',
    result: { cnpj: 'cnpj', partners: [{ name: 'Nome do socio', document: 'cpf', level: 1, qualification: 'SOCIO' }] },
  },
  SERVICE_FRAUD_RISK_SCORE_BIGDATACORP: {
    summary: 'Retorna score de risco de fraude do CPF, fator analisado, nivel de risco, score numerico e sinais que suportam a decisao.',
    result: { cpf: 'cpf', factor: 'minRisk', score: 720, riskLevel: 'LOW', indicators: [] },
  },
  SERVICE_JURIDICAL_PROCESSES_BIGDATACORP: {
    summary: 'Retorna processos juridicos e administrativos vinculados ao CPF, com tribunal, classe, assunto, partes, status e datas quando disponiveis.',
    result: { cpf: 'cpf', totalProcesses: 1, processes: [{ court: 'TJSP', processNumber: '0000000-00.0000.0.00.0000', status: 'ACTIVE' }] },
  },
  SERVICE_JURIDICAL_PROCESSES_PJ: {
    summary: 'Retorna processos juridicos vinculados ao CNPJ, com tribunal, classe, assunto, partes, status, numero do processo e datas quando disponiveis.',
    result: { cnpj: 'cnpj', totalProcesses: 1, processes: [{ court: 'TJSP', processNumber: '0000000-00.0000.0.00.0000', status: 'ACTIVE' }] },
  },
  SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS_BIGDATACORP: {
    summary: 'Retorna processos juridicos associados aos socios da empresa, com socio relacionado, tribunal, classe, assunto, status e datas.',
    result: { cnpj: 'cnpj', ownersProcesses: [{ ownerName: 'Nome do socio', totalProcesses: 1, processes: [] }] },
  },
  SERVICE_LIVENESS_2D_FACETEC: {
    summary: 'Retorna resultado da prova de vida 2D, com status, score ou confianca da selfie e sinais de validacao contra fraude simples.',
    result: { liveness: true, confidence: 0.97, status: 'APPROVED' },
  },
  SERVICE_MEDIA_PROFILE_EXPOSURE_PF_BIGDATACORP: {
    summary: 'Retorna exposicao e perfil de midia da pessoa, com noticias, fontes, categorias, sentimento, relevancia e alertas encontrados.',
    result: { cpf: 'cpf', mediaMentions: [{ title: 'Noticia encontrada', source: 'Fonte', sentiment: 'NEUTRAL' }], exposureLevel: 'LOW' },
  },
  SERVICE_MEDIA_PROFILE_EXPOSURE_PJ_BIGDATACORP: {
    summary: 'Retorna exposicao e perfil de midia da empresa e socios, com noticias, fontes, categorias, sentimento, relevancia e alertas encontrados.',
    result: { cnpj: 'cnpj', mediaMentions: [{ title: 'Noticia encontrada', source: 'Fonte', sentiment: 'NEUTRAL' }], exposureLevel: 'LOW' },
  },
  SERVICE_MEI_BIGDATACORP: {
    summary: 'Retorna empresas MEI associadas ao CPF, incluindo CNPJ, razao social, situacao, atividades, endereco e datas cadastrais quando disponiveis.',
    result: { cpf: 'cpf', meiCompanies: [{ cnpj: 'cnpj', officialName: 'MEI EXEMPLO', status: 'ATIVA' }] },
  },
  SERVICE_NOTHING_RECORD_LAWSUITS_BIGDATACORP: {
    summary: 'Retorna certidao de nada consta para a esfera/tribunal informado, com status, mensagem, ocorrencias e dados usados na consulta.',
    result: { cpf: 'cpf', court: 'TRF1', sphere: 'CIVIL', nothingFound: true, records: [] },
  },
  SERVICE_OCR_BIGDATACORP: {
    summary: 'Retorna dados extraidos das imagens do documento, como tipo documental, nome, CPF, nascimento, filiacao, numero do documento e campos especificos.',
    result: { documentType: 'CNH', fields: { name: 'Nome extraido', cpf: 'cpf', birthDate: 'yyyy-MM-dd' }, extractionStatus: 'SUCCESS' },
  },
  SERVICE_OCR: {
    summary: 'Retorna dados extraidos de RG ou CNH enviados por imagem, como CPF, nome, filiacao, nascimento, orgao emissor e dados especificos do documento.',
    result: { cpf: 'cpf', docType: 'CNH', name: 'Nome extraido', birthDate: 'yyyy-MM-dd', cnhCategory: 'B', validDate: 'yyyy-MM-dd' },
  },
  SERVICE_OCR_CNPJ_CARD: {
    summary: 'Retorna dados extraidos do cartao CNPJ enviado por imagem, incluindo CNPJ, tipo do documento e texto OCR quando disponivel.',
    result: { cnpj: 'cnpj', docType: 'CNPJ_CARD', genericOcr: 'texto extraido do cartao CNPJ' },
  },
  SERVICE_OCR_EMANCIPATION: {
    summary: 'Retorna texto OCR do documento de emancipacao e dados objetivos extraidos quando existirem, sem reprovar pela ausencia de campos variaveis.',
    result: { docType: 'EMANCIPATION_DOCUMENT', genericOcr: 'texto extraido', extractedFields: { cpf: 'cpf', dates: ['yyyy-MM-dd'] }, analysis: { isEmancipationRelated: true, confidence: 'MEDIUM' } },
  },
  SERVICE_OCR_PROOF_OF_ADDRESS: {
    summary: 'Retorna dados extraidos do comprovante de endereco por Textract, como texto OCR, nome, endereco, tipo do documento, datas e valores quando encontrados.',
    result: { genericOcr: 'texto extraido', fullName: 'Nome extraido', fullAddress: 'Endereco extraido', docType: 'Conta de consumo', dueDate: 'yyyy-MM-dd', invoiceAmount: 'R$ 100,00' },
  },
  SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ_BIGDATACORP: {
    summary: 'Retorna doacoes eleitorais feitas pelos socios da empresa, com socio relacionado, ano, candidato/partido, valor e detalhes eleitorais.',
    result: { cnpj: 'cnpj', ownersDonations: [{ ownerName: 'Nome do socio', year: 2024, recipient: 'Candidato', amount: '300.00' }] },
  },
  SERVICE_PEP: {
    summary: 'Retorna se o CPF e PEP ou relacionado a PEP, com cargo, orgao, nivel de exposicao, periodo e vinculos encontrados quando disponiveis.',
    result: { cpf: 'cpf', isPep: false, pepLevel: null, positions: [] },
  },
  SERVICE_PERSON_AI_PROMPT_OPENAI: {
    summary: 'Retorna uma resposta textual consolidada por IA a partir dos dados da pessoa, com resumo, pontos de atencao e leitura operacional.',
    result: { cpf: 'cpf', answer: 'Resumo analitico gerado pela IA', highlights: ['ponto relevante'] },
  },
  SERVICE_PERSON_DATA_ENRICHMENT_BIGDATACORP: {
    summary: 'Retorna dados cadastrais do CPF, incluindo nome, nascimento, situacao cadastral, filiacao, obito, idade, genero e atributos disponiveis.',
    result: { cpf: 'cpf', name: 'Nome completo', birthDate: 'yyyy-MM-dd', registrationStatus: 'REGULAR', motherName: 'Nome da mae' },
  },
  SERVICE_PERSON_DATA_MODELING_BIGDATACORP: {
    summary: 'Retorna modelagem consolidada da pessoa, reunindo dados cadastrais, contatos, enderecos, vinculos, indicadores e resumos derivados.',
    result: { cpf: 'cpf', profileSummary: 'Resumo consolidado', contacts: [], addresses: [], relationships: [] },
  },
  SERVICE_PERSON_KYC_BIGDATACORP: {
    summary: 'Retorna checagem de KYC da pessoa, incluindo PEP, sancoes, midia, processos, alertas de compliance e sinais de risco.',
    result: { cpf: 'cpf', isPep: false, sanctions: [], mediaExposure: [], riskAlerts: [] },
  },
  SERVICE_PF_FINANCIAL_AND_ADDRESS_BIGDATACORP: {
    summary: 'Retorna dados financeiros e enderecos do CPF em uma consulta combinada, incluindo renda estimada, indicadores financeiros e enderecos encontrados.',
    result: { cpf: 'cpf', estimatedIncome: '5000-10000', addresses: [{ city: 'Sao Paulo', state: 'SP' }], financialIndicators: [] },
  },
  SERVICE_PHONE_HISTORY_BIGDATACORP: {
    summary: 'Retorna historico de telefones associados ao CPF, incluindo numero, tipo de linha, operadora, prioridade, status e recencia quando disponiveis.',
    result: { cpf: 'cpf', phones: [{ phone: '11900000000', lineType: 'MOBILE', priority: 1, lastUpdate: 'yyyy-MM-dd' }] },
  },
  SERVICE_PIS_CONSULTATION_BIGDATACORP: {
    summary: 'Retorna dados de PIS/NIS associados ao CPF, incluindo numero encontrado, status, dados cadastrais relacionados e mensagens da consulta.',
    result: { cpf: 'cpf', pis: '00000000000', status: 'FOUND' },
  },
  SERVICE_POLITICAL_INVOLVEMENT_BIGDATACORP: {
    summary: 'Retorna envolvimento politico do CPF, incluindo candidaturas, cargos, doacoes, prestacoes de servico, partidos e vinculos politicos.',
    result: { cpf: 'cpf', politicalInvolvement: [{ type: 'CANDIDACY', year: 2024, details: 'Candidatura encontrada' }] },
  },
  SERVICE_POLITICAL_INVOLVEMENT_CPF_BIGDATACORP: {
    summary: 'Retorna envolvimento politico do CPF, incluindo candidaturas, cargos, doacoes, prestacoes de servico, partidos e vinculos politicos.',
    result: { cpf: 'cpf', politicalInvolvement: [{ type: 'DONATION', year: 2024, details: 'Doacao encontrada' }] },
  },
  SERVICE_PROFESSIONAL_HISTORY_BIGDATACORP: {
    summary: 'Retorna historico profissional do CPF, incluindo empresas, cargos, datas, vinculos empregaticios ou societarios e indicadores profissionais.',
    result: { cpf: 'cpf', professionalHistory: [{ companyName: 'Empresa Exemplo', role: 'Analista', startDate: 'yyyy-MM-dd' }] },
  },
  SERVICE_PROFESSIONAL_HISTORY_OWNER_ONLY_BIGDATACORP: {
    summary: 'Retorna historico profissional em que a pessoa aparece como titular, socio ou proprietario, com empresas, cargos e datas de vinculo.',
    result: { cpf: 'cpf', ownerHistory: [{ companyName: 'Empresa Exemplo', cnpj: 'cnpj', qualification: 'SOCIO' }] },
  },
  SERVICE_PROTEST_CLEARANCE_CERTIFICATE_BIGDATACORP: {
    summary: 'Retorna certidao/consulta de protestos para CPF, com status de nada consta ou lista de protestos, cartorio, valor e datas.',
    result: { cpf: 'cpf', hasProtests: false, protests: [] },
  },
  SERVICE_PROTEST_PF_INFOSIMPLES: {
    summary: 'Retorna certidao/consulta de protestos para CPF via InfoSimples, com status, cartorios consultados, protestos e mensagens.',
    result: { cpf: 'cpf', hasProtests: false, notaryOffices: [], protests: [] },
  },
  SERVICE_PROTEST_PF_NETRIN: {
    summary: 'Retorna certidao/consulta de protestos para CPF via Netrin, com status, cartorios consultados, protestos e mensagens.',
    result: { cpf: 'cpf', hasProtests: false, notaryOffices: [], protests: [] },
  },
  SERVICE_PROTEST_PJ_INFOSIMPLES: {
    summary: 'Retorna certidao/consulta de protestos para CNPJ via InfoSimples, com status, cartorios consultados, protestos, valores e datas.',
    result: { cnpj: 'cnpj', hasProtests: false, notaryOffices: [], protests: [] },
  },
  SERVICE_PROTEST_PJ_NETRIN: {
    summary: 'Retorna certidao/consulta de protestos para CNPJ via Netrin, com status, cartorios consultados, protestos, valores e datas.',
    result: { cnpj: 'cnpj', hasProtests: false, notaryOffices: [], protests: [] },
  },
  SERVICE_PUBLIC_SERVANTS_BIGDATACORP: {
    summary: 'Retorna registros de servidor publico associados ao CPF, incluindo orgao, cargo, vinculo, remuneracao/faixa e periodo quando disponiveis.',
    result: { cpf: 'cpf', publicServantRecords: [{ agency: 'Orgao publico', role: 'Cargo', status: 'ACTIVE' }] },
  },
  SERVICE_RELATED_PEOPLE_BIGDATACORP: {
    summary: 'Retorna pessoas relacionadas ao CPF, com nome, documento mascarado, tipo de relacao, nivel de proximidade e origem do vinculo.',
    result: { cpf: 'cpf', relatedPeople: [{ name: 'Pessoa relacionada', relationshipType: 'FAMILIAR', confidence: 'HIGH' }] },
  },
  SERVICE_REGISTRATION_DATA_CNPJ: {
    summary: 'Retorna dados cadastrais do CNPJ, incluindo razao social, nome fantasia, situacao, abertura, CNAEs, natureza juridica e endereco quando disponiveis.',
    result: { cnpj: 'cnpj', officialName: 'EMPRESA EXEMPLO LTDA', tradeName: 'EMPRESA EXEMPLO', status: 'ATIVA', openingDate: 'yyyy-MM-dd' },
  },
  SERVICE_RFB_PF_BIGDATACORP: {
    summary: 'Retorna situacao do CPF na Receita Federal, incluindo nome, nascimento, status cadastral, comprovante/protocolo e dados fiscais disponiveis.',
    result: { cpf: 'cpf', name: 'Nome completo', birthDate: 'yyyy-MM-dd', registrationStatus: 'REGULAR', protocol: 'protocolo' },
  },
  SERVICE_RFB_PF_ON_DEMAND_BIGDATACORP: {
    summary: 'Retorna situacao atualizada do CPF consultada sob demanda na Receita Federal, com nome, nascimento, status cadastral e protocolo.',
    result: { cpf: 'cpf', name: 'Nome completo', birthDate: 'yyyy-MM-dd', registrationStatus: 'REGULAR', protocol: 'protocolo' },
  },
  SERVICE_RFB_PJ_BIGDATACORP: {
    summary: 'Retorna situacao do CNPJ na Receita Federal, incluindo razao social, nome fantasia, situacao cadastral, abertura, CNAEs e endereco.',
    result: { cnpj: 'cnpj', officialName: 'EMPRESA EXEMPLO LTDA', status: 'ATIVA', openingDate: 'yyyy-MM-dd', mainActivity: 'CNAE principal' },
  },
  SERVICE_RFB_PJ_ON_DEMAND_BIGDATACORP: {
    summary: 'Retorna situacao atualizada do CNPJ consultada sob demanda na Receita Federal, com razao social, status cadastral, CNAEs e endereco.',
    result: { cnpj: 'cnpj', officialName: 'EMPRESA EXEMPLO LTDA', status: 'ATIVA', openingDate: 'yyyy-MM-dd', mainActivity: 'CNAE principal' },
  },
  SERVICE_SINTEGRA_CONSULTATION_BIGDATACORP: {
    summary: 'Retorna dados do SINTEGRA, incluindo inscricao estadual, UF, situacao, regime, atividades, endereco e mensagens da consulta.',
    result: { cnpj: 'cnpj', stateRegistration: '000000000', state: 'SP', status: 'HABILITADO', regime: 'NORMAL' },
  },
  SERVICE_SOCIAL_ASSISTANCE_EXTENDED: {
    summary: 'Retorna beneficios sociais estendidos vinculados ao CPF, com programas, indicadores, situacao e detalhes encontrados quando disponiveis.',
    result: { cpf: 'cpf', totalBenefits: 1, benefits: [{ program: 'Programa social', status: 'ACTIVE' }], indicators: [] },
  },
  SEVICE_ONLINE_BETTING_PROPENSITY_BIGDATACORP: {
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
  if (service.service === 'SERVICE_OCR_BIGDATACORP' && ['image2', 'image1url', 'image2url'].includes(normalizedName)) return true;

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
  SERVICE_OCR_BIGDATACORP: {
    minimumPayload: { service: 'SERVICE_OCR_BIGDATACORP', image1: 'BASE64_DA_FRENTE_DO_DOCUMENTO' },
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
  lines.push('Para payloads prontos, qualidade de imagem e diagnóstico de erro, consulte [OCR via Service API](/guides/service-api/ocr-service-api).');
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
  if (field === 'factor') return 'Fator de risco solicitado pelo parceiro, como risco minimo ou atrito minimo.';
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

function renderServiceGuideBlock(service) {
  const body = jsonBodyFromRequestExample(service.requestExample);
  const fields = fieldRowsFromService(service);
  const requiredFields = fields.filter((field) => field.required && field.name !== 'service').map((field) => `\`${field.name}\``);
  const resultKeys = Object.keys(serviceResponseExample(service).result);
  const lines = [];

  lines.push(`<Accordion title="${escapeAttribute(service.name)}">`);
  lines.push('');
  lines.push(`**Service:** \`${service.service}\``);
  lines.push('');
  lines.push(`**Quando usar:** ${serviceUseCase(service)}`);
  lines.push('');
  lines.push(`**O que retorna:** ${service.responseSummary}`);
  lines.push('');
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
  lines.push(JSON.stringify({ service: 'SERVICE_RFB_PF_BIGDATACORP', cpf: 'cpf' }, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</Step>');
  lines.push('<Step title="Execute a consulta">');
  lines.push('');
  lines.push('```bash');
  lines.push(renderCurl({
    baseUrl: 'https://backoffice-hml.idcerberus.com',
    path: '/api/service-api',
    body: { service: 'SERVICE_RFB_PF_BIGDATACORP', cpf: 'cpf' },
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
  pushServiceAliasNote(lines, {
    includeDocumentPayloadNote: category === 'Pessoa Física',
    rows: category === 'Pessoa Jurídica' ? serviceAliasRowsPessoaJuridica : serviceAliasRowsPessoaFisica,
  });
  lines.push('## Como ler esta referência');
  lines.push('');
  lines.push('- **Nome**: nome funcional do produto.');
  lines.push('- **Service**: valor exato que deve ser enviado no campo `service`.');
  lines.push('- **Alias de chamada**: quando o produto estiver configurado com alias curto, envie esse alias no body, mesmo que o nome documentado do parceiro seja outro.');
  lines.push('- **Família**: agrupamento por objetivo de uso, como dados cadastrais, risco, jurídico ou biometria.');
  lines.push('- **Campos**: parâmetros esperados no body além de `service`.');
  lines.push('- **Retorno principal**: resumo dos dados esperados no objeto `result` para aquele service.');
  lines.push('- **Exemplos**: cada item traz body JSON, curl de homologação, curl de produção e response resumido.');
  lines.push('');
  lines.push('## Índice por família');
  lines.push('');

  for (const [family, services] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### ${family}`);
    lines.push('');
    lines.push('| Nome | Service | Campos | Quando usar | Retorno principal |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const service of services.sort((a, b) => a.name.localeCompare(b.name))) {
      const fields = service.requestFields.length ? service.requestFields.map((field) => `\`${field}\``).join(', ') : '-';
      lines.push(`| ${escapeTable(service.name)} | \`${service.service}\` | ${fields} | ${escapeTable(serviceUseCase(service))} | ${escapeTable(service.responseSummary)} |`);
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
const servicesCatalog = filterActiveServiceApiServices(mergePartnerApiServices(buildServicesCatalog(openApiSummary.services)));
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
llmsLines.push('- Documentação publicada: `https://api-docs.idcerberus.com/`');
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


