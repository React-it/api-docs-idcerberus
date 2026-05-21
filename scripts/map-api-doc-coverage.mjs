import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const onboardingApiDir = 'C:/dev/onboarding/src/main/java/com/reactit/onboarding/service/events/api';
const outputPath = path.join(root, 'mapeamento-api-implementada-vs-doc.txt');
const llmsApiRealPath = path.join(root, 'llms-api-real.txt');

const publicAliasMap = new Map(Object.entries({
  SERVICE_PERSON_DATA_ENRICHMENT_BIGDATACORP: 'service_person_data_enrichment',
  SERVICE_RFB_PF_BIGDATACORP: 'service_rfb_pf',
  SERVICE_OCR_BIGDATACORP: 'service_ocr',
  SERVICE_FACE_MATCH_BIGDATACORP: 'service_face_match',
  SERVICE_DEFAULT_RISK_SCORE_BIGDATACORP: 'service_default_risk_score',
  SERVICE_FRAUD_RISK_SCORE_BIGDATACORP: 'service_fraud_risk_score',
  SERVICE_CRIMINAL_RECORD_CIVIL_BIGDATACORP: 'service_criminal_record_civil',
  SERVICE_CRIMINAL_RECORD_FEDERAL_BIGDATACORP: 'service_criminal_record_federal',
  SERVICE_ACTIVE_DEBT_PF_BIGDATACORP: 'SERVICE_ACTIVE_DEBT_PF',
  SERVICE_ACTIVE_DEBT_PJ_BIGDATACORP: 'SERVICE_ACTIVE_DEBT_PJ',
  SERVICE_FINANCIAL_INFORMATION_BIGDATACORP: 'service_financial_information',
  SERVICE_CPF_ADDRESS_VALIDATION_BIGDATACORP: 'service_cpf_address_validation',
  SERVICE_CPF_PHONE_VALIDATION_BIGDATACORP: 'service_cpf_phone_validation',
  SERVICE_FIRST_LEVEL_PARTNER_BIGDATACORP: 'service_first_level_partner',
  SERVICE_EMAIL_VALIDATION_BIGDATACORP: 'service_email_validation',
  SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION_BIGDATACORP: 'service_esocial_registration_qualification',
  SERVICE_PIS_CONSULTATION_BIGDATACORP: 'service_pis_consultation',
  SERVICE_SINTEGRA_CONSULTATION_BIGDATACORP: 'service_sintegra_consultation',
  SERVICE_RELATED_PEOPLE_BIGDATACORP: 'SERVICE_RELATED_PEOPLE',
  SERVICE_PHONE_HISTORY_BIGDATACORP: 'SERVICE_PHONE_HISTORY',
  SERVICE_COMPANY_RELATIONSHIP_BIGDATACORP: 'service_company_relationship',
  SERVICE_POLITICAL_INVOLVEMENT_BIGDATACORP: 'SERVICE_POLITICAL_INVOLVEMENT',
  SERVICE_POLITICAL_INVOLVEMENT_CPF_BIGDATACORP: 'SERVICE_POLITICAL_INVOLVEMENT',
  SERVICE_ELECTORAL_DONORS_CNPJ_BIGDATACORP: 'SERVICE_ELECTORAL_DONORS_CNPJ',
  SERVICE_ELECTORAL_DONORS_CPF_BIGDATACORP: 'SERVICE_ELECTORAL_DONORS_CPF',
  SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ_BIGDATACORP: 'SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ',
  SERVICE_ELECTORAL_PROVIDERS_CNPJ_BIGDATACORP: 'SERVICE_ELECTORAL_PROVIDERS_CNPJ',
  SERVICE_ELECTORAL_PROVIDERS_CPF_BIGDATACORP: 'SERVICE_ELECTORAL_PROVIDERS_CPF',
  SERVICE_MEI_BIGDATACORP: 'service_mei',
  SERVICE_JURIDICAL_PROCESSES_BIGDATACORP: 'service_juridical_processes',
  SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS_BIGDATACORP: 'service_juridical_processes_pj_owners',
  SERVICE_ADDRESS_BIGDATACORP: 'service_address',
  SERVICE_ADDRESSES_EXTENDED_CNPJ_BIGDATACORP: 'SERVICE_ADDRESSES_EXTENDED_CNPJ',
  SERVICE_PROFESSIONAL_HISTORY_BIGDATACORP: 'service_professional_history',
  SERVICE_PUBLIC_SERVANTS_BIGDATACORP: 'service_public_servants',
  SERVICE_ECONOMIC_RELATIONSHIP_BIGDATACORP: 'economic_relationships',
  SERVICE_COMPANY_KYC_OWNERS_BIGDATACORP: 'service_company_kyc_owners',
  SERVICE_PERSON_KYC_BIGDATACORP: 'SERVICE_PERSON_KYC_BIGDATACORP',
  SERVICE_NOTHING_RECORD_LAWSUITS_BIGDATACORP: 'service_nothing_record_lawsuits',
  SERVICE_MEDIA_PROFILE_EXPOSURE_PF_BIGDATACORP: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PF',
  SERVICE_MEDIA_PROFILE_EXPOSURE_PJ_BIGDATACORP: 'SERVICE_MEDIA_PROFILE_EXPOSURE_PJ',
  SERVICE_COMPLIANCE_BET_PJ_BIGDATACORP: 'SERVICE_COMPLIANCE_BET_PJ',
  SERVICE_CORPORATE_DATA_ENRICHMENT_BIGDATACORP: 'service_corporate_data_enrichment',
  SERVICE_RFB_PJ_BIGDATACORP: 'service_rfb_pj',
  SERVICE_COMPANY_RFB_OWNERS_BIGDATACORP: 'SERVICE_COMPANY_RFB_OWNERS',
  SERVICE_ELECTION_CANDIDATE_DATA_CPF_BIGDATACORP: 'SERVICE_ELECTION_CANDIDATE_DATA',
  SERVICE_FAMILY_POLITICAL_HISTORY_CPF_BIGDATACORP: 'SERVICE_FAMILY_POLITICAL_HISTORY',
  SERVICE_PROTEST_CLEARANCE_CERTIFICATE_BIGDATACORP: 'service_protest_clearance_certificate',
  SERVICE_DAS_MEI_INFOSIMPLES: 'service_das_mei',
  SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX: 'service_digital_documentoscopy',
  SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT_ACERTPIX: 'service_digital_documentoscopy_consult',
  SERVICE_FACE_MATCH_AWS: 'service_face_match',
  SERVICE_LIVENESS_2D_FACETEC: 'service_liveness_2d',
  SERVICE_CPF_PHONE_VALIDATION_FACETEC: 'service_cpf_phone_validation',
  SERVICE_CONFIRM_PHONE_FACETEC: 'SERVICE_CONFIRM_PHONE',
  SERVICE_PROTEST_PF_INFOSIMPLES: 'service_protest_clearance_certificate',
  SERVICE_PROTEST_PF_NETRIN: 'service_protest_clearance_certificate',
  SERVICE_PROTEST_PJ_INFOSIMPLES: 'service_protest_clearance_certificate_pj',
  SERVICE_PROTEST_PJ_NETRIN: 'service_protest_clearance_certificate_pj',
  SERVICE_PEP: 'service_pep',
}));

