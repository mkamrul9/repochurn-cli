import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env first so GITHUB_TOKEN etc. are available
dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// .repochurnrc schema
// ─────────────────────────────────────────────────────────────────────────────
interface RepoChurnRc {
    days?: number;
    top?: number;
    format?: 'terminal' | 'json' | 'csv' | 'md';
    exclude?: string[];
    include?: string[];
    noSpinner?: boolean;
}

function loadRcFile(): RepoChurnRc {
    const rcPath = path.resolve(process.cwd(), '.repochurnrc');
    if (!fs.existsSync(rcPath)) return {};
    try {
        const raw = fs.readFileSync(rcPath, 'utf-8');
        return JSON.parse(raw) as RepoChurnRc;
    } catch {
        // Silently ignore malformed RC — the user will see CLI defaults
        return {};
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// App config — env vars merged with RC file defaults
// ─────────────────────────────────────────────────────────────────────────────
export interface AppConfig {
    githubToken: string | undefined;
    defaultTimeout: number;
    rc: RepoChurnRc;
}

export const config: AppConfig = {
    githubToken: process.env.GITHUB_TOKEN,
    defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '15000', 10),
    rc: loadRcFile(),
};

/** Default file patterns that are always ignored during churn analysis */
export const DEFAULT_IGNORE_PATTERNS: string[] = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',
    '.gitignore',
    '.editorconfig',
    'LICENSE',
    'CHANGELOG.md',
];