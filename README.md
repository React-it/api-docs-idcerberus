# ReactIt Docs

Documentação da plataforma ReactIt utilizando Mintlify.

## Requisitos

- Node.js 20+
- npm

## Instalação

Entre na pasta do projeto:

```bash
cd reactit-docs
```

Instale as dependências:

```bash
npm install
```

## Rodando localmente

Inicie o servidor do Mintlify:

```bash
mint dev
```

ou:

```bash
mintlify dev
```

A documentação ficará disponível em:

```txt
http://localhost:3000
```

## Estrutura do projeto

```txt
reactit-docs/
├─ api-reference/
├─ docs.json
├─ index.mdx
├─ package.json
└─ README.md
```

## Deploy

O deploy pode ser realizado diretamente pela plataforma Mintlify conectando este repositório GitHub.

## Tecnologias

- Mintlify
- OpenAPI
- Markdown / MDX