const nameMap = new Map(Object.entries({
  SERVICE_PERSON_DATA_ENRICHMENT_BIGDATACORP: 'Enriquecimento de dados de Pessoa Física',
  SERVICE_PERSON_DATA_MODELING_BIGDATACORP: 'Modelagem de dados de Pessoa Física',
  SERVICE_RFB_PF_BIGDATACORP: 'Consulta do CPF na Receita Federal',
  SERVICE_RFB_PF_ON_DEMAND_BIGDATACORP: 'Consulta on-demand do CPF na Receita Federal',
  SERVICE_EMAILS_EXTENDED_BIGDATACORP: 'Consulta de histórico de e-mails',
  SERVICE_CORPORATE_DATA_ENRICHMENT_BIGDATACORP: 'Enriquecimento de dados de Pessoa Jurídica',
  SERVICE_COMPLIANCE_BET_PJ_BIGDATACORP: 'Compliance de casas de apostas PJ',
  SERVICE_RFB_PJ_BIGDATACORP: 'Consulta do CNPJ na Receita Federal',
  SERVICE_RFB_PJ_ON_DEMAND_BIGDATACORP: 'Consulta on-demand do CNPJ na Receita Federal',
  SERVICE_COMPANY_RFB_OWNERS_BIGDATACORP: 'Consulta de sócios na Receita Federal',
  SERVICE_ELECTION_CANDIDATE_DATA_CPF_BIGDATACORP: 'Consulta de dados eleitorais de candidato',
  SERVICE_FAMILY_POLITICAL_HISTORY_CPF_BIGDATACORP: 'Consulta de histórico político familiar PF',
  SERVICE_OCR_BIGDATACORP: 'OCR de documentos',
  SERVICE_FACE_MATCH_BIGDATACORP: 'Comparação facial',
  SERVICE_DEFAULT_RISK_SCORE_BIGDATACORP: 'Score de inadimplência',
  SERVICE_FRAUD_RISK_SCORE_BIGDATACORP: 'Score de risco de fraude',
  SERVICE_FINANCIAL_RISK_SCORE_BIGDATACORP: 'Risco financeiro',
  SERVICE_CRIMINAL_RECORD_CIVIL_BIGDATACORP: 'Certidão de antecedentes criminais civil',
  SERVICE_CRIMINAL_RECORD_FEDERAL_BIGDATACORP: 'Certidão de antecedentes criminais federal',
  SERVICE_ACTIVE_DEBT_PF_BIGDATACORP: 'Débitos ativos PF',
  SERVICE_ACTIVE_DEBT_PJ_BIGDATACORP: 'Débitos ativos PJ',
  SERVICE_FINANCIAL_INFORMATION_BIGDATACORP: 'Consulta de informações financeiras',
  SERVICE_CPF_ADDRESS_VALIDATION_BIGDATACORP: 'Validação de CPF com endereço',
  SERVICE_CPF_PHONE_VALIDATION_BIGDATACORP: 'Validação de CPF com telefone',
  SERVICE_FIRST_LEVEL_PARTNER_BIGDATACORP: 'Sócios de primeiro nível',
  SERVICE_EMAIL_VALIDATION_BIGDATACORP: 'Validação de e-mail',
  SERVICE_ESOCIAL_REGISTRATION_QUALIFICATION_BIGDATACORP: 'Qualificação cadastral no E-Social',
  SERVICE_PIS_CONSULTATION_BIGDATACORP: 'Consulta do PIS',
  SERVICE_SINTEGRA_CONSULTATION_BIGDATACORP: 'Consulta do SINTEGRA',
  SERVICE_RELATED_PEOPLE_BIGDATACORP: 'Consulta de pessoas relacionadas',
  SERVICE_PHONE_HISTORY_BIGDATACORP: 'Consulta de histórico de telefones',
  SERVICE_COMPANY_RELATIONSHIP_BIGDATACORP: 'Consulta de relacionamentos de empresa',
  SERVICE_POLITICAL_INVOLVEMENT_BIGDATACORP: 'Consulta de envolvimento político',
  SERVICE_POLITICAL_INVOLVEMENT_CPF_BIGDATACORP: 'Consulta de envolvimento político PF',
  SERVICE_ELECTORAL_DONORS_CNPJ_BIGDATACORP: 'Consulta de doações eleitorais PJ',
  SERVICE_ELECTORAL_DONORS_CPF_BIGDATACORP: 'Consulta de doações eleitorais PF',
  SERVICE_OWNERS_ELECTORAL_DONORS_CNPJ_BIGDATACORP: 'Consulta de doações eleitorais dos sócios',
  SERVICE_ELECTORAL_PROVIDERS_CNPJ_BIGDATACORP: 'Consulta de fornecedores eleitorais PJ',
  SERVICE_ELECTORAL_PROVIDERS_CPF_BIGDATACORP: 'Consulta de prestadores de serviços eleitorais PF',
  SERVICE_MEI_BIGDATACORP: 'Consulta de MEI',
  SERVICE_JURIDICAL_PROCESSES_BIGDATACORP: 'Consulta de processos jurídicos',
  SERVICE_JURIDICAL_PROCESSES_PJ_OWNERS_BIGDATACORP: 'Consulta de processos jurídicos dos sócios',
  SERVICE_ADDRESS_BIGDATACORP: 'Consulta de endereços',
  SERVICE_ADDRESSES_EXTENDED_CNPJ_BIGDATACORP: 'Endereços estendidos de empresa',
  SERVICE_PF_FINANCIAL_AND_ADDRESS_BIGDATACORP: 'Dados financeiros e endereços PF',
  SERVICE_PROFESSIONAL_HISTORY_BIGDATACORP: 'Histórico profissional',
  SERVICE_PROFESSIONAL_HISTORY_OWNER_ONLY_BIGDATACORP: 'Histórico profissional do titular',
  SERVICE_PROTEST_CLEARANCE_CERTIFICATE_BIGDATACORP: 'Certidão negativa de protesto',
  SERVICE_PUBLIC_SERVANTS_BIGDATACORP: 'Consulta de servidores públicos',
  SERVICE_ECONOMIC_RELATIONSHIP_BIGDATACORP: 'Relacionamentos econômicos',
  SERVICE_COMPANY_KYC_OWNERS_BIGDATACORP: 'KYC e compliance dos sócios',
  SERVICE_PERSON_KYC_BIGDATACORP: 'KYC e compliance de pessoa física',
  SERVICE_NOTHING_RECORD_LAWSUITS_BIGDATACORP: 'Nada consta em ações judiciais',
  SERVICE_MEDIA_PROFILE_EXPOSURE_PF_BIGDATACORP: 'Exposição e perfil na mídia PF',
  SERVICE_MEDIA_PROFILE_EXPOSURE_PJ_BIGDATACORP: 'Exposição e perfil na mídia PJ',
  SERVICE_DAS_MEI_INFOSIMPLES: 'Consulta de DAS MEI',
  SERVICE_PROTEST_PF_INFOSIMPLES: 'Certidão negativa de protesto PF',
  SERVICE_PROTEST_PF_NETRIN: 'Certidão negativa de protesto PF',
  SERVICE_PROTEST_PJ_INFOSIMPLES: 'Certidão negativa de protesto PJ',
  SERVICE_PROTEST_PJ_NETRIN: 'Certidão negativa de protesto PJ',
  SERVICE_ARREST_WARRANT: 'Consulta de mandado de prisão',
  SERVICE_PERSON_AI_PROMPT_OPENAI: 'Prompt de IA para pessoa',
  SERVICE_FACE_MATCH_AWS: 'Comparação facial AWS',
  SERVICE_DIGITAL_DOCUMENTOSCOPY_ACERTPIX: 'Documentoscopia digital Acertpix',
  SERVICE_DIGITAL_DOCUMENTOSCOPY_CONSULT_ACERTPIX: 'Consulta da documentoscopia digital Acertpix',
  SERVICE_LIVENESS_2D_FACETEC: 'Liveness 2D Facetec',
  SERVICE_CPF_PHONE_VALIDATION_FACETEC: 'Validação de CPF com telefone Facetec',
  SERVICE_CONFIRM_PHONE_FACETEC: 'Confirmação de telefone Facetec',
  SERVICE_DATAVALID_CNH_SERPRO: 'Validação de dados de CNH no DataValid',
  SEVICE_ONLINE_BETTING_PROPENSITY_BIGDATACORP: 'Propensão a apostas online',
  SERVICE_PEP: 'Consulta PEP',
}));

