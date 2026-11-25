# Meddy: setup in 10 minutes

## A. Put it online (free)
1. Unzip this folder. Open github.com -> New repository -> name it `meddy` -> Create.
2. Click "uploading an existing file", drag EVERYTHING from inside the unzipped folder
   (index.html, api, models, sw.js, manifest.webmanifest, icon.svg, package.json, vercel.json) -> Commit.
   (Files must be at the top level of the repo, not inside a subfolder.)
3. Go to vercel.com -> sign in with GitHub -> Add New -> Project -> pick `meddy` -> Framework: "Other" -> Deploy.
4. Open the link Vercel gives you. The Atlas, quizzes, flashcards, notes work already.

## B. Turn the AI on (FREE, no card needed)
1. Go to aistudio.google.com -> sign in with Google -> "Get API key" -> Create key -> copy it.
2. Vercel -> your project -> Settings -> Environment Variables -> add:
   Name: GEMINI_API_KEY   Value: (paste key)   -> Save.
3. Vercel -> Deployments -> the latest -> "..." -> Redeploy.
4. Test: open YOUR-LINK/api/chat -> it should say "POST only". Then open the Meddy tab and say hi.
Notes: the free tier has per-minute and per-day limits set by Google (see AI Studio -> rate limits); when it runs out
the app says "free AI quota is used up" and everything else keeps working. Google may use free-tier prompts to improve
its products, so don't type private information.
Backup free option: console.groq.com -> create key -> in Vercel add PROVIDER=groq and GROQ_API_KEY=(key).
Paid option (best quality): PROVIDER=anthropic and ANTHROPIC_API_KEY=(key from console.anthropic.com).

## C. Spending limits (already built in)
- 40 AI messages per person per day, 1,000 per day for the whole site. Resets at midnight UTC.
- Change them with env vars: DAILY_LIMIT and GLOBAL_DAILY_LIMIT (then redeploy).
- On the free options you cannot be charged. If you switch to the paid option, set a monthly spend limit in the console.
- Make the limits reliable (free): upstash.com -> create a Redis database -> copy the REST URL and REST TOKEN ->
  add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel -> redeploy.
  Without Upstash the counters reset whenever Vercel restarts the function.
- Keep strangers out: add env var ACCESS_CODE = any secret word. The app will ask for it once on each device.

## D. Install on your phone
Open the link in Chrome/Safari -> Share/menu -> "Add to Home Screen". After the first visit the atlas works offline
(open the Atlas once on Wi-Fi so the models download; ~50 MB).

## Troubleshooting
- Atlas says "Models not found": the `models` folder must be at the repo root next to index.html.
- AI says "Server missing ANTHROPIC_API_KEY": you forgot step B3 (redeploy after adding the key).
- AI says "AI backend not found": `api/chat.js` was not uploaded at the root.
- Changes not showing: reload twice (the offline cache updates in the background).
- Never paste your API key into index.html or share it.
