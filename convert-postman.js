const postmanToOpenApi = require('postman-to-openapi');

postmanToOpenApi(
  'api-reference/idCerberus.postman_collection.json',
  'api-reference/openapi.json',
  {
    defaultTag: 'General',
    outputFormat: 'json'
  }
)
  .then(() => {
    console.log('OpenAPI gerado em api-reference/openapi.json');
  })
  .catch((error) => {
    console.error('Erro ao converter:', error);
    process.exit(1);
  });