# idCerberus Docs

Documentação da API idCerberus construída com Mintlify.

O projeto organiza guias de integração, catálogo técnico e API Reference para
produtos de onboarding, KYC, biometria, risco, compliance, enriquecimento
cadastral e consultas de pessoa física e pessoa jurídica.

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

## Estrutura

```txt
api-docs-idcerberus/
├─ api-reference/
│  ├─ boas-vindas.mdx
│  └─ openapi.json
├─ assets/
│  └─ idcerberus-logo-transparent.png
├─ guides/
│  ├─ pessoas/
│  ├─ empresas/
│  ├─ service-api/
│  ├─ autenticacao.mdx
│  ├─ onboarding-sdk.mdx
│  ├─ quickstart.mdx
│  └─ ...
├─ docs.json
├─ index.mdx
├─ package.json
└─ README.md
```

## Conteúdo principal

- `index.mdx`: página inicial da documentação.
- `docs.json`: configuração do Mintlify, tema, logo, navegação e OpenAPI.
- `api-reference/openapi.json`: definição OpenAPI usada pela aba API Reference.
- `api-reference/boas-vindas.mdx`: introdução da API Reference.
- `guides/`: guias por fluxo, categoria de serviço e catálogo técnico.
- `assets/`: imagens e logo usadas pela documentação.

## Organização da navegação

A documentação está dividida em duas áreas principais:

- **Guias**: explicam fluxos, categorias, casos de uso e como escolher serviços.
- **API Reference**: concentra endpoints, exemplos de request/response e schemas.

Dentro dos guias, os conteúdos estão organizados por:

- Comece aqui
- Fluxos principais
- POST `/api/service-api`
- Pessoas
- Empresas
- Catálogo técnico

O Quickstart foi pensado para usuários com diferentes níveis técnicos. Ele mostra
como executar a primeira chamada usando Postman, Windows PowerShell/CMD, macOS e
Linux.

Também existem guias práticos para primeira consulta de CPF, primeira consulta
de CNPJ, checklist de produção, glossário e tratamento de status/erros.
Para apoio operacional, a documentação também inclui mapa da documentação,
Postman do zero, boas práticas de integração e troubleshooting.

## Validação rápida

Para validar a estrutura do OpenAPI e do `docs.json`:

```bash
node -e "const fs=require('fs'),yaml=require('js-yaml'); const doc=yaml.load(fs.readFileSync('api-reference/openapi.json','utf8')); JSON.parse(fs.readFileSync('docs.json','utf8')); console.log('openapi', doc.openapi); console.log('docs.json ok');"
```

## Observações

- O tema visual usa a identidade azul da idCerberus.
- A logo utilizada fica em `assets/idcerberus-logo-transparent.png`.
- O endpoint central de consultas é `POST /api/service-api`; o produto executado é
  definido pelo campo `service`.
- A documentação contempla os ambientes de homologação e produção:
  - Homologação: `https://backoffice-hml.idcerberus.com`
  - Produção: `https://backoffice.idcerberus.com`
- A API Reference possui exemplos de request e response para os serviços
  migrados da referência original.

## Deploy

O deploy pode ser feito pela plataforma Mintlify conectada ao repositório GitHub.
