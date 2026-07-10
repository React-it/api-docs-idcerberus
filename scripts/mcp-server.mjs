import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const publicBaseUrl = 'https://api-docs.idcerberus.com';

const resourceFiles = [
  {
    name: 'llms',
    uri: 'idcerberus://docs/llms',
    path: 'llms.txt',
    mimeType: 'text/plain',
    title: 'Índice LLM da documentação',
    description: 'Mapa curto dos guias, exemplos e arquivos principais para IA.',
  },
  {
    name: 'llms-small',
    uri: 'idcerberus://docs/llms-small',
    path: 'llms-small.txt',
    mimeType: 'text/plain',
    title: 'Resumo operacional para IA',
    description: 'Contexto curto para gerar payloads, curls e respostas de integração.',
  },
  {
    name: 'llms-full',
    uri: 'idcerberus://docs/llms-full',
    path: 'llms-full.txt',
    mimeType: 'text/plain',
    title: 'Documentação completa para IA',
    description: 'Conteúdo consolidado dos guias, API Reference e OpenAPI.',
  },
  {
    name: 'llms-api-reference',
    uri: 'idcerberus://docs/llms-api-reference',
    path: 'llms-api-reference.txt',
    mimeType: 'text/plain',
    title: 'Resumo da API Reference',
    description: 'Payloads, responses e exemplos técnicos do API Reference.',
  },
  {
    name: 'services-catalog',
    uri: 'idcerberus://docs/services-catalog',
    path: 'services-catalog.json',
    mimeType: 'application/json',
    title: 'Catálogo completo de services',
    description: 'Catálogo estruturado com aliases, campos, exemplos e hints para MCP.',
  },
  {
    name: 'services-catalog-min',
    uri: 'idcerberus://docs/services-catalog-min',
    path: 'services-catalog.min.json',
    mimeType: 'application/json',
    title: 'Catálogo leve de services',
    description: 'Índice compacto para busca rápida por service, categoria, tag e campos.',
  },
  {
    name: 'mcp-manifest',
    uri: 'idcerberus://docs/mcp-manifest',
    path: 'mcp-manifest.json',
    mimeType: 'application/json',
    title: 'Manifesto MCP idCerberus',
    description: 'Regras, recursos e ferramentas sugeridas para agentes MCP.',
  },
];

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function loadCatalog() {
  const catalog = readJson('services-catalog.json');
  return Array.isArray(catalog) ? catalog : catalog.services || [];
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function compactService(service) {
  return {
    service: service.service,
    name: service.name,
    callingAlias: service.callingAlias,
    category: service.category,
    requiredFields: service.requiredFields || [],
    optionalFields: service.optionalFields || [],
    documentationUrl: service.documentationUrl,
    curlExampleUrl: service.curlExampleUrl,
    tags: service.tags || [],
  };
}

function serviceSearchText(service) {
  return normalize(
    [
      service.service,
      service.name,
      service.callingAlias,
      service.category,
      service.summary,
      service.searchText,
      ...(service.tags || []),
      ...(service.requiredFields || []),
      ...(service.optionalFields || []),
    ].join(' '),
  );
}

function findService(catalog, alias) {
  const target = normalize(alias);
  return catalog.find((service) => {
    const aliases = [service.service, service.callingAlias, service.documentedAlias];
    return aliases.some((item) => normalize(item) === target);
  });
}

function textResult(text) {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

export function createIdCerberusDocsMcpServer() {
  const server = new McpServer({
    name: 'idcerberus-docs',
    version: '1.0.0',
  });

  for (const resource of resourceFiles) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title,
        description: resource.description,
        mimeType: resource.mimeType,
      },
      (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: resource.mimeType,
            text: readText(resource.path),
          },
        ],
      }),
    );
  }

  server.registerTool(
    'search_services',
    {
      title: 'Buscar services documentados',
      description: 'Busca services por alias, nome, categoria, tag, campo ou caso de uso. Não chama a API idCerberus.',
      inputSchema: {
        query: z.string().min(2).describe('Termo de busca, alias ou campo. Exemplo: OCR CNH, Face Index, cnpj, SERVICE_OCR.'),
        limit: z.number().int().min(1).max(25).optional().describe('Quantidade máxima de resultados. Padrão: 10.'),
      },
    },
    ({ query, limit = 10 }) => {
      const catalog = loadCatalog();
      const terms = normalize(query)
        .split(/\s+/)
        .filter(Boolean);

      const results = catalog
        .map((service) => {
          const haystack = serviceSearchText(service);
          const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
          return { service, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.service.name.localeCompare(b.service.name))
        .slice(0, limit)
        .map((item) => compactService(item.service));

      return textResult(JSON.stringify({ query, total: results.length, results }, null, 2));
    },
  );

  server.registerTool(
    'get_service',
    {
      title: 'Detalhar service documentado',
      description: 'Retorna payload, response, campos, links e alertas de um service documentado.',
      inputSchema: {
        service: z.string().min(2).describe('Alias base, alias de chamada ou alias documentado.'),
      },
    },
    ({ service }) => {
      const catalog = loadCatalog();
      const found = findService(catalog, service);

      if (!found) {
        return textResult(
          JSON.stringify(
            {
              service,
              found: false,
              message: 'Service não encontrado no catálogo documentado. Confirme o alias antes de integrar.',
            },
            null,
            2,
          ),
        );
      }

      return textResult(JSON.stringify({ found: true, service: found }, null, 2));
    },
  );

  server.registerTool(
    'get_curl_example',
    {
      title: 'Buscar exemplo curl',
      description: 'Retorna um exemplo curl local publicado na documentação. Não executa a chamada.',
      inputSchema: {
        file: z.string().min(3).describe('Nome do arquivo em examples/. Exemplo: service-api-ocr-cnh.hml.curl.'),
      },
    },
    ({ file }) => {
      const safeFile = path.basename(file);
      const relativePath = path.join('examples', safeFile);
      const fullPath = path.join(root, relativePath);

      if (!fs.existsSync(fullPath) || !safeFile.endsWith('.curl')) {
        return textResult(
          JSON.stringify(
            {
              file,
              found: false,
              message: 'Exemplo curl não encontrado. Use um arquivo publicado em examples/*.curl.',
            },
            null,
            2,
          ),
        );
      }

      return textResult(
        JSON.stringify(
          {
            file: safeFile,
            url: `${publicBaseUrl}/examples/${safeFile}`,
            curl: readText(relativePath),
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    'read_doc',
    {
      title: 'Ler página da documentação',
      description: 'Lê uma página local da documentação por caminho relativo permitido.',
      inputSchema: {
        path: z
          .string()
          .min(3)
          .describe('Caminho relativo em guides/, api-reference/ ou README.md. Exemplo: guides/service-api/ocr-service-api.mdx.'),
      },
    },
    ({ path: requestedPath }) => {
      const normalizedPath = requestedPath.replaceAll('\\', '/').replace(/^\/+/, '');
      const allowed =
        normalizedPath === 'README.md' || normalizedPath.startsWith('guides/') || normalizedPath.startsWith('api-reference/');

      if (!allowed || normalizedPath.includes('..')) {
        return textResult(
          JSON.stringify(
            {
              path: requestedPath,
              found: false,
              message: 'Caminho não permitido. Use README.md, guides/... ou api-reference/...',
            },
            null,
            2,
          ),
        );
      }

      const aliases = {
        'guides/service-api/ocr-service-api.mdx': 'guides/service-api/sobre-ocr-service-api.mdx',
      };
      const resolvedPath = aliases[normalizedPath] || normalizedPath;
      const fullPath = path.join(root, resolvedPath);
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        return textResult(
          JSON.stringify(
            {
              path: normalizedPath,
              found: false,
              message: 'Página não encontrada na documentação local.',
            },
            null,
            2,
          ),
        );
      }

      return textResult(
        JSON.stringify(
          {
            path: resolvedPath,
            requestedPath: normalizedPath,
            url: `${publicBaseUrl}/${resolvedPath.replace(/\.mdx$/, '')}`,
            content: readText(resolvedPath),
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerPrompt(
    'service_api_helper',
    {
      title: 'Ajudante de Service API',
      description: 'Prompt para responder dúvidas usando apenas a documentação idCerberus exposta pelo MCP.',
      argsSchema: {
        question: z.string().min(5).describe('Pergunta sobre autenticação, payload, service, OCR, Face Index ou erro.'),
      },
    },
    ({ question }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Responda usando apenas os recursos e ferramentas do MCP idCerberus Docs.',
              'Não invente service, campo, endpoint ou retorno ausente da documentação.',
              'Não execute chamada real em HML ou produção.',
              'Prefira exemplos com homologação e placeholders seguros.',
              `Pergunta: ${question}`,
            ].join('\n'),
          },
        },
      ],
    }),
  );

  return server;
}

export async function runStdioServer() {
  const server = createIdCerberusDocsMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] === __filename) {
  runStdioServer().catch((error) => {
    process.stderr.write(`idCerberus Docs MCP failed: ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
