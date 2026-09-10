#!/usr/bin/env bash
# Move every dependency in an npm scope to its newest release, and say plainly
# when a newer release exists but was not installed — pnpm withholds recent
# releases and reports "Already up to date", which is indistinguishable from
# there being nothing to do.
#
# Usage: update-sections.sh [scope]

set -euo pipefail

SCOPE="${1:-@asucregonzalez}"

if [[ ! -f package.json ]]; then
  echo "ERROR: no package.json here — run this from the repo root" >&2
  exit 1
fi

if [[ -f .npmrc ]] && grep -q 'npm.pkg.github.com' .npmrc; then
  echo "ERROR: .npmrc points a scope at GitHub Packages. These packages are on" >&2
  echo "       npm now, and that registry will 404. Delete it and retry:" >&2
  echo "         rm -f .npmrc" >&2
  exit 1
fi

packages=$(grep -o "\"${SCOPE}/[^\"]*\":" package.json | tr -d '":')

installed_version() {
  local manifest="node_modules/$1/package.json"
  [[ -f "$manifest" ]] || { echo "not installed"; return; }
  sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$manifest" | head -1
}

report() {
  local p
  for p in $packages; do
    printf '  %-48s %s\n' "$p" "$(installed_version "$p")"
  done
}

echo "installed now:"
report

pnpm update --latest "${SCOPE}/*"

echo
echo "installed after:"
report

# Whatever pnpm just declined to install, name it. `npm view` reads the registry
# directly, so it sees releases pnpm's release-age window is still holding back.
held=()
held_pins=()
for p in $packages; do
  latest=$(npm view "$p" version 2>/dev/null || true)
  [[ -n "$latest" ]] || continue
  current=$(installed_version "$p")
  if [[ "$current" != "$latest" ]]; then
    held+=("$(printf '%-48s %s -> %s' "$p" "$current" "$latest")")
    held_pins+=("  - '${p}@${latest}'")
  fi
done

if [[ ${#held[@]} -gt 0 ]]; then
  echo
  echo "NOT installed — a newer release exists for:"
  printf '  %s\n' "${held[@]}"
  echo
  echo "pnpm holds back releases younger than its minimumReleaseAge, because a"
  echo "package published minutes ago is the shape a compromised release takes."
  echo "It reports \"Already up to date\" instead of saying so — which is the only"
  echo "reason this check exists."
  echo
  echo "The window is short, so running this again tomorrow is usually the answer."
  echo "To take one now, name the exact version in pnpm-workspace.yaml:"
  echo
  echo "minimumReleaseAgeExclude:"
  printf '%s\n' "${held_pins[@]}"
  echo
  echo "...then run 'make update' again. Pinning the version keeps the policy on"
  echo "everything else and leaves the lockfile verifiable. Do NOT reach for"
  echo "--config.minimumReleaseAge=0: it installs the release, then every later"
  echo "pnpm command fails the policy check against the lockfile it wrote."
else
  echo
  echo "Every ${SCOPE} package is at its newest published release."
fi

echo
echo "Section features arrive this way. Changes to the template itself (makefile,"
echo "src/, server/, skills) are files in your repo: 'make update-template'."
