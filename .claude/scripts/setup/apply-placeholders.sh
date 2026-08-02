#!/usr/bin/env bash
# Substitute {{NAME}}, {{EMAIL}}, {{GH_HANDLE}} — and any further profile tokens
# passed as KEY=VALUE — across the template's content files in a fresh clone.
#
# Usage: apply-placeholders.sh <name> <email> <gh_handle_or_empty> [TOKEN=value ...]
#
# Example:
#   apply-placeholders.sh "Ada Lovelace" ada@example.com adalovelace \
#     ROLE="Senior Backend Engineer" \
#     GOAL="Ship the billing rewrite by Q4" \
#     TEAM="Payments" TIMEZONE="Europe/Madrid" \
#     SLACK_ID=U0123456789 SLACK_CHANNELS="#payments-dev, #payments-alerts"
#
# The profile tokens are what make the skills fit YOUR situation rather than a
# generic one: {{ROLE}} and {{GOAL}} steer how the daily briefing prioritises,
# {{TEAM}}/{{TIMEZONE}}/{{SLACK_*}} fill in the per-source setup blocks. See
# CLAUDE.md's "Me" section for the full list and where each is used.
#
# Self-maintaining: targets are discovered with grep, not a hardcoded list, so
# adding or removing template files never requires editing this script.
#
# Safe to re-run: sed targets {{PLACEHOLDER}} tokens, so once replaced they
# won't match again. Passing "" for any value leaves its token intact for the
# user to fill in manually later.
#
# Excluded from substitution:
#   - README.md           (documents the placeholders as literal tokens)
#   - .claude/scripts/     (the setup machinery references the tokens in comments)
#   - .git/

set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <name> <email> <gh_handle_or_empty> [TOKEN=value ...]" >&2
  exit 64
fi

NAME="$1"
EMAIL="$2"
GH_HANDLE="$3"
shift 3

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

sed_inplace() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

substitute() {
  local placeholder="$1"; shift
  local value="$1"; shift
  local escaped
  escaped=$(printf '%s\n' "$value" | sed 's/[\&/]/\\&/g')
  local files
  files=$(grep -rlF "{{${placeholder}}}" . \
    --exclude-dir=.git \
    --exclude-dir=scripts \
    --exclude=README.md 2>/dev/null || true)
  [[ -z "$files" ]] && return 0
  while IFS= read -r file; do
    [[ -f "$file" ]] || continue
    sed_inplace "s/{{${placeholder}}}/${escaped}/g" "$file"
  done <<< "$files"
}

substitute NAME "$NAME"
substitute EMAIL "$EMAIL"

if [[ -n "$GH_HANDLE" ]]; then
  substitute GH_HANDLE "$GH_HANDLE"
fi

# Remaining args are extra profile tokens, as KEY=VALUE. An empty value is
# skipped so the token survives for a later pass.
for pair in "$@"; do
  if [[ "$pair" != *=* ]]; then
    echo "Expected TOKEN=value, got: $pair" >&2
    exit 64
  fi
  key="${pair%%=*}"
  value="${pair#*=}"
  if [[ ! "$key" =~ ^[A-Z][A-Z0-9_]*$ ]]; then
    echo "Invalid token name '$key' (expected UPPER_SNAKE_CASE)" >&2
    exit 64
  fi
  [[ -z "$value" ]] && continue
  substitute "$key" "$value"
done

echo "OK"
