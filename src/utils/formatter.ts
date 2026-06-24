import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs';
import path from 'path';
import { AnalysisReport, FileHotspot, FileCategory, WeeklyBucket } from '../core/analyzer.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type OutputFormat = 'terminal' | 'json' | 'csv' | 'md';

export interface RenderOptions {
    format: OutputFormat;
    /** Write output to this file path instead of stdout */
    outputFile?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function categoryBadge(cat: FileCategory): string {
    const map: Record<FileCategory, string> = {
        source: chalk.blueBright('[src]'),
        test: chalk.green('[test]'),
        config: chalk.yellow('[cfg]'),
        docs: chalk.gray('[docs]'),
        other: chalk.dim('[?]'),
    };
    return map[cat];
}

function riskBar(score: number, width = 12): string {
    const filled = Math.round((score / 100) * width);
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
    if (score >= 75) return chalk.red(bar);
    if (score >= 40) return chalk.yellow(bar);
    return chalk.green(bar);
}

function sparkline(buckets: WeeklyBucket[]): string {
    if (buckets.length === 0) return '';
    const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const max = Math.max(...buckets.map((b) => b.commits), 1);
    return buckets
        .map((b) => {
            const idx = Math.round((b.commits / max) * (chars.length - 1));
            return chalk.cyan(chars[idx]);
        })
        .join('');
}

function formatNumber(n: number): string {
    return n.toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal renderer (default, richest output)
// ─────────────────────────────────────────────────────────────────────────────
function renderTerminal(report: AnalysisReport, repo: string, days: number): string {
    const sep = chalk.gray('─'.repeat(56));
    let out = '';

    // ── Header ──────────────────────────────────────────────────────────────
    out += `${chalk.bold.cyanBright('⚡ RepoChurn Analysis Report')}\n`;
    out += `${sep}\n\n`;

    if (report.repoInfo) {
        const ri = report.repoInfo;
        out += `${chalk.bold('Repository:')}  ${chalk.cyan(repo)}`;
        if (ri.description) out += `\n${chalk.bold('Description:')} ${chalk.gray(ri.description)}`;
        out += `\n${chalk.bold('Language:')}    ${chalk.yellow(ri.language ?? 'N/A')}`;
        out += `   ${chalk.bold('Stars:')} ${chalk.yellow('★ ' + formatNumber(ri.stargazers_count))}`;
        out += `   ${chalk.bold('Open Issues:')} ${chalk.red(formatNumber(ri.open_issues_count))}`;
        out += '\n';
    } else {
        out += `${chalk.bold('Repository:')}  ${chalk.cyan(repo)}\n`;
    }

    out += `${chalk.bold('Lookback:')}    Last ${chalk.yellow(days)} days\n`;
    out += `${chalk.bold('Commits:')}     Analyzed ${chalk.magenta(report.analyzedCommits)} of ${chalk.magenta(report.commitCount)} total\n`;
    out += `${chalk.bold('Delta:')}       ${chalk.green('+' + formatNumber(report.totalAdditions))} additions / ${chalk.red('-' + formatNumber(report.totalDeletions))} deletions\n`;

    // ── Weekly Velocity ──────────────────────────────────────────────────────
    if (report.weeklyVelocity.length > 1) {
        out += `\n${sep}\n`;
        out += `${chalk.bold.white('📈 Weekly Commit Velocity')}\n`;
        out += `   ${sparkline(report.weeklyVelocity)}  (${report.weeklyVelocity.length} weeks)\n`;
    }

    // ── Hotspots ────────────────────────────────────────────────────────────
    out += `\n${sep}\n`;
    if (report.hotspots.length === 0) {
        out += chalk.yellow('No significant file churn detected — codebase is stable.\n');
    } else {
        out += `${chalk.bold.redBright('🔥 Top Code Hotspots')}\n`;
        out += `${chalk.gray('Ranked by total lines altered. Risk score = churn ÷ bus factor.')}\n\n`;

        report.hotspots.forEach((spot: FileHotspot, i: number) => {
            const churnColor =
                spot.totalChurn > 500 ? chalk.red :
                spot.totalChurn > 100 ? chalk.yellow :
                chalk.green;

            out += `${chalk.bold.white(String(i + 1).padStart(2))}  ${categoryBadge(spot.category)} ${chalk.cyanBright(spot.filename)}\n`;
            out += `       Churn:    ${churnColor(formatNumber(spot.totalChurn) + ' lines')}`;
            out += `  (${chalk.green('+' + spot.additions)} ${chalk.red('-' + spot.deletions)})\n`;
            out += `       Commits:  ${chalk.white(spot.commitCount)}\n`;
            out += `       Authors:  ${chalk.whiteBright(spot.authors.slice(0, 5).join(', '))}${spot.authors.length > 5 ? chalk.gray(` +${spot.authors.length - 5} more`) : ''}\n`;
            out += `       Risk:     ${riskBar(spot.riskScore)} ${chalk.dim(spot.riskScore + '/100')}\n\n`;
        });
    }

    // ── Contributors ────────────────────────────────────────────────────────
    if (report.contributors.length > 0) {
        out += `${sep}\n`;
        out += `${chalk.bold.white('👥 Top Contributors (window)')}\n\n`;
        const top = report.contributors.slice(0, 7);
        top.forEach((c, i) => {
            out += `  ${chalk.bold((i + 1) + '.')} ${chalk.cyanBright(c.login.padEnd(24))}`;
            out += ` ${chalk.magenta(c.commits + ' commits')}`;
            out += `  ${chalk.green('+' + formatNumber(c.additions))} ${chalk.red('-' + formatNumber(c.deletions))}\n`;
        });
        if (report.contributors.length > 7) {
            out += chalk.gray(`\n  … and ${report.contributors.length - 7} more contributors.\n`);
        }
    }

    return out.trimEnd();
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON renderer
// ─────────────────────────────────────────────────────────────────────────────
function renderJson(report: AnalysisReport, repo: string, days: number): string {
    const payload = {
        repository: repo,
        lookbackDays: days,
        generatedAt: new Date().toISOString(),
        summary: {
            commitCount: report.commitCount,
            analyzedCommits: report.analyzedCommits,
            totalAdditions: report.totalAdditions,
            totalDeletions: report.totalDeletions,
        },
        repoInfo: report.repoInfo,
        hotspots: report.hotspots.map((h) => ({
            filename: h.filename,
            category: h.category,
            totalChurn: h.totalChurn,
            additions: h.additions,
            deletions: h.deletions,
            commitCount: h.commitCount,
            authors: h.authors,
            riskScore: h.riskScore,
        })),
        contributors: report.contributors,
        weeklyVelocity: report.weeklyVelocity,
    };
    return JSON.stringify(payload, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV renderer
// ─────────────────────────────────────────────────────────────────────────────
function renderCsv(report: AnalysisReport): string {
    const rows: string[] = [
        'rank,filename,category,totalChurn,additions,deletions,commitCount,authorCount,authors,riskScore',
    ];
    report.hotspots.forEach((h, i) => {
        const authorsCsv = `"${h.authors.join('; ')}"`;
        rows.push(
            [i + 1, `"${h.filename}"`, h.category, h.totalChurn, h.additions, h.deletions,
                h.commitCount, h.authors.length, authorsCsv, h.riskScore].join(','),
        );
    });
    return rows.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown renderer
// ─────────────────────────────────────────────────────────────────────────────
function renderMarkdown(report: AnalysisReport, repo: string, days: number): string {
    const date = new Date().toISOString().split('T')[0];
    let md = `# 🔥 RepoChurn Report — \`${repo}\`\n\n`;
    md += `> Generated on **${date}** · Lookback: **${days} days**\n\n`;

    if (report.repoInfo) {
        const ri = report.repoInfo;
        md += `## Repository Summary\n\n`;
        md += `| Field | Value |\n|---|---|\n`;
        md += `| Language | ${ri.language ?? 'N/A'} |\n`;
        md += `| Stars | ★ ${formatNumber(ri.stargazers_count)} |\n`;
        md += `| Forks | ${formatNumber(ri.forks_count)} |\n`;
        md += `| Open Issues | ${formatNumber(ri.open_issues_count)} |\n`;
        md += `| Default Branch | \`${ri.default_branch}\` |\n\n`;
    }

    md += `## Commit Activity\n\n`;
    md += `- **Total commits in window:** ${report.commitCount}\n`;
    md += `- **Deep-analyzed:** ${report.analyzedCommits}\n`;
    md += `- **Lines added:** +${formatNumber(report.totalAdditions)}\n`;
    md += `- **Lines deleted:** -${formatNumber(report.totalDeletions)}\n\n`;

    md += `## 🔥 File Hotspots\n\n`;
    md += `| # | File | Category | Churn | +Add | -Del | Commits | Authors | Risk |\n`;
    md += `|---|------|----------|-------|------|------|---------|---------|------|\n`;
    report.hotspots.forEach((h, i) => {
        md += `| ${i + 1} | \`${h.filename}\` | ${h.category} | ${formatNumber(h.totalChurn)} | +${h.additions} | -${h.deletions} | ${h.commitCount} | ${h.authors.length} | ${h.riskScore}/100 |\n`;
    });

    md += `\n## 👥 Contributors\n\n`;
    md += `| # | Login | Commits | +Additions | -Deletions |\n`;
    md += `|---|-------|---------|-----------|------------|\n`;
    report.contributors.slice(0, 15).forEach((c, i) => {
        md += `| ${i + 1} | @${c.login} | ${c.commits} | +${formatNumber(c.additions)} | -${formatNumber(c.deletions)} |\n`;
    });

    if (report.weeklyVelocity.length > 0) {
        md += `\n## 📈 Weekly Velocity\n\n`;
        md += `| Week | Commits |\n|------|--------|\n`;
        report.weeklyVelocity.forEach((b) => {
            md += `| ${b.week} | ${b.commits} |\n`;
        });
    }

    md += `\n---\n*Generated by [repochurn-cli](https://github.com/mkamrul9/repochurn-cli)*\n`;
    return md;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────
export function renderReport(
    report: AnalysisReport,
    repo: string,
    days: number,
    opts: RenderOptions = { format: 'terminal' },
): void {
    let output: string;

    switch (opts.format) {
        case 'json':
            output = renderJson(report, repo, days);
            break;
        case 'csv':
            output = renderCsv(report);
            break;
        case 'md':
            output = renderMarkdown(report, repo, days);
            break;
        default:
            // Terminal: wrap in a pretty boxen panel
            output = boxen(renderTerminal(report, repo, days), {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'cyan',
            });
    }

    if (opts.outputFile) {
        const resolved = path.resolve(opts.outputFile);
        fs.writeFileSync(resolved, output, 'utf-8');
        console.log(chalk.green(`✔ Report written to ${resolved}`));
    } else {
        console.log(output);
    }
}