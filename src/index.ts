#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';

const program = new Command();

program
    .name('repochurn')
    .description('Analyze codebase velocity, hotspots, and contributor churn over the last 30 days')
    .version('1.0.0');

program
    .argument('<repository>', 'GitHub repository identifier in format "owner/repo" (e.g., facebook/react)')
    .option('-d, --days <number>', 'Number of days to analyze retrospectively', '30')
    .action((repository: string, options: { days: string }) => {
        const daysParsed = parseInt(options.days, 10);

        if (isNaN(daysParsed) || daysParsed <= 0) {
            console.error(chalk.red('✕ Error: The --days option must be a positive integer.'));
            process.exit(1);
        }

        // Validate owner/repo string format
        const repoRegex = /^[\w.-]+\/[\w.-]+$/;
        if (!repoRegex.test(repository)) {
            console.error(chalk.red('✕ Error: Invalid repository format. Please supply "owner/repo" (e.g., vercel/next.js).'));
            process.exit(1);
        }

        console.log(
            boxen(
                `${chalk.green.bold('RepoChurn Oracle Initialized')}\n\n` +
                `${chalk.blue('Target Repo:')} ${repository}\n` +
                `${chalk.blue('Lookback Window:')} ${daysParsed} days\n` +
                `${chalk.blue('Auth Status:')} ${process.env.GITHUB_TOKEN ? chalk.green('Authenticated (Token Loaded)') : chalk.yellow('Unauthenticated (Rate limited to 60 req/hr)')}`,
                { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
            )
        );
    });

program.parse(process.argv);