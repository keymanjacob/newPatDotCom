import { app } from '@azure/functions';
import serverlessExpress from '@vendia/serverless-express';
import { expressApp } from '../index.js';
import { initDatabase, ensureSchema } from '../db/neon.js';

let isDbInitialized = false;

// Prepare the express wrapper
const handler = serverlessExpress({ app: expressApp });

// Register the wildcard route for Azure Functions handling all API traffic
app.http('api', {
    route: '{*segments}',
    authLevel: 'anonymous',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    handler: async (request, context) => {
        // Initialize DB pool logic only once per serverless container run
        if (!isDbInitialized) {
            try {
                initDatabase();
                await ensureSchema();
                isDbInitialized = true;
            } catch (err) {
                context.warn("Failed to init DB on cold start, proceeding anyway:", err);
            }
        }
        
        return handler(request, context);
    }
});
