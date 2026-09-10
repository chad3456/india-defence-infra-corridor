#!/usr/bin/env bash
#
# Commit one generated file to the branch this workflow is running on.
#
#   .github/scripts/commit-generated.sh <path> <commit message>
#
# ── Why this is not four lines of git ────────────────────────────────────
#
# It was, and the four lines lost a report. The pattern every workflow here
# copied was: commit, push, and on failure `git pull --rebase` and try again.
# When two runs of the same probe both rewrite the same generated file, that
# rebase hits a content conflict in a file nobody merged by hand — git stops
# mid-rebase, leaves a detached HEAD with unmerged paths, and every later
# attempt in the loop fails against that same broken state with "Pulling is not
# possible because you have unmerged files". The retry loop swallowed all of
# it and the job exited green with the data on the floor.
#
# Rebase is the wrong tool. There is nothing to merge: the file is generated,
# this run just generated it, and the correct resolution is always "the version
# that was produced most recently". So each attempt resets onto whatever the
# branch now is and replays this run's file on top. Last writer wins, which for
# a build artifact is not a compromise but the actual intent.
#
# And if every attempt fails, this exits non-zero. A job that loses the thing
# it was run to produce must not report success.
set -uo pipefail

FILE="$1"
MESSAGE="$2"
BRANCH="${GITHUB_REF_NAME:?GITHUB_REF_NAME is not set}"

if [ ! -f "$FILE" ]; then
  echo "Nothing to commit: $FILE was not produced."
  exit 0
fi

git config user.name  "bharat-tracker-bot"
git config user.email "actions@github.com"

KEEP="$(mktemp)"
cp "$FILE" "$KEEP"

for attempt in 1 2 3 4; do
  git fetch --quiet origin "$BRANCH" || true
  # Discard any half-finished state from a previous attempt before rebuilding.
  # The generated file is safe in $KEEP, so a hard reset costs nothing and is
  # the only thing that reliably clears an interrupted rebase's unmerged paths.
  git rebase --abort 2>/dev/null || true
  git reset --hard --quiet 2>/dev/null || true
  git checkout -q -B "$BRANCH" "origin/$BRANCH"

  mkdir -p "$(dirname "$FILE")"
  cp "$KEEP" "$FILE"
  git add "$FILE"

  if git diff --staged --quiet; then
    echo "$FILE is unchanged from what the branch already holds."
    exit 0
  fi

  git commit --quiet -m "$MESSAGE"
  if git push origin "$BRANCH"; then
    echo "Committed $FILE."
    exit 0
  fi

  wait=$((2 ** attempt))
  echo "push failed (attempt $attempt), retrying in ${wait}s"
  sleep "$wait"
done

echo "Could not commit $FILE after four attempts. Failing, rather than reporting success without the data." >&2
exit 1
