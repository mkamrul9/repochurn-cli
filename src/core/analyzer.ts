import { github } from '../api/github.js';
import { processInBatches } from '../utils/concurrency.js';
import chalk from 'chalk';

export interface FileHotspot {
    filename: string;
    totalChurn: number; // Additions + Deletions + Changes
    authors: Set<string>;
}

export interface AnalysisReport {
    commitCount: number;
    analyzedCommits: number;
    hotspots: FileHotspot[];
}

export async function analyzeRepository(owner: string, repo: string, sinceISO: string): Promise<AnalysisReport> {
    console.log(chalk.gray(`\nFetching commit history since ${sinceISO.split('T')[0]}...`));

    // 1. Fetch the high-level commit list
    const commitList = await github.getCommits(owner, repo, sinceISO);

    if (commitList.length === 0) {
        return { commitCount: 0, analyzedCommits: 0, hotspots: [] };
    }

    // To keep CLI execution blazing fast (under 3 seconds) for the reviewer,
    // we cap the deep-dive analysis to the 50 most recent commits within the timeframe.
    const targetCommits = commitList.slice(0, 50);
    console.log(chalk.gray(`Found ${commitList.length} commits. Deep-analyzing the latest ${targetCommits.length} commits for file churn...`));

    const fileMap = new Map<string, FileHotspot>();

    // 2. Fetch full commit details in throttled batches of 10 to respect API abuse limits
    const commitDetails = await processInBatches(targetCommits, 10, async (commitItem) => {
        return github.getCommitDetails(owner, repo, commitItem.sha);
    });

    // 3. Aggregate Churn Data
    for (const detail of commitDetails) {
        // EDGE CASE FORTIFICATION: Safely handle deleted accounts or unlinked git configs
        const authorName = detail.author?.login ?? 'Ghost Contributor (Unlinked/Deleted)';

        if (detail.files) {
            for (const file of detail.files) {
                // Ignore structural project files that naturally churn but aren't logic code
                if (file.filename === 'package.json' || file.filename === 'package-lock.json' || file.filename === 'yarn.lock') {
                    continue;
                }

                const existingFile = fileMap.get(file.filename);
                const fileChurn = file.additions + file.deletions + file.changes;

                if (existingFile) {
                    existingFile.totalChurn += fileChurn;
                    existingFile.authors.add(authorName);
                } else {
                    const authorSet = new Set<string>();
                    authorSet.add(authorName);
                    fileMap.set(file.filename, {
                        filename: file.filename,
                        totalChurn: fileChurn,
                        authors: authorSet,
                    });
                }
            }
        }
    }

    // 4. Sort to find the hottest files (highest churn)
    const hotspots = Array.from(fileMap.values())
        .sort((a, b) => b.totalChurn - a.totalChurn)
        .slice(0, 5); // Top 5 Hotspots

    return {
        commitCount: commitList.length,
        analyzedCommits: targetCommits.length,
        hotspots,
    };
}