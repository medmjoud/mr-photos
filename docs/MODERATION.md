# Moderation runbook

> ⚠️ **LEGAL REVIEW REQUIRED.** The procedures below — in particular the
> child-safety procedure, data retention and reporting obligations — must be
> reviewed by a lawyer for Mauritania and for every country where the service
> is hosted or operated before launch. They describe what the software does;
> they are not legal advice.

## Principles

- **Nothing is public without a human decision.** Every upload starts
  `pending` in private storage.
- **AI is advisory.** The pre-check only adds flags; by construction
  (`aiPatch` in `src/lib/moderation.ts`) it cannot change a photo's status. If
  the provider is missing, down, slow or errors, the photo stays pending and the
  queue shows “AI check unavailable/failed — full human review”.
- **Every action is logged** in the append-only moderation log
  (`/admin/log`), including automatic decisions (auto-hide, retention deletes,
  AI results).

## Daily review (`/admin/review`)

Filters: *Pending* (oldest first), *Urgent*, *AI-flagged*, *Failures*, *Hidden*.

For each photo check: subject and connection to Mauritania, quality
(sharp, well exposed, no screenshot, no heavy filter or large watermark),
people (consent, dignity; extra care when the uploader declared a minor),
rights (the review page warns when the same file already exists on another
account — a possible stolen image), and the AI flags.

- **Approve**: write the French alt text (required, ≥ 8 characters; Arabic and
  English optional). Optionally feature it on the home page.
- **Reject**: choose a reason (shown to the photographer) and an optional
  note. The file is deleted after `REJECTED_RETENTION_DAYS` (default 7).
- Potentially harmful previews are **blurred** until you click “Show preview”.

## Reports

- Every public photo has a “Report” button; `/report` hosts the takedown form
  (name + email required).
- When `REPORT_AUTOHIDE_THRESHOLD` distinct visitors (default 3) have open
  reports on a photo, it is **hidden automatically** until reviewed; its media
  token rotates and the CDN cache is purged when configured.
- A report with the reason **“Child sexual abuse”** hides the photo
  **immediately**, emails `MODERATION_ALERT_EMAIL`, and prevents the owner from
  deleting it until an admin decides.
- In `/admin/reports`: dismiss, resolve, or open the photo to hide, restore or
  remove it.

## Suspected child sexual abuse material (CSAM) — ⚠️ legal review required

If you suspect CSAM, **do not open, download, copy or share the image.** On the
photo's review page, use **“Procedure: suspected child sexual abuse”** and type
`CSAM` to confirm. The app then, immediately and irreversibly:

1. blocks all public access (status `removed`, hidden, media token rotated,
   CDN purge);
2. deletes every viewable derivative, so staff cannot browse it — the admin UI
   shows a lock instead of a preview and no download link;
3. moves the original to a `restricted/` storage prefix under **legal hold**
   (never served by the app, never deleted by the retention job);
4. suspends the uploader and revokes all their sessions (the account cannot be
   reinstated from the UI);
5. closes the related reports and logs the action with the file's SHA-256;
6. guarantees the file is **never sent to any AI provider** again;
7. blocks future uploads of the same file (hash match), logging the attempt.

Then follow the instructions shown at `/admin/child-safety`:

- report it without delay to the competent authorities (in Mauritania: the
  judicial police / juvenile unit or the public prosecutor; if the host or
  team is abroad, the national body there — e.g. PHAROS in France, NCMEC in
  the United States, or an INHOPE hotline) — **to be confirmed by counsel**;
- give the photo reference and SHA-256 from the log; hand over the file only on
  the authorities' written request and following their instructions (the
  original stays in the restricted prefix of the bucket; access to it must go
  through the hosting account owner, not the app);
- keep a record of the date and report number; do not tip off the account
  holder.

Open legal questions for counsel: mandatory reporting obligations and
deadlines; preservation period for the restricted original and the logs; who
may access the restricted prefix and how; whether the service should also use
a hash-matching service (e.g. Cloudflare's CSAM Scanning Tool for files served
through Cloudflare, or PhotoDNA).

## Accounts

`/admin/users`: search, suspend (with a reason — revokes sessions and removes
the account's photos from public listings), reinstate, feature a photographer.
Admins cannot suspend themselves or other admins; admins are created only with
`npm run admin:create`.

## Retention

`POST /api/cron/cleanup` (daily) deletes files of rejected/removed photos past
their deadline (never items under legal hold), expired sessions and tokens.
Analytics salts are deleted after two days.
