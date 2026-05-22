# idCerberus Docs

Documentação da API idCerberus construída com Mintlify.

O projeto organiza guias de integração, catálogo técnico, API Reference e
arquivos auxiliares para LLMs. A documentação cobre produtos de onboarding,
KYC, biometria, risco, compliance, enriquecimento cadastral e consultas de
pessoa física e pessoa jurídica.

## Requisitos

- Node.js 20+
- npm

## Instalação

Entre na pasta do projeto:

```bash
cd api-docs-idcerberus
```

Instale as dependências:

```bash
npm install
```

## Rodando localmente

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

A documentação fica disponível em:

```txt
http://localhost:3000
```

No Windows, se o PowerShell bloquear `npm.ps1`, use:

```powershell
npm.cmd run dev
```

## Arquivos para LLMs

O projeto gera arquivos em texto simples e JSON para uso por ChatGPT, Claude,
Cursor, Windsurf e outros assistentes:

- `llms.txt`: índice curto da documentação.
- `llms-small.txt`: resumo operacional com ambientes, autenticação, service-api,
  fluxos principais e services documentados.
- `llms-full.txt`: conteúdo completo dos guias, API Reference e OpenAPI.
- `llms-api-reference.txt`: resumo operacional do API Reference com services e
  exemplos de curl.
- `services-catalog.json`: catálogo estruturado dos services documentados.
- `examples/*.curl`: exemplos prontos para homologação e produção.

Para gerar manualmente:

```bash
node scripts/generate-llms.mjs
```

Ou via npm:

```bash
npm run generate:llms
```

O mesmo gerador também atualiza catálogo, páginas explícitas do API Reference e exemplos `.curl`:

```bash
npm run generate:artifacts
```

No Windows, caso o PowerShell bloqueie o npm:

```powershell
npm.cmd run generate:llms
```

O script de export também executa a geração antes de publicar:

```bash
npm run export
```

No deploy, a URL canônica da documentação fica em:

- `https://api-docs.idcerberus.com/`

O arquivo `CNAME` publicado no artifact do GitHub Pages aponta para
`api-docs.idcerberus.com`.

Os arquivos auxiliares devem ficar disponíveis em:

- `https://api-docs.idcerberus.com/llms.txt`
- `https://api-docs.idcerberus.com/llms-small.txt`
- `https://api-docs.idcerberus.com/llms-full.txt`
- `https://api-docs.idcerberus.com/llms-api-reference.txt`
- `https://api-docs.idcerberus.com/services-catalog.json`
- `https://api-docs.idcerberus.com/examples/auth.hml.curl`

Nas páginas públicas, os links para esses arquivos podem usar caminhos absolutos
da raiz do domínio customizado, como `/llms.txt`, `/services-catalog.json` e
`/examples/...`.

## Estrutura

```txt
api-docs-idcerberus/
|-- api-reference/
|   |-- como-executar-service.mdx
|   |-- services-por-caso-de-uso.mdx
|   |-- services-pessoa-fisica.mdx
|   |-- services-pessoa-juridica.mdx
|   |-- boas-vindas.mdx
|   `-- openapi.json
|-- assets/
|   `-- idcerberus-logo-transparent.png
|-- guides/
|   |-- pessoas/
|   |-- empresas/
|   |-- service-api/
|   |-- autenticacao.mdx
|   |-- llms.mdx
|   |-- onboarding-sdk.mdx
|   |-- quickstart.mdx
|   `-- ...
|-- scripts/
|   |-- check-text-quality.mjs
|   |-- generate-llms.mjs
|   `-- prepare-pages-export.mjs
|-- docs.json
|-- examples/
|   |-- auth.hml.curl
|   |-- auth.prod.curl
|   `-- ...
|-- index.mdx
|-- llms.txt
|-- llms-small.txt
|-- llms-full.txt
|-- llms-api-reference.txt
|-- services-catalog.json
|-- package.json
`-- README.md
```

## Conteúdo principal

- `index.mdx`: página inicial da documentação.
- `docs.json`: configuração do Mintlify, tema, logo, navegação e OpenAPI.
- `api-reference/openapi.json`: definição OpenAPI usada pela aba API Reference.
- `api-reference/boas-vindas.mdx`: introdução da API Reference.
- `api-reference/como-executar-service.mdx`: passo a passo para autenticar, escolher ambiente e executar um service.
- `api-reference/services-por-caso-de-uso.mdx`: mapa de services por objetivo de integração.
- `api-reference/services-pessoa-fisica.mdx`: catálogo explícito dos services de pessoa física no API Reference.
- `api-reference/services-pessoa-juridica.mdx`: catálogo explícito dos services de pessoa jurídica no API Reference.
- `guides/`: guias por fluxo, categoria de serviço e catálogo técnico.
- `guides/llms.mdx`: página pública com links diretos para arquivos de contexto.
- `guides/indice-de-services.mdx`: índice navegável dos services documentados.
- `guides/exemplos-por-ambiente.mdx`: chamadas equivalentes de HML e produção.
- `guides/erros-comuns-integracao.mdx`: diagnóstico de falhas comuns.
- `assets/`: imagens e logo usadas pela documentação.

## Organização da navegação

A documentação está dividida em duas áreas principais:

- Guias: explicam fluxos, categorias, casos de uso e como escolher services.
- API Reference: concentra endpoints, exemplos de request/response e schemas.

Dentro dos guias, os conteúdos estão organizados por:

- Comece aqui
- Fluxos principais
- POST `/api/service-api`
- Pessoas
- Empresas
- Catálogo técnico

## Qualidade de texto

Antes de publicar, rode o check de texto para capturar caracteres quebrados,
mojibake, frases duplicadas comuns e placeholders inseguros:

```bash
npm run check:text
```

Para checar texto e regenerar os arquivos de LLM:

```bash
npm run check
```

## Validação rápida

Para validar `docs.json`:

```bash
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('docs.json','utf8')); console.log('docs.json ok');"
```

Para regenerar e validar arquivos de LLM:

```bash
node scripts/generate-llms.mjs
node -e "const fs=require('fs'); for (const f of ['llms.txt','llms-small.txt','llms-full.txt']) { const s=fs.readFileSync(f,'utf8'); console.log(f, s.includes('\\uFFFD') ? 'encoding ruim' : 'ok'); }"
```

## Ambientes

- Homologação: `https://backoffice-hml.idcerberus.com`
- Produção: `https://backoffice.idcerberus.com`

O endpoint central de consultas é `POST /api/service-api`. O produto executado é
definido pelo campo `service`.

## Deploy

O export deve gerar os arquivos de LLM antes da publicação:

```bash
npm run export
```

No Windows:

```powershell
npm.cmd run export
```
