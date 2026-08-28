# idCerberus Docs

Documentação oficial da API idCerberus, construída com Mintlify.

O projeto organiza guias de integração, catálogo técnico, API Reference, exemplos de chamadas e arquivos auxiliares para LLMs. A documentação cobre os principais fluxos de onboarding, KYC, biometria, OCR, risco, compliance, enriquecimento cadastral e consultas de pessoa física e pessoa jurídica.

## Para Que Serve

Esta documentação foi pensada para três usos principais:

- Ajudar clientes a entenderem como autenticar e executar services pela API.
- Ajudar suporte, QA e desenvolvimento a testarem chamadas reais com exemplos prontos.
- Gerar arquivos de contexto para assistentes de IA consultarem a documentação com menos ambiguidade.

O endpoint central das consultas é:

```txt
POST /api/service-api
```

O service executado é definido pelo campo `service` no payload.

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

## Rodando Localmente

Inicie o servidor de desenvolvimento (regenera os artifacts de LLM antes de subir o Mintlify):

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

## Ambientes

- Homologação: `https://backoffice-hml.idcerberus.com`
- Produção: `https://backoffice.idcerberus.com`
- Documentação publicada: `https://api-docs.idcerberus.com/`

## Como Usar a Documentação

Para começar uma integração, siga este caminho:

1. Leia o quickstart em `guides/quickstart.mdx`.
2. Gere um token em `POST /api/token-generate`.
3. Escolha o service no índice técnico ou no API Reference.
4. Teste o payload mínimo em HML.
5. Ajuste produto, permissões e massa de teste quando o retorno indicar falta de acesso ou dado insuficiente.

Para OCR e chamadas com imagem, veja também os exemplos em `examples/` e os guias específicos em `guides/service-api/`.

## Exemplos Prontos

A pasta `examples/` contém exemplos curl prontos para copiar, ajustar token e testar.

Exemplos principais:

- `examples/auth.hml.curl`: geração de token em HML.
- `examples/auth.prod.curl`: geração de token em produção.
- `examples/service-api-cpf.hml.curl`: consulta de CPF em HML.
- `examples/service-api-cnpj.hml.curl`: consulta de CNPJ em HML.
- `examples/service-api-ocr-cnh.hml.curl`: OCR de CNH.
- `examples/service-api-ocr-rg.hml.curl`: OCR de RG com frente e verso.
- `examples/service-api-ocr-cnpj-card.hml.curl`: OCR de cartão CNPJ.
- `examples/service-api-ocr-proof-of-address.hml.curl`: OCR de comprovante de endereço.
- `examples/service-api-face-index.hml.curl`: busca facial por selfie.
- `examples/service-api-credit-risk-company.hml.curl`: risco de crédito PJ.
- `examples/service-api-credit-score.hml.curl`: score de crédito PF.
- `examples/facematch.hml.curl`: comparação facial.
- `examples/documentoscopia.hml.curl`: documentoscopia.

Na versão publicada, os exemplos ficam disponíveis em:

```txt
https://api-docs.idcerberus.com/examples/NOME_DO_ARQUIVO.curl
```

## Arquivos Para LLMs

O projeto gera arquivos em texto simples e JSON para ChatGPT, Claude, Cursor, Windsurf e outros assistentes.

- `llms.txt`: índice curto da documentação, com links principais e exemplos curl.
- `llms-small.txt`: resumo operacional com ambientes, autenticação, service-api, erros comuns e services documentados.
- `llms-full.txt`: conteúdo completo dos guias, API Reference e OpenAPI.
- `llms-api-reference.txt`: resumo operacional do API Reference com payloads, responses e exemplos de curl.
- `services-catalog.json`: catálogo estruturado dos services documentados.
- `services-catalog.min.json`: índice leve para busca rápida por service, categoria, tag e campos.
- `mcp-manifest.json`: manifesto para MCPs e agentes com recursos, regras e ferramentas sugeridas.
- `guides-search-index.json`: índice dos guias (título, descrição, grupo, url e trecho do corpo) usado pela busca do site publicado.
- `examples/*.curl`: chamadas prontas para homologação e produção.

Arquivos publicados:

- `https://api-docs.idcerberus.com/llms.txt`
- `https://api-docs.idcerberus.com/llms-small.txt`
- `https://api-docs.idcerberus.com/llms-full.txt`
- `https://api-docs.idcerberus.com/llms-api-reference.txt`
- `https://api-docs.idcerberus.com/services-catalog.json`
- `https://api-docs.idcerberus.com/services-catalog.min.json`
- `https://api-docs.idcerberus.com/mcp-manifest.json`
- `https://api-docs.idcerberus.com/guides-search-index.json`

