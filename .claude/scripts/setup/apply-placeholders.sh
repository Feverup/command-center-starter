#!/usr/bin/env bash
# Substitute {{NAME}}, {{EMAIL}}, and {{GH_HANDLE}} across the template's
# content files in a fresh clone.
#
# Usage: apply-placeholders.sh <name> <email> <gh_handle_or_empty>
#
# Self-maintaining: targets are discovered with grep, not a hardcoded list, so
# adding or removing template files never requires editing this script.
#
# Safe to re-run: sed targets {{PLACEHOLDER}} tokens, so once replaced they
# won't match again. Passing "" for gh_handle leaves {{GH_HANDLE}} intact for
# the user to fill in manually later.
#
# Excluded from substitution:
#   - README.md           (documents the placeholders as literal tokens)
#   - .claude/scripts/     (the setup machinery references the tokens in comments)
#   - .git/

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <name> <email> <gh_handle_or_empty>" >&2
  exit 64
fi

NAME="$1"
EMAIL="$2"
GH_HANDLE="$3"

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

echo "OK"
