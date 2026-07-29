---
name: google-workspace-cli
description: Use when the user mentions Google Drive, Google Docs, Sheets, Slides, Gmail, Calendar, Google files, shared drives, or wants to search, read, create, or edit any Google Workspace content. Accesses Google Workspace via the `gws` CLI.
---

# Google Workspace CLI (`gws`)

The `gws` CLI talks to Google Drive, Docs, Sheets, Slides, Gmail and Calendar. Use it via the Shell
tool. If it isn't set up yet, do that first — every command below assumes an authenticated CLI.

## Setup — once, before anything below works

Everything `gws` does runs against one GCP project, and the project decides how painful the setup
is. Inside the **feverup.com** organisation the OAuth consent screen can be **Internal**, which means
no "unverified app" warning, no test-user list, and **refresh tokens that don't expire**. Outside it,
tokens die every ~7 days and everyone re-authenticates weekly.

So: get a project in the Fever org. The rest is short.

### Step 1 — find out whether you can create one

```bash
gcloud auth login                       # your @feverup.com account
gcloud organizations list               # expect: feverup.com  212482109203
gcloud projects create command-center-<yourname> --organization=212482109203
```

- **It works** → you have a project in the Fever org. Go to step 2.
- **`PERMISSION_DENIED`** → project creation is restricted, which is normal. Ask whoever administers
  Fever's GCP for either a project in org `212482109203`, or access to an existing shared one. You
  need `roles/owner` or at minimum rights to enable APIs and create an OAuth client on it. Everything
  below is the same once you have it.

