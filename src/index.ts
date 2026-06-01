#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { GitHubApiException } from './api/errorHandler.js';
import { getLookbackDateISO } from './utils/time.js';
import { analyzeRepository } from './core/analyzer.js';
import { renderReport } from './utils/formatter.js';

const program = new Command();

program
    .name('repochurn')
    .description('Analyze codebase velocity, hotspots, and contributor churn over the last 30 days')
    .version('1.0.0');

program
    .argument('<repository>', 'GitHub repository identifier in format "owner/repo" (e.g., facebook/react)')
    .option('-d, --days <number>', 'Number of days to analyze retrospectively', '30')
    .action(async (repository: string, options: { days: string }) => {
        try {
            const daysParsed = parseInt(options.days, 10);

            if (isNaN(daysParsed) || daysParsed <= 0) {
                console.error(chalk.red('✕ Error: The --days option must be a positive integer.'));
                process.exit(1);
            }

            const repoRegex = /^[\w.-]+\/[\w.-]+$/;
            if (!repoRegex.test(repository)) {
                console.error(chalk.red('✕ Error: Invalid repository format. Please supply "owner/repo" (e.g., vercel/next.js).'));
                process.exit(1);
            }

            const sinceISO = getLookbackDateISO(daysParsed);

            console.log(
                boxen(
                    `${chalk.green.bold('RepoChurn Oracle Initialized')}\n\n` +
                    `${chalk.blue('Target Repo:')} ${repository}\n` +
                    `${chalk.blue('Lookback Window:')} ${daysParsed} days (Since: ${sinceISO.split('T')[0]})\n` +
                    `${chalk.blue('Auth Status:')} ${process.env.GITHUB_TOKEN ? chalk.green('Authenticated') : chalk.yellow('Unauthenticated')}`,
                    { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
                )
            );

            // Phase 7: Core Analysis
            const [owner, repoName] = repository.split('/');
            const report = await analyzeRepository(owner, repoName, sinceISO);

            // Phase 8: UI Rendering
            if (report.commitCount === 0) {
                console.log(chalk.yellow(`\nNo commits found for ${repository} in the last ${daysParsed} days. The repository might be inactive.`));
                process.exit(0);
            }

            renderReport(report, repository, daysParsed);
        } catch (error) {
            if (error instanceof GitHubApiException) {
                let content = `${chalk.red.bold('✕ System Fault Executed')}\n\n` +
                    `${chalk.yellow('Reason:')} ${error.summary.message}\n`;

                if (error.summary.isRateLimit && error.summary.rateLimitResetTime) {
                    content += `${chalk.yellow('Resets At:')} ${error.summary.rateLimitResetTime}\n`;
                }

                content += `\n${chalk.blue.bold('Suggested Fix:')}\n${error.summary.suggestedAction}`;

                console.error(
                    boxen(content, { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'red' })
                );
                process.exit(1);
            } else if (error instanceof Error) {
                console.error(chalk.red(`✕ Error: ${error.message}`));
                process.exit(1);
            } else {
                console.error(chalk.red('✕ An unknown fatal error occurred.'));
                process.exit(1);
            }
        }
    });

program.parse(process.argv);