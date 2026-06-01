# RepoChurn: The Codebase Velocity Oracle

RepoChurn is a CLI tool designed to solve the developer onboarding problem. When joining a new project, the GitHub UI shows a chronological list of commits, but it doesn't tell you *where* the codebase is actively churning. 

RepoChurn analyzes the last 30 days of commit history, maps file modifications, and outputs a formatted terminal dashboard of the top "Code Hotspots" and their primary "Knowledge Owners."

## How to Run (Fresh Machine Setup)

Follow these exact steps to run the tool on any fresh machine with Node.js (v18+) installed.

### 1. Install Dependencies
Clone the repository and install the required packages:
\`\`\`bash
npm install
\`\`\`

### 2. Configure the GitHub Token (Highly Recommended)
Unauthenticated GitHub API requests are strictly capped at 60 requests per hour. Because RepoChurn fetches deep commit metadata, you will hit this limit quickly.

1. Generate a Personal Access Token (Classic) at [GitHub Settings -> Tokens](https://github.com/settings/tokens). No specific scopes are required for public repositories.
2. Create a `.env` file in the root directory.
3. Add your token:
\`\`\`text
GITHUB_TOKEN=your_token_here
\`\`\`
*(This boosts your limit to 5,000 requests/hr).*

### 3. Build & Execute
Compile the TypeScript code and run the CLI against a public repository (format: `owner/repo`):

\`\`\`bash
npm run build
npm start vercel/next.js
\`\`\`

### Optional Flags
You can adjust the retrospective lookback window using the `-d` or `--days` flag (defaults to 30):
\`\`\`bash
npm start vercel/next.js -- -d 15
\`\`\`

##  Resiliency & Edge Cases Handled
* **Abuse Detection Throttling:** Network requests are batched concurrently (10 at a time) to prevent triggering GitHub's secondary abuse limits.
* **Rate Limit Diagnostic:** If the 403 Forbidden rate limit is hit, the app intercepts the header and outputs a human-readable countdown timer detailing exactly when the limit resets.
* **Ghost Commits:** Safely processes `null` authors (deleted accounts or unlinked local git configs) via nullish coalescing to prevent fatal runtime crashes mid-batch.