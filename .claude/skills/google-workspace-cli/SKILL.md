---
name: google-workspace-cli
description: Use when the user mentions Google Drive, Google Docs, Sheets, Slides, Gmail, Calendar, Google files, shared drives, or wants to search, read, create, or edit any Google Workspace content. Accesses Google Workspace via the `gws` CLI.
---

# Google Workspace CLI (`gws`)

The `gws` CLI talks to Google Drive, Docs, Sheets, Slides, Gmail and Calendar. Use it via the Shell
tool. If it isn't set up yet, do that first — every command below assumes an authenticated CLI.

## Setup — once, before anything below works

### 1. Install

```bash
npm install -g @googleworkspace/cli
gws --version
```

### 2. Create an OAuth client

`gws auth setup` enables the APIs it needs, but it **cannot create the OAuth client** — that part is
manual, in the [Google Cloud Console](https://console.cloud.google.com/):

1. Create or pick a GCP project.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
3. Application type: **Desktop app**.
4. Download the JSON.

### 3. Give it an isolated config dir

Keeps this assistant's grants separate from any other `gws` use on the machine:

```bash
export GOOGLE_WORKSPACE_CLI_CONFIG_DIR="$HOME/.config/gws-command-center"
mkdir -p "$GOOGLE_WORKSPACE_CLI_CONFIG_DIR"
mv ~/Downloads/client_secret_*.json "$GOOGLE_WORKSPACE_CLI_CONFIG_DIR/client_secret.json"
chmod 600 "$GOOGLE_WORKSPACE_CLI_CONFIG_DIR/client_secret.json"
```

Put that `export` somewhere every session picks it up (your shell profile, or the `makefile`'s run
target) — otherwise `gws` silently uses the default config dir and looks unauthenticated.

### 4. If the project and the account belong to different organisations

Signing in with a work account while the OAuth client lives in a personal project (or the reverse)
needs one IAM grant: give the signing-in account **`roles/serviceusage.serviceUsageConsumer`** on the
project. Without it every call fails with `403 Caller does not have required permission to use
project` — which reads like an auth problem but is IAM.

### 5. Log in — do **not** click the printed link

```bash
gws auth login
```

It prints a ~600-character URL and waits on a `localhost` callback. **Don't click it in the terminal
and don't copy-paste it.** The `scope` parameter contains `://` and encoded spaces, so terminal link
detection truncates the tail; the browser then arrives without `&response_type=code` and Google
answers *"Missing required parameter: response_type"*. That looks like a broken client, but the URL
was generated correctly and mangled in transit.

Run the login in the background so the callback listener stays alive, read the URL it printed, then
open it verbatim:

```bash
open '<full-url>'        # macOS — xdg-open on Linux
```

Sign in, accept the "unverified app" warning (expected while the consent screen is in *Testing*), and
approve.

### 6. Verify

```bash
gws gmail users getProfile --params '{"userId":"me"}'
```

## Keeping it working

**Re-auth about weekly.** While the OAuth consent screen is in *Testing*, refresh tokens expire after
~7 days. When calls start failing on auth, re-run `gws auth login` with the same `open '<url>'` step.
Publishing the consent screen removes the expiry but requires Google verification.

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