const configuredButNotApiListener = [
  {
    name: 'Prêmios e certificações - Pessoa',
    publicAlias: 'SERVICE_AWARDS_AND_CERTIFICATIONS_CPF',
    partnerAlias: 'SERVICE_AWARDS_AND_CERTIFICATIONS_CPF_BIGDATACORP',
    note: 'Tem configuração em changelog com service_product/api, mas o listener encontrado está em events/onboarding com ServiceEventDTO.',
  },
  {
    name: 'Dados de registro - Empresa',
    publicAlias: 'SERVICE_REGISTRATION_DATA_CNPJ',
    partnerAlias: 'SERVICE_REGISTRATION_DATA_CNPJ_BIGDATACORP',
    note: 'Tem configuração em changelog com service_product/api, mas o listener encontrado está em events/onboarding com ServiceEventDTO.',
  },
  {
    name: 'Dados de sites - Pessoa',
    publicAlias: 'SERVICE_DOMAINS_CPF',
    partnerAlias: 'SERVICE_DOMAINS_CPF_BIGDATACORP',
    note: 'Já está na doc, mas o listener encontrado está em events/onboarding com ServiceEventDTO, não em events/api com ServiceApiEventDTO.',
  },
  {
    name: 'Dados de sites - Empresa',
    publicAlias: 'SERVICE_DOMAINS_CNPJ',
    partnerAlias: 'SERVICE_DOMAINS_CNPJ_BIGDATACORP',
    note: 'Já está na doc, mas o listener encontrado está em events/onboarding com ServiceEventDTO, não em events/api com ServiceApiEventDTO.',
  },
  {
    name: 'Informações socio-demográficas',
    publicAlias: 'SERVICE_DEMOGRAPHIC_DATA_CPF',
    partnerAlias: 'SERVICE_DEMOGRAPHIC_DATA_CPF_BIGDATACORP',
    note: 'Já está na doc, mas o listener encontrado está em events/onboarding com ServiceEventDTO, não em events/api com ServiceApiEventDTO.',
  },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(filePath, files);
    else files.push(filePath);
  }
  return files;
}

