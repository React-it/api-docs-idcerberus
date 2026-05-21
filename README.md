# idCerberus Docs

Documentacao da API idCerberus construida com Mintlify.

O projeto organiza guias de integracao, catalogo tecnico, API Reference e
arquivos auxiliares para LLMs. A documentacao cobre produtos de onboarding,
KYC, biometria, risco, compliance, enriquecimento cadastral e consultas de
pessoa fisica e pessoa juridica.

## Requisitos

- Node.js 20+
- npm

## Instalacao

Entre na pasta do projeto:

```bash
cd api-docs-idcerberus
```

Instale as dependencias:

```bash
npm install
```

## Rodando localmente

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

A documentacao fica disponivel em:

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

- `llms.txt`: indice curto da documentacao.
- `llms-small.txt`: resumo operacional com ambientes, autenticacao, service-api,
  fluxos principais e services documentados.
- `llms-full.txt`: conteudo completo dos guias, API Reference e OpenAPI.
- `llms-api-reference.txt`: resumo operacional do API Reference com services e
  exemplos de curl.
- `services-catalog.json`: catalogo estruturado dos services documentados.
- `examples/*.curl`: exemplos prontos para homologacao e producao.

Para gerar manualmente:

```bash
node scripts/generate-llms.mjs
```

Ou via npm:

```bash
npm run generate:llms
```

O mesmo gerador tambem atualiza catalogo e exemplos `.curl`:

```bash
npm run generate:artifacts
```

No Windows, caso o PowerShell bloqueie o npm:

```powershell
npm.cmd run generate:llms
```

O script de export tambem executa a geracao antes de publicar:

```bash
npm run export
```

No deploy, os arquivos devem ficar disponiveis em:

- `https://react-it.github.io/api-docs-idcerberus/llms.txt`
- `https://react-it.github.io/api-docs-idcerberus/llms-small.txt`
- `https://react-it.github.io/api-docs-idcerberus/llms-full.txt`
- `https://react-it.github.io/api-docs-idcerberus/llms-api-reference.txt`
- `https://react-it.github.io/api-docs-idcerberus/services-catalog.json`
- `https://react-it.github.io/api-docs-idcerberus/examples/auth.hml.curl`

## Estrutura

```txt
api-docs-idcerberus/
|-- api-reference/
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

## Conteudo principal

- `index.mdx`: pagina inicial da documentacao.
- `docs.json`: configuracao do Mintlify, tema, logo, navegacao e OpenAPI.
- `api-reference/openapi.json`: definicao OpenAPI usada pela aba API Reference.
- `api-reference/boas-vindas.mdx`: introducao da API Reference.
- `guides/`: guias por fluxo, categoria de servico e catalogo tecnico.
- `guides/llms.mdx`: guia de uso dos arquivos para LLMs.
- `guides/indice-de-services.mdx`: indice navegavel dos services documentados.
- `guides/exemplos-por-ambiente.mdx`: chamadas equivalentes de HML e producao.
- `guides/erros-comuns-integracao.mdx`: diagnostico de falhas comuns.
- `assets/`: imagens e logo usadas pela documentacao.

## Organizacao da navegacao

A documentacao esta dividida em duas areas principais:

- Guias: explicam fluxos, categorias, casos de uso e como escolher services.
- API Reference: concentra endpoints, exemplos de request/response e schemas.

Dentro dos guias, os conteudos estao organizados por:

- Comece aqui
- Fluxos principais
- POST `/api/service-api`
- Pessoas
- Empresas
- Catalogo tecnico

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

## Validacao rapida

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

- Homologacao: `https://backoffice-hml.idcerberus.com`
- Producao: `https://backoffice.idcerberus.com`

O endpoint central de consultas e `POST /api/service-api`. O produto executado e
definido pelo campo `service`.

## Deploy

O export deve gerar os arquivos de LLM antes da publicacao:

```bash
npm run export
```

No Windows:

```powershell
npm.cmd run export
```
