# Call sync update 0.3.1

Install the updated APK over the existing tracker to preserve the device token.
Open the app and enable automatic sync. If the app reports battery optimization,
use Battery and background settings and choose unrestricted battery/background
usage for GSMWeb Call Tracker. Manufacturer-specific auto-start settings may
also need enabling. Do not force-stop the tracker; Android prevents background
work for force-stopped apps until they are opened again.

The update checks saved periodic work when reopened, queues a catch-up upload
if the last successful sync was over 30 minutes ago, records successful sync
times and flags a delay over an hour. Its network-constrained WorkManager task
is scheduled every 30 minutes, but Android Doze and battery restrictions mean
exact half-hour execution cannot be guaranteed. Offline runs resume when the
network constraint is satisfied. No exact-alarm or new sensitive permission is
requested. No always-running foreground service is introduced.

International numbers must have + or 00 and their country code. Romanian local
numbers continue to work. Hidden callers, short codes and ambiguous foreign
local numbers are not guessed. The matching and CSV hashing use the same format.
Previously skipped foreign calls can be replayed with Import history from
24 September after the server update is installed.

Server prerequisites: apply INTERNATIONAL-PHONES-PROPOSED.sql only to the call
database after owner approval, update the smooth-function source, and deploy
the web app normalization update. The CRM database is not modified.

This Android schedule is separate from web app Sheets imports, CRM comparison
and Ads delivery. No unattended web/Ads scheduler is activated by this APK.
Vercel Hobby cannot run a half-hour Vercel cron; an external scheduler is needed.

https://developer.android.com/reference/androidx/work/PeriodicWorkRequest
https://vercel.com/docs/cron-jobs/usage-and-pricing

