import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import http from 'node:http';
import { expressApp } from '../index.js';
import { initDatabase, ensureSchema } from '../db/neon.js';

let isDbInitialized = false;
let server: http.Server | null = null;
let serverPort: number | null = null;

/**
 * Start an in-process HTTP server running Express.
 * This avoids @vendia/serverless-express which is incompatible with
 * both Azure Functions (designed for AWS Lambda) and Express 5.x.
 */
function getServer(): Promise<number> {
    if (serverPort) return Promise.resolve(serverPort);

    return new Promise((resolve, reject) => {
        server = http.createServer(expressApp);
        // Listen on a random available port (0 = OS picks one)
        server.listen(0, '127.0.0.1', () => {
            const addr = server!.address();
            if (addr && typeof addr === 'object') {
                serverPort = addr.port;
                console.log(`✅ Internal Express server listening on 127.0.0.1:${serverPort}`);
                resolve(serverPort);
            } else {
                reject(new Error('Failed to get server address'));
            }
        });
        server.on('error', reject);
    });
}

/**
 * Proxy an Azure Functions HttpRequest to Local Express via http.request.
 */
async function proxyToExpress(request: HttpRequest): Promise<HttpResponseInit> {
    const port = await getServer();

    // Read the incoming body
    const bodyBuffer = await request.arrayBuffer();
    const bodyData = Buffer.from(bodyBuffer);

    // Build the path from the URL
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    // Copy headers from the Azure Functions request
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        headers[key] = value;
    });

    return new Promise<HttpResponseInit>((resolve, reject) => {
        const proxyReq = http.request(
            {
                hostname: '127.0.0.1',
                port,
                path,
                method: request.method,
                headers,
            },
            (proxyRes) => {
                const chunks: Buffer[] = [];
                proxyRes.on('data', (chunk) => chunks.push(chunk));
                proxyRes.on('end', () => {
                    const responseBody = Buffer.concat(chunks);

                    // Convert Node.js headers to a simple object
                    const responseHeaders: Record<string, string> = {};
                    for (const [key, value] of Object.entries(proxyRes.headers)) {
                        if (value) {
                            responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
                        }
                    }

                    resolve({
                        status: proxyRes.statusCode ?? 500,
                        headers: responseHeaders,
                        body: responseBody,
                    });
                });
                proxyRes.on('error', reject);
            }
        );

        proxyReq.on('error', reject);

        if (bodyData.length > 0) {
            proxyReq.write(bodyData);
        }
        proxyReq.end();
    });
}

// Register the wildcard route for Azure Functions handling all API traffic
app.http('api', {
    route: 'api/{*segments}',
    authLevel: 'anonymous',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        // Initialize DB pool logic only once per serverless container run
        if (!isDbInitialized) {
            try {
                initDatabase();
                await ensureSchema();
                isDbInitialized = true;
                context.log("✅ Database initialized successfully");
            } catch (err) {
                context.warn("Failed to init DB on cold start, proceeding anyway:", err);
            }
        }

        try {
            return await proxyToExpress(request);
        } catch (err: any) {
            context.error("Error proxying request to Express:", err);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  success: false, 
                  error: 'Internal server error proxying', 
                  details: err?.message || String(err),
                  stack: err?.stack || ''
                }),
            };
        }
    }
});