function documentedAliases() {
  const docsRoots = ['api-reference', 'guides'];
  const content = docsRoots
    .flatMap((dir) => walk(path.join(root, dir)))
    .filter((file) => /\.(mdx|json)$/i.test(file))
    .filter((file) => !file.includes(`${path.sep}cobertura-de-services.mdx`))
    .filter((file) => !file.includes(`${path.sep}cobertura-da-referencia.mdx`))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');

  const aliases = new Set();
  const regex = /\b(?:SERVICE_[A-Z0-9_]+|SEVICE_[A-Z0-9_]+|service_[a-z0-9_]+|economic_relationships)\b/g;
  for (const match of content.matchAll(regex)) aliases.add(match[0].toUpperCase());
  return aliases;
}

function publicCandidates(alias) {
  const candidates = new Set([alias]);
  if (publicAliasMap.has(alias)) candidates.add(publicAliasMap.get(alias));
  if (alias.endsWith('_BIGDATACORP')) candidates.add(alias.replace(/_BIGDATACORP$/, ''));
  candidates.add(alias.toLowerCase());
  return [...candidates];
}

const docsAliases = documentedAliases();
const apiAliases = new Map();

for (const file of walk(onboardingApiDir)) {
  if (!file.endsWith('.java')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const regex = /@EventListener\(condition\s*=\s*"[^"]*serviceAliasPartner eq '([^']+)'/g;
  for (const match of content.matchAll(regex)) {
    const alias = match[1];
    if (!apiAliases.has(alias)) {
      apiAliases.set(alias, { alias, file: path.basename(file), name: nameMap.get(alias) || alias });
    }
  }
}

