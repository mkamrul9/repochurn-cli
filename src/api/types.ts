// ─────────────────────────────────────────────────────────────────────────────
// GitHub REST API — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** High-level repository metadata returned by GET /repos/{owner}/{repo} */
export interface GitHubRepoInfo {
    full_name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    default_branch: string;
    created_at: string;
    pushed_at: string;
}

/** Single item from GET /repos/{owner}/{repo}/commits */
export interface GitHubCommitListItem {
    sha: string;
    commit: {
        author: {
            name: string;
            email: string;
            date: string;
        };
        message: string;
    };
    /** May be null when the git email is not linked to a GitHub account */
    author: {
        login: string;
        avatar_url: string;
    } | null;
}

/** File-level diff entry within a commit detail response */
export interface GitHubFileChange {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
    /** 'added' | 'removed' | 'modified' | 'renamed' | 'copied' */
    status: string;
    previous_filename?: string;
}

/** Full commit detail from GET /repos/{owner}/{repo}/commits/{sha} */
export interface GitHubCommitDetail {
    sha: string;
    commit: {
        message: string;
        author: {
            name: string;
            date: string;
        };
    };
    /** May be null for unlinked git emails */
    author: {
        login: string;
    } | null;
    stats?: {
        additions: number;
        deletions: number;
        total: number;
    };
    files?: GitHubFileChange[];
}

/** Single item from GET /repos/{owner}/{repo}/contributors */
export interface GitHubContributor {
    login: string;
    contributions: number;
    avatar_url: string;
    html_url: string;
}