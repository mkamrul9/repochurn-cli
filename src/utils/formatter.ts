import chalk from 'chalk';
import boxen from 'boxen';
import { AnalysisReport } from '../core/analyzer.js';

export function renderReport(report: AnalysisReport, repo: string, days: number): void {
    let content = `${chalk.bold.green('Codebase Velocity & Onboarding Report')}\n`;
    content += `${chalk.gray('─'.repeat(50))}\n\n`;

    content += `${chalk.bold('Repository:')} ${chalk.cyan(repo)}\n`;
    content += `${chalk.bold('Timeframe:')} Last ${chalk.yellow(days)} days\n`;
    content += `${chalk.bold('Scope:')} Deep-analyzed ${chalk.magenta(report.analyzedCommits)} of ${chalk.magenta(report.commitCount)} total recent commits\n\n`;

    if (report.hotspots.length === 0) {
        content += chalk.yellow('No significant file churn detected. The codebase is currently stable.');
    } else {
        content += `${chalk.bold.red('🔥 Top Code Hotspots (High Volatility)')}\n`;
        content += `${chalk.gray('These files are currently undergoing the most modifications.')}\n\n`;

        report.hotspots.forEach((spot, index) => {
            // Color-code the churn severity
            const churnColor = spot.totalChurn > 500 ? chalk.red : spot.totalChurn > 100 ? chalk.yellow : chalk.green;

            content += `${chalk.bold(index + 1)}. ${chalk.cyan(spot.filename)}\n`;
            content += `   ├─ ${chalk.gray('Churn Magnitude:')} ${churnColor(spot.totalChurn + ' lines altered')}\n`;
            content += `   └─ ${chalk.gray('Knowledge Owners:')} ${chalk.whiteBright(Array.from(spot.authors).join(', '))}\n\n`;
        });
    }

    // Render the final box to the console
    console.log(
        boxen(content.trimEnd(), {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'green',
        })
    );
}