const items = [...apiAliases.values()].sort((a, b) => a.alias.localeCompare(b.alias));
const inDoc = [];
const missing = [];

for (const item of items) {
  const candidates = publicCandidates(item.alias);
  const documentedAlias = candidates.find((candidate) => docsAliases.has(candidate.toUpperCase()));
  const enriched = { ...item, documentedAlias: documentedAlias || '' };
  if (documentedAlias) inDoc.push(enriched);
  else missing.push(enriched);
}

const lines = [];
lines.push('MAPEAMENTO - SERVIÇOS IMPLEMENTADOS VIA API VS DOCUMENTAÇÃO');
lines.push('');
lines.push('Critério usado:');
lines.push('- Fonte do código: C:\\dev\\onboarding\\src\\main\\java\\com\\reactit\\onboarding\\service\\events\\api.');
lines.push('- Foram considerados apenas listeners de API com `serviceAliasPartner` implementado em código.');
lines.push('- Itens encontrados somente em CSV antigo, cadastro de produto, SDK ou backoffice não entram neste arquivo.');
lines.push('- Quando o código usa alias de parceiro, o cruzamento também considera o alias público documentado.');
lines.push('');
lines.push(`Total implementado via API no código: ${items.length}`);
lines.push(`Já está na doc: ${inDoc.length}`);
lines.push(`Não está na doc: ${missing.length}`);
lines.push('');
lines.push('============================================================');
lines.push('JÁ ESTÁ NA DOC');
lines.push('============================================================');
lines.push('');
for (const item of inDoc) {
  const suffix = item.documentedAlias !== item.alias ? ` | alias documentado: ${item.documentedAlias}` : '';
  lines.push(`- ${item.name} - ${item.alias}${suffix} | fonte: ${item.file}`);
}
lines.push('');
lines.push('============================================================');
lines.push('NÃO ESTÁ NA DOC');
lines.push('============================================================');
lines.push('');
for (const item of missing) {
  lines.push(`- ${item.name} - ${item.alias} | fonte: ${item.file}`);
}
lines.push('');
lines.push('============================================================');
lines.push('CONFIGURADO COMO API, MAS SEM LISTENER DE API CONFIRMADO');
lines.push('============================================================');
lines.push('');
lines.push('Itens abaixo aparecem em changelog/configuração como API, mas a implementação encontrada está no fluxo de onboarding (`ServiceEventDTO`) e não no listener consumido por `POST /api/service-api` (`ServiceApiEventDTO`). Não tratei como pendência de documentação de API até alguém confirmar o comportamento.');
lines.push('');
for (const item of configuredButNotApiListener) {
  lines.push(`- ${item.name} - ${item.publicAlias} | parceiro: ${item.partnerAlias} | ${item.note}`);
}

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
const llmLines = [];
llmLines.push('# idCerberus - serviços confirmados via API');
llmLines.push('');
llmLines.push('Este arquivo lista apenas serviços encontrados em listeners de API no backend.');
llmLines.push('Critério: `ServiceApiEventDTO` em `src/main/java/com/reactit/onboarding/service/events/api`.');
llmLines.push('Não inclui itens encontrados somente em CSV antigo, SDK, backoffice ou fluxos de onboarding.');
llmLines.push('');
llmLines.push('## Regras para LLM');
llmLines.push('');
llmLines.push('- Use `POST /api/service-api` para executar estes serviços.');
llmLines.push('- O campo `service` deve usar o alias documentado quando existir.');
llmLines.push('- Não invente serviços fora desta lista sem confirmação no código.');
llmLines.push('- `SEVICE_ONLINE_BETTING_PROPENSITY_BIGDATACORP` está escrito sem a letra `R` em `SERVICE` porque esse é o alias implementado no backend.');
llmLines.push('');
llmLines.push('## Resumo');
llmLines.push('');
llmLines.push(`- Total implementado via API no código: ${items.length}`);
llmLines.push(`- Já está na doc: ${inDoc.length}`);
llmLines.push(`- Não está na doc: ${missing.length}`);
llmLines.push('');
llmLines.push('## Serviços disponíveis');
llmLines.push('');
llmLines.push('| Nome | Alias implementado | Alias documentado | Fonte |');
llmLines.push('| --- | --- | --- | --- |');
for (const item of inDoc) {
  llmLines.push(`| ${item.name} | \`${item.alias}\` | \`${item.documentedAlias || item.alias}\` | ${item.file} |`);
}
if (missing.length) {
  llmLines.push('');
  llmLines.push('## Implementado, mas ainda não documentado');
  llmLines.push('');
  for (const item of missing) llmLines.push(`- ${item.name}: \`${item.alias}\` (${item.file})`);
}
llmLines.push('');
llmLines.push('## Configurado como API, mas sem listener de API confirmado');
llmLines.push('');
for (const item of configuredButNotApiListener) {
  llmLines.push(`- ${item.name}: \`${item.publicAlias}\` | parceiro \`${item.partnerAlias}\` | ${item.note}`);
}

fs.writeFileSync(llmsApiRealPath, `${llmLines.join('\n')}\n`, 'utf8');
console.log(outputPath);
console.log(llmsApiRealPath);
