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
]);

const PROXY_RESPONSE_HEADERS = [
    'content-type',
    'content-disposition',
    'content-encoding',
    'subscription-userinfo',
    'profile-update-interval',
    'profile-web-page-url',
];

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let pending: Promise<Response> | null = null;
let cache: { body: ArrayBuffer; headers: [string, string][]; status: number; time: number } | null = null;

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

async function handleSubscription(req: Request, config: Config): Promise<Response> {
    const startTime = Date.now();

    try {
        console.log(chalk.blue(`[${new Date().toISOString()}] Incoming request, fetching subscription link via Puppeteer...`));

        const subscriptionLink = await withTimeout(
            getSubscriptionLink(config),
            90_000,
            'Puppeteer getSubscriptionLink',
        );

        console.log(chalk.green(`Subscription link obtained in ${Date.now() - startTime}ms`));

        const clientHeaders = filterRequestHeaders(req.headers);

        const upstream = await withTimeout(
            fetch(subscriptionLink, {
                headers: clientHeaders,
                redirect: 'follow',
            }),
            30_000,
            'Upstream fetch',
        );

        const responseHeaders = new Headers();
        for (const key of PROXY_RESPONSE_HEADERS) {
            const val = upstream.headers.get(key);
            if (val) responseHeaders.set(key, val);
        }

        console.log(chalk.green(`[${new Date().toISOString()}] Request completed in ${Date.now() - startTime}ms`));

        const body = await upstream.arrayBuffer();
        const headerEntries: [string, string][] = [];
        responseHeaders.forEach((v, k) => headerEntries.push([k, v]));
        cache = { body, headers: headerEntries, status: upstream.status, time: Date.now() };

        console.log(chalk.blue(`Response cached, TTL ${CACHE_TTL_MS / 1000}s`));

        return new Response(body, {
            status: upstream.status,
            headers: responseHeaders,
        });
    } catch (error) {
        const msg = (error as Error).message;
        console.error(chalk.red(`[${new Date().toISOString()}] Error after ${Date.now() - startTime}ms: ${msg}`));
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

            if (url.pathname === '/subscription') {
                if (cache && Date.now() - cache.time < CACHE_TTL_MS) {
                    console.log(chalk.green(`[${new Date().toISOString()}] Serving from cache (age: ${Math.round((Date.now() - cache.time) / 1000)}s)`));
                    return new Response(cache.body, {
                        status: cache.status,
                        headers: new Headers(cache.headers),
                    });
                }

                if (pending) {
                    console.log(chalk.yellow('Concurrent request queued, waiting for ongoing Puppeteer operation...'));
                    try {
                        const prev = await pending;
                        return prev.clone();
                    } catch {
                        // Previous failed, fall through to try again
                    }
                }

                const promise = handleSubscription(req, config);
                pending = promise;
                try {
                    return await promise;
                } finally {
                    pending = null;
                }
            }

            if (url.pathname === '/health') {
                return new Response('ok');
            }

            return new Response('Not Found', { status: 404 });
        },
    });

    console.log(chalk.green(`Server listening on http://localhost:${server.port}`));
    console.log(chalk.blue('Endpoints:'));
    console.log(chalk.blue(`  GET /subscription  - Proxy subscription from Boostnet`));
    console.log(chalk.blue(`  GET /health        - Health check`));

    return server;
}
