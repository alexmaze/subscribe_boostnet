import chalk from 'chalk';
import type { Config } from './config';
import { getSubscriptionLink } from './browser';

const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'host',
    'accept-encoding',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-real-ip',
]);

const PROXY_RESPONSE_HEADERS = [
    'content-type',
    'content-disposition',
    'subscription-userinfo',
    'profile-update-interval',
    'profile-web-page-url',
];

let pending: Promise<Response> | null = null;
let requestCounter = 0;

function ts(): string {
    return new Date().toISOString();
}

function log(level: 'info' | 'warn' | 'error' | 'debug', reqId: string, msg: string) {
    const prefix = `[${ts()}] [${reqId}]`;
    switch (level) {
        case 'info':  console.log(chalk.blue(`${prefix} ${msg}`)); break;
        case 'warn':  console.log(chalk.yellow(`${prefix} ${msg}`)); break;
        case 'error': console.error(chalk.red(`${prefix} ${msg}`)); break;
        case 'debug': console.log(chalk.gray(`${prefix} ${msg}`)); break;
    }
}

function filterRequestHeaders(headers: Headers): Record<string, string> {
    const filtered: Record<string, string> = {};
    headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
            filtered[key] = value;
        }
    });
    return filtered;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); },
        );
    });
}

async function handleSubscription(req: Request, config: Config, reqId: string): Promise<Response> {
    const startTime = Date.now();
    const elapsed = () => `${Date.now() - startTime}ms`;

    try {
        log('info', reqId, 'Starting Puppeteer to fetch subscription link...');

        const subscriptionLink = await withTimeout(
            getSubscriptionLink(config),
            90_000,
            'Puppeteer getSubscriptionLink',
        );

        log('info', reqId, `Subscription link obtained (${elapsed()}): ${subscriptionLink}`);

        const clientHeaders = filterRequestHeaders(req.headers);
        log('debug', reqId, `Forwarding headers: ${JSON.stringify(clientHeaders)}`);

        log('info', reqId, 'Fetching upstream subscription content...');
        const upstream = await withTimeout(
            fetch(subscriptionLink, {
                headers: clientHeaders,
                redirect: 'follow',
            }),
            30_000,
            'Upstream fetch',
        );

        log('info', reqId, `Upstream responded: status=${upstream.status}, content-type=${upstream.headers.get('content-type') ?? 'N/A'} (${elapsed()})`);

        const responseHeaders = new Headers();
        for (const key of PROXY_RESPONSE_HEADERS) {
            const val = upstream.headers.get(key);
            if (val) {
                responseHeaders.set(key, val);
                log('debug', reqId, `Response header: ${key}: ${val}`);
            }
        }

        const body = await upstream.text();
        const preview = body.length > 500 ? body.slice(0, 500) + `... (${body.length} bytes total)` : body;
        log('debug', reqId, `Response body:\n${preview}`);
        log('info', reqId, `Request completed successfully, body ${body.length} bytes (${elapsed()})`);

        return new Response(body, {
            status: upstream.status,
            headers: responseHeaders,
        });
    } catch (error) {
        const msg = (error as Error).message;
        const stack = (error as Error).stack;
        log('error', reqId, `Failed after ${elapsed()}: ${msg}`);
        if (stack) log('debug', reqId, `Stack trace: ${stack}`);
        return new Response(JSON.stringify({ error: msg }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export function startServer(config: Config, portOverride?: number) {
    const port = portOverride ?? config.port ?? 3000;

    const server = Bun.serve({
        port,
        idleTimeout: 120,
        async fetch(req) {
            const url = new URL(req.url);
            const method = req.method;
            const reqId = `#${++requestCounter}`;

            log('info', reqId, `${method} ${url.pathname}`);

            if (url.pathname === '/subscription') {
                if (pending) {
                    log('warn', reqId, 'Another request is in progress, waiting for it to complete...');
                    try {
                        const prev = await pending;
                        log('info', reqId, 'Reusing response from concurrent request');
                        return prev.clone();
                    } catch {
                        log('warn', reqId, 'Concurrent request failed, retrying independently');
                    }
                }

                const promise = handleSubscription(req, config, reqId);
                pending = promise;
                try {
                    return await promise;
                } finally {
                    pending = null;
                }
            }

            if (url.pathname === '/health') {
                log('debug', reqId, 'Health check OK');
                return new Response('ok');
            }

            log('warn', reqId, `Unknown path: ${url.pathname}`);
            return new Response('Not Found', { status: 404 });
        },
    });

    console.log(chalk.green(`\n[${ts()}] Server listening on http://localhost:${server.port}`));
    console.log(chalk.blue('Endpoints:'));
    console.log(chalk.blue('  GET /subscription  - Proxy subscription from Boostnet'));
    console.log(chalk.blue('  GET /health        - Health check'));
    console.log(chalk.gray(`Config: urls=${config.urls.join(', ')}, user=${config.username}\n`));

    return server;
}
