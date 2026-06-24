#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { GitHubApiException } from './api/errorHandler.js';
import { getLookbackDateISO } from './utils/time.js';
import { analyzeRepository } from './core/analyzer.js';
import { renderReport, OutputFormat } from './utils/formatter.js';
import { config } from './utils/config.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const REPO_REGEX = /^[\w.-]+\/[\w.-]+$/;

function validateRepo(repository: string): void {
    if (!REPO_REGEX.test(repository)) {
        console.error(
            chalk.red('✖ Invalid repository format. Expected "owner/repo" (e.g., vercel/next.js).'),
        );
        process.exit(1);
    }
}

function validateDays(raw: string): number {
    const days = parseInt(raw, 10);
    if (isNaN(days) || days <= 0) {
        console.error(chalk.red('✖ --days must be a positive integer.'));
        process.exit(1);
    }
    return days;
}

function validateFormat(raw: string): OutputFormat {
    const allowed: OutputFormat[] = ['terminal', 'json', 'csv', 'md'];
    if (!allowed.includes(raw as OutputFormat)) {
        console.error(chalk.red(`✖ --format must be one of: ${allowed.join(', ')}`));
        process.exit(1);
    }
    return raw as OutputFormat;
}

function handleFatalError(error: unknown): never {
    if (error instanceof GitHubApiException) {
        let content =
            `${chalk.red.bold('✖ GitHub API Error')}\n\n` +
            `${chalk.yellow('Reason:')} ${error.summary.message}\n`;

        if (error.summary.isRateLimit && error.summary.rateLimitResetTime) {
            content += `${chalk.yellow('Rate limit resets at:')} ${error.summary.rateLimitResetTime}\n`;
        }

        content += `\n${chalk.blue.bold('Suggested fix:')}\n${error.summary.suggestedAction}`;
        console.error(boxen(content, { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'red' }));
    } else if (error instanceof Error) {
        console.error(chalk.red(`✖ ${error.message}`));
    } else {
        console.error(chalk.red('✖ An unknown fatal error occurred.'));
    }
    process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI setup
// ─────────────────────────────────────────────────────────────────────────────
const program = new Command();

program
    .name('repochurn')
    .description('Analyze GitHub repository churn — hotspots, velocity, contributors, and risk')
    .version('2.0.0')
    .enablePositionalOptions();

// ─────────────────────────────────────────────────────────────────────────────
// `analyze` sub-command
// ─────────────────────────────────────────────────────────────────────────────
program
    .command('analyze')
    .description('Analyze churn for a single GitHub repository')
    .argument('<repository>', 'GitHub repository in "owner/repo" format (e.g. facebook/react)')
    .option(
        '-d, --days <number>',
        'Number of days to look back',
        String(config.rc.days ?? 30),
    )
    .option(
        '-t, --top <number>',
        'Number of top hotspot files to display',
        String(config.rc.top ?? 10),
    )
    .option(
        '-f, --format <type>',
        'Output format: terminal | json | csv | md',
        config.rc.format ?? 'terminal',
    )
    .option('-o, --output <file>', 'Write output to a file instead of stdout')
    .option(
        '-e, --exclude <patterns>',
        'Comma-separated substrings to exclude from analysis (e.g. "dist,generated")',
    )
    .option('--no-spinner', 'Disable progress spinner (useful in CI)')
    .action(async (repository: string, opts: {
        days: string;
        top: string;
        format: string;
        output?: string;
        exclude?: string;
        spinner: boolean;
    }) => {
        try {
            validateRepo(repository);
            const days = validateDays(opts.days);
            const topN = parseInt(opts.top, 10) || 10;
            const format = validateFormat(opts.format);
            const excludePatterns = opts.exclude
                ? opts.exclude.split(',').map((s) => s.trim()).filter(Boolean)
                : (config.rc.exclude ?? []);

            const sinceISO = getLookbackDateISO(days);
            const [owner, repo] = repository.split('/');

            // Print banner only for terminal format
            if (format === 'terminal') {
                console.log(
                    boxen(
                        `${chalk.green.bold('RepoChurn Oracle v2.0')}\n\n` +
                        `${chalk.blue('Target:')}  ${chalk.white(repository)}\n` +
                        `${chalk.blue('Window:')}  ${days} days (since ${sinceISO.split('T')[0]})\n` +
                        `${chalk.blue('Top N:')}   ${topN} hotspot files\n` +
                        `${chalk.blue('Auth:')}    ${config.githubToken ? chalk.green('✔ Token found') : chalk.yellow('⚠ No token — rate-limited to 60 req/hr')}`,
                        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' },
                    ),
                );
            }

            const report = await analyzeRepository(owner, repo, sinceISO, {
                topN,
                excludePatterns,
                spinner: opts.spinner && format === 'terminal',
            });

            if (report.commitCount === 0) {
                console.log(
                    chalk.yellow(`\nNo commits found for ${repository} in the last ${days} days.`),
                );
                process.exit(0);
            }

            renderReport(report, repository, days, { format, outputFile: opts.output });

        } catch (error) {
            handleFatalError(error);
        }
    });

// ─────────────────────────────────────────────────────────────────────────────
// `compare` sub-command
// ─────────────────────────────────────────────────────────────────────────────
program
    .command('compare')
    .description('Compare churn metrics between two GitHub repositories side-by-side')
    .argument('<repo1>', 'First repository in "owner/repo" format')
    .argument('<repo2>', 'Second repository in "owner/repo" format')
    .option('-d, --days <number>', 'Lookback window in days', '30')
    .option('--no-spinner', 'Disable progress spinner')
    .action(async (repo1: string, repo2: string, opts: { days: string; spinner: boolean }) => {
        try {
            validateRepo(repo1);
            validateRepo(repo2);
            const days = validateDays(opts.days);
            const sinceISO = getLookbackDateISO(days);

            console.log(
                boxen(
                    `${chalk.green.bold('RepoChurn Comparison Mode')}\n\n` +
                    `${chalk.blue('Repo A:')} ${chalk.white(repo1)}\n` +
                    `${chalk.blue('Repo B:')} ${chalk.white(repo2)}\n` +
                    `${chalk.blue('Window:')} ${days} days`,
                    { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'magenta' },
                ),
            );

            const spinnerEnabled = opts.spinner;
            const [owner1, repoName1] = repo1.split('/');
            const [owner2, repoName2] = repo2.split('/');

            console.log(chalk.gray(`\nAnalyzing ${repo1}…`));
            const reportA = await analyzeRepository(owner1, repoName1, sinceISO, {
                topN: 5,
                spinner: spinnerEnabled,
            });

            console.log(chalk.gray(`\nAnalyzing ${repo2}…`));
            const reportB = await analyzeRepository(owner2, repoName2, sinceISO, {
                topN: 5,
                spinner: spinnerEnabled,
            });

            // ── Side-by-side comparison table ──────────────────────────────
            const col = 28;
            const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);

            let table = `${chalk.bold.cyanBright('📊 Head-to-Head Comparison')}\n`;
            table += chalk.gray('─'.repeat(col * 2 + 3)) + '\n';
            table += `${chalk.bold(pad('Metric', 24))}  ${chalk.cyan(pad(repo1, col))}  ${chalk.magenta(pad(repo2, col))}\n`;
            table += chalk.gray('─'.repeat(col * 2 + 3)) + '\n';

            const row = (label: string, a: string, b: string) =>
                `${pad(label, 24)}  ${pad(a, col)}  ${pad(b, col)}\n`;

            table += row('Total commits (window)', String(reportA.commitCount), String(reportB.commitCount));
            table += row('Total lines added', '+' + reportA.totalAdditions.toLocaleString(), '+' + reportB.totalAdditions.toLocaleString());
            table += row('Total lines deleted', '-' + reportA.totalDeletions.toLocaleString(), '-' + reportB.totalDeletions.toLocaleString());
            table += row('Unique contributors', String(reportA.contributors.length), String(reportB.contributors.length));
            table += row('Top hotspot churn', reportA.hotspots[0] ? String(reportA.hotspots[0].totalChurn) : 'N/A', reportB.hotspots[0] ? String(reportB.hotspots[0].totalChurn) : 'N/A');
            table += row('Top hotspot file', reportA.hotspots[0]?.filename.split('/').pop() ?? 'N/A', reportB.hotspots[0]?.filename.split('/').pop() ?? 'N/A');

            if (reportA.repoInfo && reportB.repoInfo) {
                table += chalk.gray('─'.repeat(col * 2 + 3)) + '\n';
                table += row('Language', reportA.repoInfo.language ?? 'N/A', reportB.repoInfo.language ?? 'N/A');
                table += row('Stars', '★ ' + reportA.repoInfo.stargazers_count.toLocaleString(), '★ ' + reportB.repoInfo.stargazers_count.toLocaleString());
                table += row('Open Issues', String(reportA.repoInfo.open_issues_count), String(reportB.repoInfo.open_issues_count));
            }

            console.log(boxen(table.trimEnd(), { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }));

        } catch (error) {
            handleFatalError(error);
        }
    });

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compat: positional-only invocation (no sub-command)
// repochurn owner/repo --days 30  →  silently route to analyze
// ─────────────────────────────────────────────────────────────────────────────
program
    .argument('[repository]', 'GitHub repository in "owner/repo" format (shorthand — prefer `analyze`)')
    .option('-d, --days <number>', 'Number of days to look back', '30')
    .option('-t, --top <number>', 'Number of top hotspot files', '10')
    .option('-f, --format <type>', 'Output format: terminal | json | csv | md', 'terminal')
    .option('-o, --output <file>', 'Write output to a file')
    .option('-e, --exclude <patterns>', 'Comma-separated exclude substrings')
    .option('--no-spinner', 'Disable progress spinner')
    .action(async (repository: string | undefined, opts: {
        days: string;
        top: string;
        format: string;
        output?: string;
        exclude?: string;
        spinner: boolean;
    }) => {
        // If a sub-command was matched, Commander won't call this action
        // Only called when user does `repochurn owner/repo` (no sub-command)
        if (!repository) return;
        try {
            validateRepo(repository);
            const days = validateDays(opts.days);
            const topN = parseInt(opts.top, 10) || 10;
            const format = validateFormat(opts.format);
            const excludePatterns = opts.exclude
                ? opts.exclude.split(',').map((s) => s.trim()).filter(Boolean)
                : (config.rc.exclude ?? []);
            const sinceISO = getLookbackDateISO(days);
            const [owner, repo] = repository.split('/');

            if (format === 'terminal') {
                console.log(
                    boxen(
                        `${chalk.green.bold('RepoChurn Oracle v2.0')}\n\n` +
                        `${chalk.blue('Target:')}  ${chalk.white(repository)}\n` +
                        `${chalk.blue('Window:')}  ${days} days (since ${sinceISO.split('T')[0]})\n` +
                        `${chalk.blue('Auth:')}    ${config.githubToken ? chalk.green('✔ Token') : chalk.yellow('⚠ No token')}`,
                        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' },
                    ),
                );
            }

            const report = await analyzeRepository(owner, repo, sinceISO, {
                topN,
                excludePatterns,
                spinner: opts.spinner && format === 'terminal',
            });

            if (report.commitCount === 0) {
                console.log(chalk.yellow(`\nNo commits found for ${repository} in the last ${days} days.`));
                process.exit(0);
            }

            renderReport(report, repository, days, { format, outputFile: opts.output });
        } catch (error) {
            handleFatalError(error);
        }
    });

program.parse(process.argv);