import { github } from '../api/github.js';
import { GitHubRepoInfo } from '../api/types.js';
import { processInBatches } from '../utils/concurrency.js';
import { DEFAULT_IGNORE_PATTERNS } from '../utils/config.js';
import { Spinner } from '../utils/spinner.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** The category of a file, inferred from its extension */
export type FileCategory = 'source' | 'test' | 'config' | 'docs' | 'other';

/** Contribution stats for a single GitHub user within the analysis window */
export interface ContributorStats {
    login: string;
    commits: number;
    additions: number;
    deletions: number;
}

/** File-level churn hotspot with enriched metadata */
export interface FileHotspot {
    filename: string;
    category: FileCategory;
    /** Total lines touched: additions + deletions + changes */
    totalChurn: number;
    additions: number;
    deletions: number;
    /** Number of distinct commits that touched this file */
    commitCount: number;
    /** Unique GitHub logins that modified this file */
    authors: string[];
    /**
     * Bus-factor risk score (0–100).
     * Higher = riskier. Formula: churn × (1 / uniqueAuthors).
     * Normalised to 100 after ranking.
     */
    riskScore: number;
}

/** Weekly commit count bucket for velocity sparkline */
export interface WeeklyBucket {
    /** ISO week label: "YYYY-Www" */
    week: string;
    commits: number;
}

/** Full analysis report returned by analyzeRepository() */
export interface AnalysisReport {
    repoInfo: GitHubRepoInfo | null;
    commitCount: number;
    analyzedCommits: number;
    hotspots: FileHotspot[];
    contributors: ContributorStats[];
    weeklyVelocity: WeeklyBucket[];
    totalAdditions: number;
    totalDeletions: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis options
// ─────────────────────────────────────────────────────────────────────────────
export interface AnalyzeOptions {
    /** Maximum hotspot files to return (default 10) */
    topN?: number;
    /** Extra glob-like substrings to skip (checked with String.includes) */
    excludePatterns?: string[];
    /** Whether to show spinner output */
    spinner?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Derives a FileCategory from a filename */
function categoriseFile(filename: string): FileCategory {
    const lower = filename.toLowerCase();
    const ext = lower.split('.').pop() ?? '';

    if (
        lower.includes('test') ||
        lower.includes('spec') ||
        lower.includes('__tests__') ||
        lower.endsWith('.test.ts') ||
        lower.endsWith('.spec.ts') ||
        lower.endsWith('.test.js') ||
        lower.endsWith('.spec.js')
    ) return 'test';

    if (
        ['json', 'yaml', 'yml', 'toml', 'ini', 'env', 'cfg', 'config', 'lock'].includes(ext) ||
        lower.startsWith('.') ||
        lower.includes('config') ||
        lower.includes('rc')
    ) return 'config';

    if (['md', 'mdx', 'rst', 'txt', 'adoc'].includes(ext)) return 'docs';

    if (
        ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'rs', 'java', 'kt',
            'swift', 'c', 'cpp', 'h', 'cs', 'php', 'dart', 'vue', 'svelte'].includes(ext)
    ) return 'source';

