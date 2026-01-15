import puppeteer from 'puppeteer';
import type { Config } from './config';

export async function getSubscriptionLink(config: Config): Promise<string> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Grant clipboard permissions
        const context = browser.defaultBrowserContext();
        if (!config.urls[0]) throw new Error('No URL configured');
        await context.overridePermissions(config.urls[0], ['clipboard-read', 'clipboard-write']); // Note: Permission override is origin-specific, need to handle in loop if origins differ significantly, but typically okay. Better to set for all or handle per attempt.

        let loginSuccess = false;
        let activeUrl = '';

        for (const url of config.urls) {
            try {
                console.log(`Trying URL: ${url}`);
                // Ensure URL ends with slash for consistent joining
                const baseUrl = url.endsWith('/') ? url : `${url}/`;
                const loginUrl = `${baseUrl}login`;

                await page.goto(loginUrl, { waitUntil: 'networkidle0', timeout: 15000 });

                // Check if we are actually on a login page or if it redirected to dashboard (already logged in?)
                // Assuming we need to login.

                // Wait for email input - user provided specific HTML
                // <input class="arco-input..." type="text" placeholder="输入邮箱" ...>
                const emailSelector = 'input[placeholder="输入邮箱"]';

                // Fast fail if selector not found
                await page.waitForSelector(emailSelector, { timeout: 10000 });

                console.log(`Navigated to ${loginUrl}, logging in...`);

                await page.type(emailSelector, config.username);
                await page.type('input[placeholder="输入密码"]', config.password);

                // Click login button
                // <button ... type="submit">登录</button>
                // We trust type="submit" or look for text
                const loginButton = await page.$('button[type="submit"]');

                if (loginButton) {
                    await (loginButton as any).click();
                } else {
                    // Fallback to searching by text if generic submit not found
                    const btn = await page.evaluateHandle(() => {
                        const btns = Array.from(document.querySelectorAll('button'));
                        return btns.find(b => b.textContent?.includes('登录') || b.textContent?.includes('Login'));
                    });
                    if (btn && (btn as any).click) {
                        await (btn as any).click();
                    } else {
                        throw new Error('Login button not found');
                    }
                }

                console.log('Login clicked. Waiting for dashboard...');

                // Wait for the "Copy Subscription" button to appear. 
                try {
                    await page.waitForFunction(() => {
                        const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, a, div[role="button"]'));
                        return buttons.some(b => b.textContent?.includes('复制订阅链接') || b.textContent?.includes('Copy Subscription'));
                    }, { timeout: 20000 });
                } catch (e) {
                    const html = await page.content();
                    console.error('Timeout waiting for dashboard. Current page HTML snippet:', html.substring(0, 500));
                    throw new Error('Login failed or dashboard did not load (Subscription button not found).');
                }

                await new Promise(r => setTimeout(r, 2000));
                console.log(`Login successful at ${url}, dashboard loaded.`);

                console.log(`Login successful at ${url}`);
                activeUrl = baseUrl;
                loginSuccess = true;
                break; // Stop trying URLs
            } catch (err) {
                console.error(`Failed to login at ${url}: ${(err as Error).message}`);
                continue;
            }
        }

        if (!loginSuccess) {
            throw new Error('All configured URLs failed.');
        }

        // Now on Dashboard. Find "Copy Subscription" button.
        // The user said "点击页面上的 「复制订阅链接」按钮"
        // We will look for this text.
        console.log('Searching for subscription button...');

        // We need to setup clipboard permission - already done above.
        // Re-apply permission override just in case of redirect
        await context.overridePermissions(activeUrl, ['clipboard-read', 'clipboard-write']);

        console.log('Clicking copy button...');

        // Find and click the button
        const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, a, div[role="button"]'));
            const subButton = buttons.find(b => b.textContent?.includes('复制订阅链接') || b.textContent?.includes('Copy Subscription'));
            if (subButton) {
                subButton.click();
                return true;
            }
            return false;
        });

        if (!clicked) {
            throw new Error('Could not find "Copy Subscription" button');
        }

        console.log('Button clicked. Waiting for clipboard update...');
        // Wait for clipboard write (heuristically)
        await new Promise(r => setTimeout(r, 2000));

        // Read clipboard
        const result = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
        });

        if (!result) {
            throw new Error('Clipboard is empty after clicking copy button.');
        }

        return result;

        return result;

    } finally {
        await browser.close();
    }
}
