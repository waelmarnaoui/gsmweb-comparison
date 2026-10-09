# Deploy the demo to Vercel

This project is a Next.js application, not a static HTML upload. Deploy the source folder containing package.json. No environment variables are needed for the demo. The Supabase and Sheets APIs return a configuration error until connected; Android requests without credentials are rejected.

## From GitHub

1. Extract gsmweb-vercel.zip and upload the contents of the gsmweb folder to a GitHub repository. Include hidden files such as .gitignore and .vercelignore.
2. In Vercel, choose Add New > Project and import that repository.
3. Choose the Next.js framework preset. If package.json is at the repository root, leave Root Directory as the repository root. If you uploaded the enclosing gsmweb folder, choose gsmweb instead.
4. Leave Output Directory at the framework default. vercel.json supplies the dependency installation and build commands.
5. Deploy. The resulting URL runs the synthetic-data demo.

## Directly from your computer

With Node.js installed, open a terminal in the gsmweb folder and run:

```powershell
npx vercel login
npx vercel
```

Follow the account and project prompts. The second command creates a preview deployment and prints its URL. To publish the demo to the project's production URL afterward:

```powershell
npx vercel --prod
```

Vercel CLI accepts the source directory directly. The ZIP is a transfer package to extract or put in a Git repository; it is not a direct ZIP import into Vercel's project dashboard.

## Production integrations

Do not add real CRM data to this demo. Production sign-in and dashboard API wiring, the CRM schema adapter and approved database migration are still pending. See README.md and DATABASE-DESIGN.md for the activation boundary. No SQL migration runs during deployment.

After the production implementation is approved, configure credentials in Vercel's environment settings. Only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are public; SUPABASE_SERVICE_ROLE_KEY and Google credentials must remain server-only. No Ads upload is performed by this app.

References: https://vercel.com/docs/projects/deploy-from-cli and https://vercel.com/docs/cli/deploy
