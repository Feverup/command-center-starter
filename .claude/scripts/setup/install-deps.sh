#!/usr/bin/env bash
# Install dependencies, and translate the one failure that has actually happened
# into something the installer can act on.
#
# Usage: install-deps.sh
#
# Idempotent: pnpm install on an up-to-date tree is a no-op that exits 0.
#
# THE FAILURE THIS EXISTS FOR
#
# The @asucregonzalez/* packages are public on npm, so normally this just
# resolves. But package.json here pins version floors, and if the maintainer has
# bumped a floor without publishing that version yet, pnpm fails with
# ERR_PNPM_NO_MATCHING_VERSION — which reads like the installer did something
# wrong. They did not: it is a maintainer-side gap, and the fix is a publish, not
# anything on this machine. Saying so is the difference between a two-minute ping
# and an afternoon of debugging a clean checkout.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

LOG="$(mktemp -t cc-install.XXXXXX)"

echo "Installing dependencies (pnpm install)…"
if pnpm install 2>&1 | tee "$LOG"; then
  echo
  echo "OK — dependencies installed."
  rm -f "$LOG"
  exit 0
fi

echo
echo "──────────────────────────────────────────────────────────────"

if grep -qiE "ERR_PNPM_NO_MATCHING_VERSION|No matching version found" "$LOG"; then
  # Name the package if pnpm told us, so the message is specific.
  pkg=$(grep -oE '@asucregonzalez/[a-z-]+' "$LOG" | head -1)
  want=$(grep -oE 'No matching version found for [^ ]+@[^ ]+' "$LOG" | head -1)

  cat <<EOF
This is NOT your fault, and nothing on this machine will fix it.

  ${want:-A pinned dependency version does not exist on npm yet.}

package.json asks for a version of ${pkg:-an @asucregonzalez/* package} that has
not been published. The packages are public on npm, so there is no token or
permission involved — the version simply is not there.

Check what IS published:

  npm view ${pkg:-@asucregonzalez/section-tasks} versions --json

Then ask the maintainer (Andrea) to publish it:

  cd dashboard && ./scripts/release-packages.sh            # dry run
  cd dashboard && ./scripts/release-packages.sh --publish

Re-run /setup once they confirm. Full log: $LOG
EOF
  exit 2
fi

if grep -qiE "ERR_PNPM_UNSUPPORTED_ENGINE|Unsupported engine" "$LOG"; then
  echo "Node version is unsupported. Install Node 20+ (nvm install 20 && nvm use 20)"
  echo "and re-run /setup. Full log: $LOG"
  exit 3
fi

if grep -qiE "ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network" "$LOG"; then
  echo "Network problem reaching the npm registry. Check connectivity/VPN and retry."
  echo "Full log: $LOG"
  exit 4
fi

echo "pnpm install failed for a reason this script does not recognise."
echo "Read the log and report it rather than guessing: $LOG"
exit 1