Don't work around a denial by creating the project under a personal Google account — see
[Appendix: personal-project fallback](#appendix-personal-project-fallback) for why that costs more
than it saves.

### Step 2 — enable the APIs

```bash
gws auth setup --project command-center-<yourname>     # add --dry-run first to preview
```

This turns on the APIs the CLI needs. It **cannot** create the OAuth client — that part is always
manual.

### Step 3 — OAuth consent screen: Internal

In the [Cloud Console](https://console.cloud.google.com/), with your project selected:

**APIs & Services → OAuth consent screen → User type: Internal.**

Internal is the whole reason for using a Fever project. It restricts sign-in to feverup.com accounts,
which is what removes the verification warning and the 7-day token expiry. If **Internal** is greyed
out, the project is not in the org — go back to step 1.

### Step 4 — create the OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID → Desktop app**, then download
the JSON.

One client can serve the whole team: with an Internal consent screen there is no test-user list to
maintain, so sharing `client_secret.json` with a teammate is enough. Share it through a password
manager, not Slack — it contains a client secret.

### Step 5 — install and point the CLI at it

```bash
npm install -g @googleworkspace/cli
```

The config dir and the makefile wiring are already handled by the `/setup` skill — it runs
`.claude/scripts/setup/ensure-gws-config-dir.sh <name>`, which creates `~/.config/<name>/`, and
`generate-makefile.sh`, which bakes `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` into every make target. If
you've run `/setup`, you already have both; skip to dropping the client in.

Otherwise, do it by hand:

```bash
export GOOGLE_WORKSPACE_CLI_CONFIG_DIR="$HOME/.config/gws-command-center"
mkdir -p "$GOOGLE_WORKSPACE_CLI_CONFIG_DIR"
```

Either way, the downloaded client has to be placed by you — no script can do it:

```bash
mv ~/Downloads/client_secret_*.json "$GOOGLE_WORKSPACE_CLI_CONFIG_DIR/client_secret.json"
chmod 600 "$GOOGLE_WORKSPACE_CLI_CONFIG_DIR/client_secret.json"
```

An isolated config dir keeps this assistant's grants separate from any other `gws` use on the machine.
If the `export` isn't somewhere every session picks it up, `gws` silently falls back to its default dir
and looks unauthenticated.

The project binding lives **inside `client_secret.json`** (`installed.project_id`); there is no
separate setting. Swapping that file is how you move between projects.

### Step 6 — log in, and do **not** click the printed link

```bash
gws auth login
```

It prints a ~650-character URL and waits on a `localhost` callback. **Don't click it in the terminal
and don't copy-paste it.** The `scope` parameter contains `://` and encoded spaces, so terminal link
detection truncates the tail; the browser then arrives without `&response_type=code` and Google
answers *"Missing required parameter: response_type"*. The URL was generated correctly — it was
mangled in transit.

Run the login in the background so the callback listener stays alive, then open the URL verbatim:

```bash
open '<full-url>'        # macOS — xdg-open on Linux
```

Sign in with your **@feverup.com** account. With an Internal consent screen there's no unverified-app
warning to click through.

### Step 7 — verify

```bash
gws auth status     # auth_method should be oauth2, and project_id your project
gws gmail users getProfile --params '{"userId":"me"}'
```

If `project_id` isn't what you expect, the `client_secret.json` in your config dir came from a
different project — replace the file.

### Keyring backend — required for the dashboard

The dashboard runs `gws` with `GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file`, but a plain `gws auth
login` defaults to the OS keychain. A token stored the default way works on the command line and is
**invisible to the dashboard**. Authenticate with the file backend:

```bash
GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file gws auth login
```

## Keeping it working

**Re-auth only applies to the fallback.** With an **Internal** consent screen (a project in the
feverup.com org) refresh tokens do not expire — you log in once. If you ended up on the personal-project
fallback, the consent screen is *External + Testing* and tokens die after ~7 days; re-run
`gws auth login` with the same `open '<url>'` step when calls start failing on auth. That recurring
cost is the reason step 1 pushes for a Fever-org project.

**`--scopes` replaces the set — it does not add.** To gain one scope you must list every scope you
already hold plus the new one, or you silently lose the rest. Example: creating Gmail *filters* needs
`https://www.googleapis.com/auth/gmail.settings.basic`, which the default set omits — reading filters
works, creating them returns `403 insufficient authentication scopes`.

**Enable each API you actually use.** A `403 accessNotConfigured` means that API is off for the
project: enable it in the console and wait a minute. Tasks is the common one; Drive, Docs, Sheets,
Gmail and Calendar are usually on already.

**`--params` is query and path parameters only.** Request bodies go in `--json`. A body passed in
`--params` comes back as raw-HTML `411 POST requests require a Content-length header`, which looks
like a network fault but is a client-side mistake:

```bash
gws sheets spreadsheets values batchUpdate \
  --params '{"spreadsheetId":"..."}' \
  --json '{"valueInputOption":"USER_ENTERED","data":[...]}'
```

## Command Pattern

```
gws <service> <resource> <method> [flags]
```

## Common Flags

| Flag | Purpose |
|------|---------|
| `--params '{...}'` | Query/path parameters as JSON |
| `--json '{...}'` | Request body as JSON |
| `--dry-run` | Validate without sending |
| `--page-all` | Fetch all pages (NDJSON output) |
| `--page-limit N` | Limit pages fetched (default: 10) |
| `--format table` | Output as table (also: json, yaml, csv) |
| `--upload ./file` | Upload file with multipart request |

## Drive

### Search files

```bash
gws drive files list --params '{"q": "name contains '\''quarterly report'\''", "pageSize": 10}'
```

### List recent files

```bash
gws drive files list --params '{"pageSize": 10, "orderBy": "modifiedTime desc"}'
```

### List files in a folder

```bash
gws drive files list --params '{"q": "'\''FOLDER_ID'\'' in parents"}'
```

### List shared drives

```bash
gws drive drives list
```

### Get file metadata

```bash
gws drive files get --params '{"fileId": "FILE_ID"}'
```

### Upload a file

```bash
gws drive +upload ./report.pdf --parent FOLDER_ID
```

### Export Google Workspace files

```bash
# Doc as PDF
gws drive files export --params '{"fileId": "FILE_ID", "mimeType": "application/pdf"}' > doc.pdf

# Sheet as CSV
gws drive files export --params '{"fileId": "FILE_ID", "mimeType": "text/csv"}' > data.csv
```

### Advanced search queries

The `q` parameter supports operators:

| Query | Example |
|-------|---------|
| By name | `name contains 'budget'` |
| By type | `mimeType = 'application/vnd.google-apps.document'` |
| By owner | `'user@example.com' in owners` |
| Shared with me | `sharedWithMe` |
| Starred | `starred = true` |
| Modified after | `modifiedTime > '2026-01-01T00:00:00'` |
| Combined | `name contains 'budget' and mimeType = 'application/pdf'` |

MIME types for Google Workspace files:

| Type | MIME |
|------|------|
| Document | `application/vnd.google-apps.document` |
| Spreadsheet | `application/vnd.google-apps.spreadsheet` |
| Presentation | `application/vnd.google-apps.presentation` |
| Folder | `application/vnd.google-apps.folder` |
| Form | `application/vnd.google-apps.form` |

## Docs

### Read a document

```bash
gws docs documents get --params '{"documentId": "DOCUMENT_ID"}'
```

The response contains the full document structure with text content in `body.content[].paragraph.elements[].textRun.content`.

### Create a document

```bash
gws docs documents create --json '{"title": "Meeting Notes"}'
```

### Append text (helper)

```bash
gws docs +write --document DOCUMENT_ID --text 'Hello, world!'
```

### Batch update (insert, format, replace)

```bash
gws docs documents batchUpdate --params '{"documentId": "DOCUMENT_ID"}' --json '{
  "requests": [
    {"insertText": {"location": {"index": 1}, "text": "New heading\n"}},
    {"updateTextStyle": {"range": {"startIndex": 1, "endIndex": 12}, "textStyle": {"bold": true}, "fields": "bold"}}
  ]
}'
```

### Replace text

```bash
gws docs documents batchUpdate --params '{"documentId": "DOCUMENT_ID"}' --json '{
  "requests": [{"replaceAllText": {"containsText": {"text": "OLD", "matchCase": true}, "replaceText": "NEW"}}]
}'
```

## Sheets

### Read values

```bash
gws sheets +read --spreadsheet SPREADSHEET_ID --range 'Sheet1!A1:B10'
```

### Read full sheet

```bash
gws sheets spreadsheets values get --params '{"spreadsheetId": "SPREADSHEET_ID", "range": "Sheet1"}'
```

### Append rows (helper)

```bash
gws sheets +append --spreadsheet SPREADSHEET_ID --values 'Alice,100,true'
gws sheets +append --spreadsheet SPREADSHEET_ID --json-values '[["Alice",100],["Bob",200]]'
```

### Write values

```bash
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "SPREADSHEET_ID", "range": "Sheet1!A1:B2", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", "95"]]}'
```

### Create a spreadsheet

```bash
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'
```

### Get spreadsheet metadata

```bash
gws sheets spreadsheets get --params '{"spreadsheetId": "SPREADSHEET_ID"}'
```

## Gmail

### List recent messages

```bash
gws gmail users messages list --params '{"userId": "me", "maxResults": 10}'
```

### Read a message

```bash
gws gmail users messages get --params '{"userId": "me", "id": "MESSAGE_ID"}'
```

### Send an email (helper)

```bash
gws gmail +send --to user@example.com --subject "Hello" --body "Hi there!"
```

### Search messages

```bash
gws gmail users messages list --params '{"userId": "me", "q": "from:alice@example.com subject:report"}'
```

## Calendar

### List today's events

```bash
gws calendar events list --params '{"calendarId": "primary", "timeMin": "2026-03-28T00:00:00Z", "timeMax": "2026-03-28T23:59:59Z", "singleEvents": true, "orderBy": "startTime"}'
```

Note: replace the date values with the actual current date. `singleEvents: true` is required for `orderBy: startTime` to work and expands recurring events into individual instances.

### List upcoming events

```bash
gws calendar events list --params '{"calendarId": "primary", "timeMin": "2026-03-23T00:00:00Z", "maxResults": 10, "singleEvents": true, "orderBy": "startTime"}'
```

### Create an event (helper)

```bash
gws calendar +insert --calendar primary --summary "Team Standup" --start "2026-03-24T10:00:00" --end "2026-03-24T10:30:00"
```

### Get event details

```bash
gws calendar events get --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'
```

## Slides (Presentations)

### Get presentation

```bash
gws slides presentations get --params '{"presentationId": "PRESENTATION_ID"}'
```

### Create presentation

```bash
gws slides presentations create --json '{"title": "Q1 Review"}'
```

## Tips

- Always use the Shell tool to execute `gws` commands.
- Responses are JSON by default. Use `--format table` for human-readable output when displaying to the user.
- For large result sets, use `--page-all` with `--page-limit` to control volume.
- Use `--dry-run` before write operations to preview what will be sent.
- Use `gws <service> <resource> --help` to discover available methods for any API.
- Use `gws schema <service>.<resource>.<method>` to inspect the full API schema for a method.
- The CLI is authenticated against your Google account (run `gws auth login` if not yet done).
- For full documentation: https://googleworkspace-cli.mintlify.app/commands/overview


## Appendix: personal-project fallback

Only if a Fever-org project is genuinely unavailable. A project under a personal Google account
works, but every one of these is a recurring cost:

| | Fever org (Internal) | Personal project (External + Testing) |
|---|---|---|
| Refresh tokens | don't expire | **die every ~7 days** |
| "Unverified app" warning | none | every login |
| Test users | not applicable | must be added by hand, capped at 100 |
| Cross-account IAM | not needed | each user needs `roles/serviceusage.serviceUsageConsumer` on the project |

That last row is the one that wastes time: without the grant, every call fails with
`403 Caller does not have required permission to use project`, which reads like an authentication
problem but is IAM. Grant it per user:

```bash
gcloud projects add-iam-policy-binding <project-id> \
  --member="user:teammate@feverup.com" \
  --role="roles/serviceusage.serviceUsageConsumer"
```

It also makes whoever owns the personal project a permanent dependency for the whole team.
