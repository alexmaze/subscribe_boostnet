#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config';
import { getSubscriptionLink } from './browser';
import { processSubscription } from './converter';

const program = new Command();

program
    .name('boostnet-cli')
    .description('CLI to automate Boostnet subscription updates')
    .version('1.0.0')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
        try {
            console.log(chalk.blue('Starting Boostnet Subscription Tool...'));

            // 1. Load Config
            const configPath = options.config;
            const config = await loadConfig(configPath);
            console.log(chalk.green('Configuration loaded successfully.'));

            // 2. Automated Login & Link Extraction
            console.log(chalk.blue('Launching browser to retrieve subscription link...'));
            const subscriptionLink = await getSubscriptionLink(config);
            console.log(chalk.green(`Successfully extracted link: ${subscriptionLink}`));

            // 3. Process & Save
            console.log(chalk.blue('Processing subscription and saving config...'));
            await processSubscription(subscriptionLink, config);

            console.log(chalk.green('All Done! ✅'));
            process.exit(0);

        } catch (error) {
            console.error(chalk.red('Error:'), (error as Error).message);
            process.exit(1);
        }
    });

program.parse(process.argv);
