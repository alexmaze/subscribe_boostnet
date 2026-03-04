#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config';
import { getSubscriptionLink } from './browser';
import { processSubscription } from './converter';
import { startServer } from './server';

const program = new Command();

program
    .name('boostnet-cli')
    .description('CLI to automate Boostnet subscription updates')
    .version('1.0.0');

program
    .command('run', { isDefault: true })
    .description('Run once: fetch subscription and save config file')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
        try {
            console.log(chalk.blue('Starting Boostnet Subscription Tool...'));

            const config = await loadConfig(options.config);
            console.log(chalk.green('Configuration loaded successfully.'));

            console.log(chalk.blue('Launching browser to retrieve subscription link...'));
            const subscriptionLink = await getSubscriptionLink(config);
            console.log(chalk.green(`Successfully extracted link: ${subscriptionLink}`));

            console.log(chalk.blue('Processing subscription and saving config...'));
            await processSubscription(subscriptionLink, config);

            console.log(chalk.green('All Done!'));
            process.exit(0);

        } catch (error) {
            console.error(chalk.red('Error:'), (error as Error).message);
            process.exit(1);
        }
    });

program
    .command('serve')
    .description('Start HTTP server to proxy Boostnet subscription requests')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-p, --port <port>', 'Port to listen on (overrides config)', parseInt)
    .action(async (options) => {
        try {
            const config = await loadConfig(options.config);
            console.log(chalk.green('Configuration loaded successfully.'));

            startServer(config, options.port);
        } catch (error) {
            console.error(chalk.red('Error:'), (error as Error).message);
            process.exit(1);
        }
    });

program.parse(process.argv);