    return 'other';
}

/** Returns the ISO year-week string for a given date, e.g. "2024-W03" */
function toIsoWeek(dateStr: string): string {
    const d = new Date(dateStr);
    // ISO week: Thursday of the week determines the year
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const weekNumber = Math.ceil(((d.getTime() - startOfWeek1.getTime()) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/** Checks if a filename should be skipped */
function shouldIgnore(filename: string, ignoreList: string[]): boolean {
    const lower = filename.toLowerCase();
    return ignoreList.some((pattern) => lower.includes(pattern.toLowerCase()));
}

/** Normalises raw risk values into a 0–100 scale */
function normaliseRiskScores(hotspots: Map<string, Omit<FileHotspot, 'riskScore'> & { rawRisk: number }>): FileHotspot[] {
    const items = Array.from(hotspots.values());
    const maxRisk = Math.max(...items.map((h) => h.rawRisk), 1);
    return items.map(({ rawRisk, ...rest }) => ({
        ...rest,
        riskScore: Math.round((rawRisk / maxRisk) * 100),
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeRepository(
    owner: string,
    repo: string,
    sinceISO: string,
    options: AnalyzeOptions = {},
): Promise<AnalysisReport> {
    const { topN = 10, excludePatterns = [], spinner: useSpinner = true } = options;
    const spinner = new Spinner('Initializing…', useSpinner);
    const ignoreList = [...DEFAULT_IGNORE_PATTERNS, ...excludePatterns];

    // ── Phase 1: Repo metadata ─────────────────────────────────────────────
    spinner.start();
    spinner.setLabel('Fetching repository metadata…');
    let repoInfo: GitHubRepoInfo | null = null;
    try {
        repoInfo = await github.getRepoInfo(owner, repo);
    } catch {
        // Non-fatal — we can still do churn analysis without metadata
    }

    // ── Phase 2: Commit list ───────────────────────────────────────────────
    spinner.setLabel('Loading commit history…');
    const commitList = await github.getCommits(owner, repo, sinceISO);

    if (commitList.length === 0) {
        spinner.info('No commits found in the specified timeframe.');
        return {
            repoInfo,
            commitCount: 0,
            analyzedCommits: 0,
            hotspots: [],
            contributors: [],
            weeklyVelocity: [],
            totalAdditions: 0,
            totalDeletions: 0,
        };
    }

    // Cap deep-analysis at 100 commits for speed; full list feeds velocity chart
    const targetCommits = commitList.slice(0, 100);
    spinner.setLabel(`Deep-analyzing ${targetCommits.length} of ${commitList.length} commits…`);

    // ── Phase 3: Weekly velocity (from commit list — no extra API calls) ───
    const weekMap = new Map<string, number>();
    for (const c of commitList) {
        const week = toIsoWeek(c.commit.author.date);
        weekMap.set(week, (weekMap.get(week) ?? 0) + 1);
    }
    const weeklyVelocity: WeeklyBucket[] = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, commits]) => ({ week, commits }));

    // ── Phase 4: Deep commit analysis (throttled batches of 10) ───────────
    type HotspotAccumulator = Omit<FileHotspot, 'riskScore'> & { rawRisk: number };
    const fileMap = new Map<string, HotspotAccumulator>();
    const contributorMap = new Map<string, ContributorStats>();
    let totalAdditions = 0;
    let totalDeletions = 0;

    const commitDetails = await processInBatches(targetCommits, 10, async (item) =>
        github.getCommitDetails(owner, repo, item.sha),
    );

    for (const detail of commitDetails) {
        const authorLogin = detail.author?.login ?? detail.commit.author.name ?? 'Ghost Contributor';

        // Aggregate contributor-level stats
        const contrib = contributorMap.get(authorLogin) ?? {
            login: authorLogin,
            commits: 0,
            additions: 0,
            deletions: 0,
        };
        contrib.commits++;
        contrib.additions += detail.stats?.additions ?? 0;
        contrib.deletions += detail.stats?.deletions ?? 0;
        contributorMap.set(authorLogin, contrib);

        totalAdditions += detail.stats?.additions ?? 0;
        totalDeletions += detail.stats?.deletions ?? 0;

        if (!detail.files) continue;

        for (const file of detail.files) {
            if (shouldIgnore(file.filename, ignoreList)) continue;

            const churn = file.additions + file.deletions + file.changes;
            const existing = fileMap.get(file.filename);

            if (existing) {
                existing.totalChurn += churn;
                existing.additions += file.additions;
                existing.deletions += file.deletions;
                existing.commitCount++;
                if (!existing.authors.includes(authorLogin)) {
                    existing.authors.push(authorLogin);
                }
                // Risk: churn / unique authors (bus factor signal)
                existing.rawRisk = existing.totalChurn / existing.authors.length;
            } else {
                fileMap.set(file.filename, {
                    filename: file.filename,
                    category: categoriseFile(file.filename),
                    totalChurn: churn,
                    additions: file.additions,
                    deletions: file.deletions,
                    commitCount: 1,
                    authors: [authorLogin],
                    rawRisk: churn,
                });
            }
        }
    }

    // ── Phase 5: Rank and normalise ────────────────────────────────────────
    spinner.setLabel('Ranking hotspots…');
    const allHotspots = normaliseRiskScores(fileMap)
        .sort((a, b) => b.totalChurn - a.totalChurn)
        .slice(0, topN);

    const contributors = Array.from(contributorMap.values())
        .sort((a, b) => b.commits - a.commits);

    spinner.succeed(`Analyzed ${targetCommits.length} commits across ${fileMap.size} files.`);

    return {
        repoInfo,
        commitCount: commitList.length,
        analyzedCommits: targetCommits.length,
        hotspots: allHotspots,
        contributors,
        weeklyVelocity,
        totalAdditions,
        totalDeletions,
    };
}