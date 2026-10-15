#!/usr/bin/env bash
#
# Commit several generated paths (files or whole directories) in one commit.
#
#   .github/scripts/commit-generated-paths.sh "<message>" <path> [<path> ...]
#
# commit-generated.sh's logic, for a job that writes a directory of documents
# rather than one file: keep this run's output aside, reset onto whatever the
# branch now is, put the output back, commit. Last writer wins, which for
# generated output is the intent. Fails if every attempt fails.
set -uo pipefail

MESSAGE="$1"; shift
BRANCH="${GITHUB_REF_NAME:?GITHUB_REF_NAME is not set}"
EXISTING=()
for p in "$@"; do [ -e "$p" ] && EXISTING+=("$p"); done
if [ ${#EXISTING[@]} -eq 0 ]; then echo "Nothing to commit."; exit 0; fi

git config user.name  "bharat-tracker-bot"
git config user.email "actions@github.com"
KEEP="$(mktemp -d)"
tar -cf "$KEEP/out.tar" "${EXISTING[@]}"

for attempt in 1 2 3 4; do
  git fetch --quiet origin "$BRANCH" || true
  git rebase --abort 2>/dev/null || true
  git reset --hard --quiet 2>/dev/null || true
  rm -rf "${EXISTING[@]}"
  git checkout -q -B "$BRANCH" "origin/$BRANCH"
  tar -xf "$KEEP/out.tar"
  git add -A "${EXISTING[@]}"
  if git diff --staged --quiet; then echo "Unchanged."; exit 0; fi
  git commit --quiet -m "$MESSAGE"
  if git push origin "$BRANCH"; then echo "Committed ${EXISTING[*]}."; exit 0; fi
  sleep $((2 ** attempt))
done
echo "Could not commit after four attempts." >&2
exit 1
