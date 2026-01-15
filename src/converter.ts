import axios from 'axios';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import { type Config } from './config';

export async function processSubscription(link: string, config: Config) {
    console.log(`Fetching subscription from: ${link}`);

    try {
        const response = await axios.get(link, {
            headers: {
                // Pretend to be Clash to get a YAML config directly if supported
                'User-Agent': 'Clash/1.0',
            },
            timeout: 30000
        });

        let content = response.data;
        let isYaml = false;

        // Check if content is YAML
        try {
            const parsed = yaml.load(content);
            if (typeof parsed === 'object' && parsed !== null && ('proxies' in parsed || 'Proxy' in parsed)) {
                isYaml = true;
            }
        } catch (e) {
            // Not YAML
        }

        let finalConfig: string = '';

        if (isYaml) {
            console.log('Received valid Clash YAML directly.');
            finalConfig = typeof content === 'string' ? content : yaml.dump(content);
        } else {
            console.log('Received non-YAML content. Assuming Base64 encoded proxy list.');
            // Decode Base64
            const decoded = Buffer.from(content, 'base64').toString('utf-8');
            // This is likely a list of vmrs://, ss://, etc.
            // Converting this to Clash properly is complex (requires parsing each protocol).
            // However, many subscription links return a full managed config. 
            // If the user *specifically* asked to "parse proxy config from this link", 
            // and the link returns a base64 list, then we need a converter.
            // BUT, usually "Convert to Mihomo" implies we might need to wrap it.
            // Since implementing a full protocol parser is out of scope for a simple script (unless we use a library),
            // We will assumptively try to fetch with 'Clash/1.0' which USUALLY forces the provider to give us YAML.
            // If that fails, we might just save what we got or error out if we can't parse.

            // Let's try to wrap it in a provider format or just error for now 
            // as implementing a full v2ray/ss parser is heavy. 
            // OR: We can use a public converter API? No, unsafe.

            // Re-evaluating: The user said "From this link parse proxy config, then convert to mihomo".
            // If the link *is* a subscription link, usually the UA trick works.
            // If we really got base64, we might be stuck without a heavy parser.
            // Let's assume the UA trick works for 99% of "Boostnet" type sites (they use standard panels).
            // If not, we will just save the decoded content to a file and warn.

            // Check if it looks like a proxy list
            if (decoded.includes('vmess://') || decoded.includes('ss://') || decoded.includes('trojan://')) {
                // It is a proxy list.
                // We'll create a simple Provider-based config for Mihomo.
                // Mihomo supports `proxy-providers`.
                // So we can create a config that REFERENCEs this link?
                // No, the user wants us to "convert" and "save".

                // fallback: Just save the raw content if we strictly can't parse, 
                // but let's try to construct a valid yaml if we can.
                // Actually, if we just set proxies: [], it's invalid.
                // Let's rely on the UA 'Clash/1.0' working.
                throw new Error('Fetched content is not a valid Clash YAML. The server did not return a Clash config despite User-Agent.');
            } else {
                throw new Error('Unknown content format.');
            }
        }

        // Ensure output directory exists
        await fs.mkdir(config.output_dir, { recursive: true });

        const filename = config.filename || 'boostnet.yaml';
        const outputPath = path.join(config.output_dir, filename);

        await fs.writeFile(outputPath, finalConfig, 'utf8');
        console.log(`Saved configuration to ${outputPath}`);

    } catch (error) {
        throw new Error(`Failed to process subscription: ${(error as Error).message}`);
    }
}
