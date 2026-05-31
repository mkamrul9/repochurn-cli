import dotenv from 'dotenv';

// Load environment variables from the root .env file
dotenv.config();

export interface AppConfig {
    githubToken: string | undefined;
    defaultTimeout: number;
}

export const config: AppConfig = {
    githubToken: process.env.GITHUB_TOKEN,
    defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '10000', 10),
};