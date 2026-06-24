import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../utils/config.js';
import { handleGitHubApiError } from './errorHandler.js';
import {
    GitHubCommitListItem,
    GitHubCommitDetail,
    GitHubRepoInfo,
    GitHubContributor,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Retry configuration
// ─────────────────────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

/**
 * Executes an async function with exponential-backoff retry on transient failures.
 * Only retries on network errors or 5xx responses; never on 4xx client errors.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastError = err;
            const isRetryable =
                err instanceof Error &&
                (err.message.includes('5') || err.message.includes('network') || err.message.includes('timeout'));
            if (!isRetryable || attempt === MAX_RETRIES) throw err;
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            await new Promise((res) => setTimeout(res, delay));
        }
    }
    throw lastError;
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub API client
// ─────────────────────────────────────────────────────────────────────────────
class GitHubClient {
    private instance: AxiosInstance;

    constructor() {
        const headers: Record<string, string> = {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'RepoChurn-CLI/2.0.0 (https://github.com/mkamrul9/repochurn-cli)',
        };

        if (config.githubToken) {
            headers['Authorization'] = `Bearer ${config.githubToken}`;
        }

        this.instance = axios.create({
            baseURL: 'https://api.github.com',
            timeout: config.defaultTimeout,
            headers,
        });

        this.instance.interceptors.response.use(
            (response) => response,
            (error) => handleGitHubApiError(error),
        );
    }

    // ── Repo metadata ──────────────────────────────────────────────────────

    /** Fetches high-level repository metadata (language, stars, open issues…) */
    async getRepoInfo(owner: string, repo: string): Promise<GitHubRepoInfo> {
        return withRetry(async () => {
            const res = await this.instance.get<GitHubRepoInfo>(`/repos/${owner}/${repo}`);
            return res.data;
        });
    }

    // ── Commits ───────────────────────────────────────────────────────────

    /**
     * Fetches ALL commits since `sinceISO`, transparently following Link-header
     * pagination up to `maxCommits` (default 500) to avoid runaway pulls.
     */
    async getCommits(
        owner: string,
        repo: string,
        sinceISO: string,
        maxCommits = 500,
    ): Promise<GitHubCommitListItem[]> {
        return withRetry(async () => {
            const allCommits: GitHubCommitListItem[] = [];
            let url: string | null = `/repos/${owner}/${repo}/commits`;
            let params: Record<string, string | number> = { since: sinceISO, per_page: 100 };

            while (url && allCommits.length < maxCommits) {
                const res: AxiosResponse<GitHubCommitListItem[]> = await this.instance.get(url, {
                    params,
                });
                allCommits.push(...res.data);

                // Follow GitHub's Link header for the next page
                const linkHeader = res.headers['link'] as string | undefined;
                const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
                if (nextMatch) {
                    // The full next URL includes query params — pass it as-is
                    url = nextMatch[1];
                    params = {}; // params are already baked into the next URL
                } else {
                    url = null;
                }
            }

            return allCommits.slice(0, maxCommits);
        });
    }

    /**
     * Fetches full structural diff metadata for an individual commit hash.
     */
    async getCommitDetails(owner: string, repo: string, sha: string): Promise<GitHubCommitDetail> {
        return withRetry(async () => {
            const res = await this.instance.get<GitHubCommitDetail>(
                `/repos/${owner}/${repo}/commits/${sha}`,
            );
            return res.data;
        });
    }

    // ── Contributors ──────────────────────────────────────────────────────

    /**
     * Fetches the repository's contributor list (login + contribution count).
     * Limited to the first page (100) for speed — sufficient for most repos.
     */
    async getContributors(owner: string, repo: string): Promise<GitHubContributor[]> {
        return withRetry(async () => {
            const res = await this.instance.get<GitHubContributor[]>(
                `/repos/${owner}/${repo}/contributors`,
                { params: { per_page: 100 } },
            );
            return res.data;
        });
    }
}

export const github = new GitHubClient();