## MCP Local

O projeto também entrega um servidor MCP real, somente leitura, para usar a documentação em Claude Desktop, Cursor, Windsurf ou outro cliente compatível.

Ele expõe:

- Resources: `llms.txt`, `llms-small.txt`, `llms-full.txt`, `llms-api-reference.txt`, `services-catalog.json`, `services-catalog.min.json` e `mcp-manifest.json`.
- Tools:
  - `search_services`: busca services por alias, nome, campo, tag ou caso de uso.
  - `get_service`: retorna detalhes de um service documentado.
  - `get_curl_example`: retorna um exemplo `.curl` publicado em `examples/`.
  - `read_doc`: lê páginas locais de `guides/`, `api-reference/` ou `README.md`.
- Prompt: `service_api_helper`, para responder dúvidas usando apenas a documentação.

O MCP não chama HML, produção, banco, API idCerberus nem endpoints reais. Ele só consulta arquivos locais da documentação.

Para testar o servidor MCP, incluindo uma conexão real por `stdio`:

```bash
npm run mcp:check
```

Para rodar via stdio:

```bash
npm run mcp:stdio
```

Configuração exemplo para clientes MCP locais:

```json
{
  "mcpServers": {
    "idcerberus-docs": {
      "command": "node",
      "args": ["C:/dev/api-docs-idcerberus/scripts/mcp-server.mjs"]
    }
  }
}
```

O mesmo exemplo está em `mcp-config.example.json`. Para usar em outro caminho, troque apenas o valor de `args` para o caminho absoluto do arquivo `scripts/mcp-server.mjs` na sua máquina.

Depois de conectar no cliente MCP, teste perguntas como:

- "Qual service devo usar para OCR de CNH?"
- "Monte um payload de HML para SERVICE_FACE_INDEX."
- "Quais campos obrigatórios do SERVICE_CREDIT_RISK_COMPANY?"
- "O que conferir quando a Service API retorna Don't have access to the service?"

O servidor deve responder consultando as tools/resources locais, sem solicitar credenciais, documentos ou imagens de clientes.

## Geração de Artifacts

Para regenerar catálogo, páginas do API Reference, arquivos LLM e exemplos curl:

```bash
npm run generate:artifacts
```

No Windows:

```powershell
npm.cmd run generate:artifacts
```

Para gerar apenas os arquivos de LLM:

```bash
npm run generate:llms
```

O script de export também executa a geração antes de publicar:

