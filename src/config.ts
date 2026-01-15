import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface Config {
    urls: string[];
    username: string;
    password: string;
    output_dir: string;
    filename?: string;
}

const DEFAULT_CONFIG_PATH = path.join(os.homedir(), '.config', 'subscribe_boostnet.yaml');

export async function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Promise<Config> {
    try {
        const fileContent = await fs.readFile(configPath, 'utf8');
        const config = yaml.load(fileContent) as Config;

        // Basic validation
        if (!config.urls || config.urls.length === 0) {
            throw new Error('Config missing "urls"');
        }
        if (!config.username) throw new Error('Config missing "username"');
        if (!config.password) throw new Error('Config missing "password"');
        if (!config.output_dir) throw new Error('Config missing "output_dir"');

        return config;
    } catch (error) {
        if ((error as any).code === 'ENOENT') {
            throw new Error(`Configuration file not found at ${configPath}. Please create it.`);
        }
        throw error;
    }
}
