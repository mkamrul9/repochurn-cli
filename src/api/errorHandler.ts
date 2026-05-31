import { AxiosError } from 'axios';

export interface GitHubApiErrorSummary {
    message: string;
    isRateLimit: boolean;
    rateLimitResetTime?: string;
    suggestedAction: string;
}

export class GitHubApiException extends Error {
    public summary: GitHubApiErrorSummary;

    constructor(summary: GitHubApiErrorSummary) {
        super(summary.message);
        this.name = 'GitHubApiException';
        this.summary = summary;
    }
}

export function handleGitHubApiError(error: AxiosError): never {
    const summary: GitHubApiErrorSummary = {
        message: 'An unexpected network error occurred while communicating with GitHub.',
        isRateLimit: false,
        suggestedAction: 'Please check your internet connection and try again.',
    };

    if (error.code === 'ECONNABORTED' || !error.response) {
        summary.message = 'The connection to the GitHub API timed out or was dropped.';
        summary.suggestedAction = 'The upstream server might be sluggish. Increase the request timeout or retry shortly.';
        throw new GitHubApiException(summary);
    }

    const status = error.response.status;
    const headers = error.response.headers;
    const responseData = error.response.data as any;

    if (status === 403 && headers['x-ratelimit-remaining'] === '0') {
        summary.isRateLimit = true;
        summary.message = 'GitHub API Rate Limit Exceeded.';

        const resetHeader = headers['x-ratelimit-reset'];
        if (resetHeader) {
            const resetEpoch = parseInt(resetHeader as string, 10) * 1000;
            const resetDate = new Date(resetEpoch);
            const minutesRemaining = Math.ceil((resetEpoch - Date.now()) / 60000);
            summary.rateLimitResetTime = `${resetDate.toLocaleTimeString()} (in ${minutesRemaining} minutes)`;
        }

        summary.suggestedAction = 'Generate a Personal Access Token at github.com/settings/tokens and add GITHUB_TOKEN to your .env file.';
        throw new GitHubApiException(summary);
    }

    if (status === 404) {
        summary.message = 'Target repository or endpoint could not be found.';
        summary.suggestedAction = 'Double-check the "owner/repo" string layout. Verify that the repository is public.';
        throw new GitHubApiException(summary);
    }

    if (status === 401) {
        summary.message = 'Authentication failed (401 Unauthorized).';
        summary.suggestedAction = 'The GITHUB_TOKEN supplied in your environment configuration is invalid or expired.';
        throw new GitHubApiException(summary);
    }

    if (status >= 500) {
        summary.message = `GitHub Platform Server Error (${status}).`;
        summary.suggestedAction = 'GitHub services are currently experiencing issues. Check status.github.com.';
    } else {
        summary.message = responseData?.message || `API Request rejected with status code ${status}.`;
    }

    throw new GitHubApiException(summary);
}