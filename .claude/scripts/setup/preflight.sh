#!/usr/bin/env bash
# Check the machine can run this before /setup starts changing files.
#
# Usage: preflight.sh
#
# Exits 0 if everything needed is present, 1 otherwise — and on failure prints
# the FIX, not just the finding. A preflight that says "pnpm not found" and stops
# has moved the problem rather than solved it.
#
# Deliberately runs first: every later step writes something (placeholders, a
# generated makefile, a git re-init), and discovering a missing toolchain halfway
# through leaves a half-configured repo.

set -uo pipefail   # not -e: we want to collect ALL problems, not stop at the first

fail=0
note() { printf '  %s\n' "$1"; }
bad()  { printf '  ✗ %s\n' "$1"; fail=1; }
ok()   { printf '  ✓ %s\n' "$1"; }

echo "Preflight:"

# --- Node ---
if ! command -v node >/dev/null 2>&1; then
  bad "node not found."
  note "    Install Node 20 or newer: https://nodejs.org  (or: brew install node)"
else
  major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  if [[ "$major" -lt 20 ]]; then
    bad "node $(node -v) is too old — this needs 20 or newer."
    note "    nvm install 20 && nvm use 20   (or upgrade via your package manager)"
  else
    ok "node $(node -v)"
  fi
fi

# --- pnpm ---
# The workspace is pnpm. npm install produces a broken tree here rather than
# failing loudly, which is a much worse outcome than not being installed at all.
if ! command -v pnpm >/dev/null 2>&1; then
  bad "pnpm not found — this workspace is pnpm, and npm install will NOT work."
  note "    corepack enable && corepack prepare pnpm@latest --activate"
  note "    (or: npm install -g pnpm)"
else
  ok "pnpm $(pnpm --version)"
fi

# --- git ---
if ! command -v git >/dev/null 2>&1; then
  bad "git not found."
  note "    xcode-select --install   (macOS)   |   apt install git   (Debian/Ubuntu)"
else
  ok "git $(git --version | awk '{print $3}')"
fi

# --- optional, reported but never fatal ---
echo "Optional:"
command -v gws >/dev/null 2>&1 \
  && ok "gws $(gws --version 2>/dev/null | head -1)" \
  || note "  – gws not installed — Google Workspace steps will be skipped. npm install -g @googleworkspace/cli"
command -v gh >/dev/null 2>&1 \
  && ok "gh $(gh --version 2>/dev/null | head -1 | awk '{print $3}')" \
  || note "  – gh not installed — the GitHub account pin step will be skipped."
command -v rtk >/dev/null 2>&1 \
  && ok "rtk $(rtk --version 2>/dev/null | awk '{print $2}')" \
  || note "  – rtk not installed (recommended, global): compresses bash output before the agent reads it."

if [[ "$fail" -ne 0 ]]; then
  echo
  echo "Preflight FAILED — install the missing tools above, then re-run /setup."
  exit 1
fi

echo
echo "OK — preflight passed."
