import axios, { AxiosInstance } from 'axios';
import { config } from '../utils/config.js';
import { GitHubCommitListItem, GitHubCommitDetail } from './types.js';

class GitHubClient {
    private instance: AxiosInstance;

    constructor() {
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            // GitHub API platform strictly requires a valid User-Agent header
            'User-Agent': 'RepoChurn-CLI-Oracle/1.0.0',
        };

        if (config.githubToken) {
            headers['Authorization'] = `Bearer ${config.githubToken}`;
        }

        this.instance = axios.create({
            baseURL: 'https://api.github.com',
            timeout: config.defaultTimeout,
            headers,
        });
    }

    /**
     * Fetches a list of public commits for a target repository within a lookback boundary
     */
    async getCommits(owner: string, repo: string, sinceISO: string): Promise<GitHubCommitListItem[]> {
        const response = await this.instance.get<GitHubCommitListItem[]>(
            `/repos/${owner}/${repo}/commits`,
            {
                params: {
                    since: sinceISO,
                    per_page: 100, // Pull maximum allowed limit per page to limit network hops
                },
            }
        );
        return response.data;
    }

    /**
     * Fetches full structural diff metadata for an individual commit hash
     */
    async getCommitDetails(owner: string, repo: string, sha: string): Promise<GitHubCommitDetail> {
        const response = await this.instance.get<GitHubCommitDetail>(
            `/repos/${owner}/${repo}/commits/${sha}`
        );
        return response.data;
    }
}

export const github = new GitHubClient();