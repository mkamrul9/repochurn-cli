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
    author: {
        login: string;
        avatar_url: string;
    } | null;
}

export interface GitHubFileChange {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
    status: string;
}

export interface GitHubCommitDetail {
    sha: string;
    commit: {
        message: string;
    };
    author: {
        login: string;
    } | null;
    files?: GitHubFileChange[];
}