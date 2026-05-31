import { AxiosError } from 'axios';
import chalk from 'chalk';
import boxen from 'boxen';

export interface GitHubApiErrorSummary {
    message: string;
    isRateLimit: boolean;
    rateLimitResetTime?: string;
    suggestedAction: string;
}

export function handleGitHubApiError(error: AxiosError): never {
    const summary: GitHubApiErrorSummary = {
        message: 'An unexpected network error occurred while communicating with GitHub.',
        isRateLimit: false,
        suggestedAction: 'Please check your internet connection and try again.',
    };

    // 1. Handle Request Timeouts or Network Drops
    if (error.code === 'ECONNABORTED' || !error.response) {
        summary.message = 'The connection to the GitHub API timed out or was dropped.';
        summary.suggestedAction = 'The upstream server might be sluggish. Increase the request timeout or retry shortly.';
        renderErrorBox(summary);
        process.exit(1);
    }

    const status = error.response.status;
    const headers = error.response.headers;
    const responseData = error.response.data as any;

    // 2. Handle Rate Limiting (403 Forbidden with specific headers)
    if (status === 403 && headers['x-ratelimit-remaining'] === '0') {
        summary.isRateLimit = true;
        summary.message = 'GitHub API Rate Limit Exceeded.';

        const resetHeader = headers['x-ratelimit-reset'];
        if (resetHeader) {
            const resetEpoch = parseInt(resetHeader, 10) * 1000;
            const resetDate = new Date(resetEpoch);
            const minutesRemaining = Math.ceil((resetEpoch - Date.now()) / 60000);
            summary.rateLimitResetTime = `${resetDate.toLocaleTimeString()} (in ${minutesRemaining} minutes)`;
        }

        summary.suggestedAction = configTokenAdvice();
        renderErrorBox(summary);
        process.exit(1);
    }

    // 3. Handle Resource Not Found (404)
    if (status === 404) {
        summary.message = 'Target repository or endpoint could not be found.';
        summary.suggestedAction = 'Double-check the "owner/repo" string layout. Verify that the repository is public.';
        renderErrorBox(summary);
        process.exit(1);
    }

    // 4. Handle Bad Credentials (401 Unauthorized)
    if (status === 401) {
        summary.message = 'Authentication failed (401 Unauthorized).';
        summary.suggestedAction = 'The GITHUB_TOKEN supplied in your environment configuration is invalid or expired.';
        renderErrorBox(summary);
        process.exit(1);
    }

    // 5. Catch-all for other 4xx and 5xx errors
    if (status >= 500) {
        summary.message = `GitHub Platform Server Error (${status}).`;
        summary.suggestedAction = 'GitHub services are currently experiencing issues. Check status.github.com.';
    } else {
        summary.message = responseData?.message || `API Request rejected with status code ${status}.`;
    }

    renderErrorBox(summary);
    process.exit(1);
}

function configTokenAdvice(): string {
    return (
        `Your unauthenticated IP address is capped at 60 requests/hr.\n\n` +
        `${chalk.bold('To resolve this:')}\n` +
        `1. Generate a Personal Access Token at github.com/settings/tokens\n` +
        `2. Open your local ${chalk.cyan('.env')} configuration file\n` +
        `3. Inject: ${chalk.green('GITHUB_TOKEN=your_token_here')}\n` +
        `4. Rerun the command to instantly upgrade to 5,000 requests/hr.`
    );
}

function renderErrorBox(summary: GitHubApiErrorSummary): void {
    let content = `${chalk.red.bold('✕ System Fault Executed')}\n\n` +
        `${chalk.yellow('Reason:')} ${summary.message}\n`;

    if (summary.isRateLimit && summary.rateLimitResetTime) {
        content += `${chalk.yellow('Resets At:')} ${summary.rateLimitResetTime}\n`;
    }

    content += `\n${chalk.blue.bold('Suggested Fix:')}\n${summary.suggestedAction}`;

    console.error(
        boxen(content, { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'red' })
    );
}