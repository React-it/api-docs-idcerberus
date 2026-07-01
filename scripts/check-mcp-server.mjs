import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createIdCerberusDocsMcpServer } from './mcp-server.mjs';

async function assertClientWorks(client) {
  const resources = await client.listResources();
  const tools = await client.listTools();

  const requiredResources = ['idcerberus://docs/llms', 'idcerberus://docs/services-catalog', 'idcerberus://docs/mcp-manifest'];
  const resourceUris = new Set(resources.resources.map((resource) => resource.uri));
  for (const uri of requiredResources) {
    if (!resourceUris.has(uri)) throw new Error(`Missing MCP resource: ${uri}`);
  }

  const requiredTools = ['search_services', 'get_service', 'get_curl_example', 'read_doc'];
  const toolNames = new Set(tools.tools.map((tool) => tool.name));
  for (const tool of requiredTools) {
    if (!toolNames.has(tool)) throw new Error(`Missing MCP tool: ${tool}`);
  }

  const searchResult = await client.callTool({
    name: 'search_services',
    arguments: { query: 'OCR CNH', limit: 5 },
  });
  if (!searchResult.content?.[0]?.text?.includes('SERVICE_OCR')) {
    throw new Error('search_services did not return OCR content.');
  }

  const serviceResult = await client.callTool({
    name: 'get_service',
    arguments: { service: 'SERVICE_FACE_INDEX' },
  });
  if (!serviceResult.content?.[0]?.text?.includes('SERVICE_FACE_INDEX')) {
    throw new Error('get_service did not return SERVICE_FACE_INDEX.');
  }

  const curlResult = await client.callTool({
    name: 'get_curl_example',
    arguments: { file: 'service-api-ocr-cnh.hml.curl' },
  });
  if (!curlResult.content?.[0]?.text?.includes('/api/service-api')) {
    throw new Error('get_curl_example did not return a service-api curl.');
  }

  const docResult = await client.callTool({
    name: 'read_doc',
    arguments: { path: 'guides/service-api/ocr-service-api.mdx' },
  });
  if (!docResult.content?.[0]?.text?.includes('OCR')) {
    throw new Error('read_doc did not return OCR guide content.');
  }
}

async function checkInMemoryServer() {
  const server = createIdCerberusDocsMcpServer();
  const client = new Client({
    name: 'idcerberus-docs-memory-smoke-test',
    version: '1.0.0',
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    await assertClientWorks(client);
  } finally {
    await client.close();
    await server.close();
  }
}

async function checkStdioServer() {
  const client = new Client({
    name: 'idcerberus-docs-stdio-smoke-test',
    version: '1.0.0',
  });

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['scripts/mcp-server.mjs'],
    cwd: process.cwd(),
    stderr: 'pipe',
  });

  try {
    await client.connect(transport);
    await assertClientWorks(client);
  } finally {
    await client.close();
  }
}

await checkInMemoryServer();
await checkStdioServer();

console.log('MCP smoke check ok.');