```bash
npm run export
```

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
|-- examples/
|   |-- auth.hml.curl
|   |-- service-api-ocr-cnh.hml.curl
|   `-- ...
|-- guides/
|   |-- pessoas/
|   |-- empresas/
|   |-- service-api/
|   |-- autenticacao.mdx
|   |-- indice-de-services.mdx
|   |-- llms.mdx
|   |-- onboarding-sdk.mdx
|   |-- quickstart.mdx
|   `-- ...
|-- scripts/
|   |-- check-catalog-coverage.mjs
|   |-- check-generated-drift.mjs
|   |-- check-mcp-server.mjs
|   |-- check-text-quality.mjs
|   |-- generate-llms.mjs
|   |-- mcp-server.mjs
|   |-- prepare-pages-export.mjs
|   `-- validate-generated-artifacts.mjs
|-- docs.json
|-- index.mdx
|-- llms.txt
|-- llms-small.txt
|-- llms-full.txt
|-- llms-api-reference.txt
|-- services-catalog.json
|-- services-catalog.min.json
|-- mcp-manifest.json
|-- guides-search-index.json
|-- package.json
`-- README.md
```

## Conteúdo Principal

- `index.mdx`: página inicial da documentação.
- `docs.json`: configuração do Mintlify, tema, logo, navegação, OpenAPI, botão de suporte (`navbar`) e menu contextual (`contextual`).
- `api-reference/openapi.json`: definição OpenAPI usada pela aba API Reference.
- `api-reference/boas-vindas.mdx`: introdução da API Reference.
- `api-reference/como-executar-service.mdx`: passo a passo para autenticar, escolher ambiente e executar um service.
- `api-reference/services-por-caso-de-uso.mdx`: mapa de services por objetivo de integração.
- `api-reference/services-pessoa-fisica.mdx`: catálogo explícito dos services de pessoa física no API Reference.
- `api-reference/services-pessoa-juridica.mdx`: catálogo explícito dos services de pessoa jurídica no API Reference.
- `guides/indice-de-services.mdx`: índice navegável dos services documentados.
- `guides/exemplos-por-ambiente.mdx`: chamadas equivalentes de HML e produção.
- `guides/erros-comuns-integracao.mdx`: diagnóstico de falhas comuns.
- `guides/duvidas-e-solucoes.mdx`: perguntas e respostas diretas por tema, para checar antes de abrir chamado de suporte.
- `guides/webhooks.mdx`: como funciona o webhook, payload por origem e por que não há reenvio automático.
- `guides/backoffice.mdx`: o que a interface visual mostra (dashboard, onboardings, consultas rápidas) e quando usar em vez da API.
- `guides/llms.mdx`: página pública com links diretos para arquivos de contexto.

## Organização da Navegação

A documentação está dividida em duas áreas principais:

- Guias: explicam fluxos, categorias, casos de uso, OCR, autenticação e como escolher services.
- API Reference: concentra endpoints, exemplos de request/response, schemas e services.

Dentro dos guias, os conteúdos estão organizados por:

- Primeiros passos
- Suporte e referência
- Fluxos principais
- POST `/api/service-api`
- Pessoas
- Empresas
- Catálogo técnico

O Catálogo técnico (`servicos-pessoa-fisica.mdx` e `servicos-pessoa-juridica.mdx`) é a
fonte canônica de cada service, com todos os campos e exemplos. As demais páginas de
navegação por service (Matriz de serviços, Famílias de serviços, Escolha o serviço certo)
são atalhos por objetivo/família e linkam de volta para o catálogo técnico.

## Checks

O projeto tem checks automáticos para pegar problema antes de publicar. Cada um cobre uma
camada diferente:

| Comando | O que verifica |
| --- | --- |
| `npm run check:text` | Caracteres quebrados, mojibake, frases duplicadas comuns e placeholders inseguros. |
| `npm run check:artifacts` | Se `services-catalog.json`, `services-catalog.min.json` e `mcp-manifest.json` têm todos os campos obrigatórios e URLs públicas válidas. |
| `npm run check:coverage` | Se todo service do catálogo aparece em `familias-de-servicos.mdx`, `matriz-de-servicos.mdx` e no catálogo técnico (`servicos-pessoa-fisica.mdx`/`servicos-pessoa-juridica.mdx`), e se nenhum alias aparece duplicado na mesma tabela. |
| `npm run check:drift` | Se os artifacts gerados (`services-catalog.json`, `llms*.txt`, páginas do API Reference etc.) estão em dia com o que foi commitado — roda a geração e falha se sobrar diff. |
| `npm run mcp:check` | Smoke test do servidor MCP local (resources, tools e uma conexão real por stdio). |
| `npm run validate` | Validação oficial do build Mintlify (`mint validate`) — schemas do `docs.json`, links e estrutura de navegação. |

Para rodar a geração de artifacts e a maioria dos checks de uma vez:

```bash
npm run check
```

Isso executa, em sequência: `generate:llms` → `check:text` → `check:artifacts` →
`check:coverage` → `mcp:check`. Rode `check:drift` e `validate` separadamente quando for
publicar, já que dependem de estado do git e de baixar o CLI da Mintlify.

Para uma checagem de sintaxe de `docs.json` sem depender de rede (mais rápida que
`npm run validate`, que baixa o CLI da Mintlify a cada execução):

```bash
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('docs.json','utf8')); console.log('docs.json ok');"
```

## Deploy

O export deve gerar os arquivos auxiliares antes da publicação:

```bash
npm run export
```

No Windows:

```powershell
npm.cmd run export
```

O arquivo `CNAME` publicado no artifact do GitHub Pages aponta para:

```txt
api-docs.idcerberus.com
```

A busca do site publicado é própria (não depende da conta da Mintlify): `scripts/prepare-pages-export.mjs` gera `search-widget.js` no build e injeta uma tag `<script defer>` em cada página exportada, apontando para esse arquivo. Ele consulta `services-catalog.min.json` e `guides-search-index.json` para montar os resultados.

## Cuidados Antes de Commitar

Antes de commitar alterações na documentação:

```bash
npm run check
git diff --check
git status --short
```

Se a alteração adicionar ou remover um service (novo alias documentado), rode
`npm run check:coverage` de novo depois de editar os guias manualmente — ele falha caso o
service fique de fora de algum catálogo ou fique duplicado na mesma tabela.

Não commitar:

- arquivos locais de análise temporária;
- `node_modules/`;
- exports zipados locais;
- credenciais, tokens, secrets ou exemplos com dados reais de cliente.

Ao adicionar um exemplo de CPF ou CNPJ, use um valor com dígito verificador
inválido (como `00000000000` / `00000000000000`), não apenas um número
"aleatório" — números de 11 ou 14 dígitos escolhidos à mão às vezes passam no
cálculo do dígito verificador por coincidência e acabam parecendo um
documento real.
