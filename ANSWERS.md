# Technical Assessment Answers

### 1. How to run
Getting this running on a fresh machine is pretty straightforward. You just need to have Node.js installed (v18 or higher works best). 

Here are the exact steps:
1. Clone this repo and install the packages by running:
   `npm install`
2. **Important:** GitHub strictly limits unauthenticated API calls to 60 per hour. Because this tool pulls a lot of data to figure out code churn, you will hit that limit almost instantly. To fix this, grab a Personal Access Token from your GitHub settings, create a `.env` file in the root folder, and add this line: `GITHUB_TOKEN=your_token_here`
3. Compile the code and run it against any public repo (like React):
   `npm run build`
   `npm start facebook/react`

If you want to look further back than the default 30 days, just add the days flag at the end, like this: `npm start facebook/react -- --days 15`

### 2. Stack choice
I went with a Node.js CLI built with TypeScript and Commander.js. 
I chose this because developer tools should be fast, native to the terminal, and get out of your way. TypeScript was kind of mandatory for me here because third-party API payloads (like GitHub's) are super unpredictable, and having strict types saved me from a lot of basic runtime errors while I was building it. 

The worst choice for this specific task would have been a full web framework like Next.js or React. Even though a visual dashboard looks cool, it's a terrible user experience for a simple script. Forcing someone to install heavy frontend dependencies, wait for a dev server to spin up, and open a browser just to see some text data is complete overkill. A CLI just makes more sense for this.

### 3. One real edge case
The edge case I'm most proud of catching is the "Ghost Commit" issue. You can find my fix for this in `src/core/analyzer.ts` right around line 42.

Basically, if someone pushes code and later deletes their GitHub account, or if they push from a weirdly configured local terminal that isn't linked to an email, GitHub still returns the commit data. But, the `author` object is literally just `null`. 

If I didn't handle this, the second my script hit one of those commits and tried to read `detail.author.login` to map out the knowledge owners, the whole app would throw a fatal `TypeError` and crash immediately in the middle of a batch process. I fixed it by using optional chaining and a nullish coalescing fallback to assign those commits to a generic "Ghost Contributor" bucket so the math keeps running smoothly.

### 4. AI usage
I used Gemini a few times, mostly as a sounding board to figure out the best way to handle rate limits and concurrency without writing a bunch of boilerplate. 

* **First prompt:** I asked it, "Design an algorithm to calculate code churn from the GitHub commits API without cloning the repo, keeping performance under 2 seconds." 
  * **What it gave:** It spit out a standard `for...of` loop that fetched every single commit detail one by one. 
  * **What I changed & why:** I actually threw that code out. Doing sequential API calls creates a massive network waterfall and is incredibly slow. Instead, I built a custom throttling function (`src/utils/concurrency.ts`) using `Promise.all` so I could fetch 10 commits concurrently. This made the CLI super fast but kept it under GitHub's abuse limits.
* **Second prompt:** I asked it how to parse the GitHub rate limit headers into a readable countdown clock.
  * **What it gave:** It told me to just wrap the header in a date object like `new Date(headers['x-ratelimit-reset'])`.
  * **What I changed & why:** The AI was wrong. GitHub returns that specific header in Unix *seconds*, but JavaScript's Date object expects *milliseconds*. If I used the AI's code, my terminal would tell the user their rate limit resets in the year 1970. I added a `* 1000` multiplier to fix the math.

### 5. Honest gap
Honestly, the biggest flaw right now is that to keep the tool blazing fast (and to avoid getting IP banned by GitHub), I hard-capped the deep file analysis to the 50 most recent commits. If you run this on a massive, highly active repo, 50 commits might only represent yesterday's work, completely missing the actual 30-day window you asked for.

If I had another day to work on this, I would build a local SQLite cache. Instead of fetching everything live over the network every single time you hit enter, I'd have the CLI pull the commits slowly in the background, save them to the local disk, and run the calculations locally. That way, you could analyze thousands of commits instantly after the initial download, making the tool way more accurate for enterprise repos.