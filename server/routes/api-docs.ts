import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPIDocument } from '../config/openapi';

export function createApiDocsRouter() {
  const router = Router();

  // Generate the OpenAPI document
  const openApiDocument = generateOpenAPIDocument();

  // Serve the OpenAPI JSON spec at /api/docs/openapi.json
  router.get('/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(openApiDocument);
  });

  // Serve the Swagger UI at /api/docs
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Sandwich Project Platform API',
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info .title { color: #3b4151; }
      `,
      customCssUrl: undefined,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
    })
  );

  return router;
}
