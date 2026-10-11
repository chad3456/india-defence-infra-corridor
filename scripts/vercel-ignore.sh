#!/usr/bin/env bash
#
# Vercel's "ignored build step": exit 0 skips this deployment, exit 1 builds it.
#
# A dozen scheduled workflows commit generated data to this branch — the map
# every half hour, ADS-B hourly, the protest wire, the pipeline, the registers.
# Each commit started a full build, and the Hobby plan builds one at a time, so
# on a busy day the queue grew faster than it drained: deployments sat
# "queued" for hours and the newest code waited behind stale data builds.
#
# So a commit builds when it changes anything other than generated data, or
# when the deployed data is more than three hours old. Data-only commits inside
# that window are skipped; the next build carries all of them, because each
# build deploys the whole branch as it stands.
#
# Every doubt resolves to building: no previous deployment, history too shallow
# to compare, or git failing — the cost of an unneeded build is minutes, the
# cost of a skipped one is a stale site.
#
# Vercel labels a skipped build "Canceled by Ignored Build Step". It is not a
# failure, but it reads like one, and the first version of this script also
# skipped redeploys clicked in the dashboard: a redeploy of the current or an
# older commit diffs as data-only too. A push is checked within minutes of its
# commit and descends from the last deployment; a redeploy is clicked later, or
# on an older commit. So a commit more than 30 minutes old, the deployed commit
# itself, or one that does not descend from it is a person asking for a build,
# and it builds. (Skips take seconds, so a pushed commit does not wait in the
# queue anywhere near 30 minutes.) A commit message containing [deploy] always
# builds.
set -u

case "${VERCEL_GIT_COMMIT_MESSAGE:-}" in
  *"[deploy]"*) echo "[deploy] in the commit message: build"; exit 1 ;;
esac

PREV="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -z "$PREV" ] && { echo "no previous deployment: build"; exit 1; }

if ! git cat-file -e "${PREV}^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=200 origin "${VERCEL_GIT_COMMIT_REF:-HEAD}" 2>/dev/null || true
fi
git cat-file -e "${PREV}^{commit}" 2>/dev/null || { echo "previous deployment not in history: build"; exit 1; }

# A commit checked long after it was made is a redeploy from the dashboard.
COMMIT_AGE=$(( $(date +%s) - $(git log -1 --format=%ct HEAD 2>/dev/null || date +%s) ))
[ "$COMMIT_AGE" -gt 1800 ] && { echo "commit is $((COMMIT_AGE / 60)) min old (a manual redeploy): build"; exit 1; }

# Redeploying the deployed commit, or an older one: only a person does that.
if [ "$(git rev-parse HEAD 2>/dev/null)" = "$(git rev-parse "$PREV" 2>/dev/null)" ]; then
  echo "redeploy of the deployed commit: build"; exit 1
fi
git merge-base --is-ancestor "$PREV" HEAD 2>/dev/null || { echo "not a descendant of the last deployment (a manual redeploy): build"; exit 1; }

CHANGED="$(git diff --name-only "$PREV" HEAD 2>/dev/null)" || { echo "diff failed: build"; exit 1; }
[ -z "$CHANGED" ] && { echo "nothing changed: skip"; exit 0; }

if printf '%s\n' "$CHANGED" | grep -qvE '^(data/|supabase/seed\.sql$)'; then
  echo "code or content changed: build"
  exit 1
fi

AGE=$(( $(date +%s) - $(git log -1 --format=%ct "$PREV") ))
if [ "$AGE" -gt 10800 ]; then
  echo "data-only, but the deployed data is $((AGE / 60)) min old: build"
  exit 1
fi
echo "data-only change; deployed data is $((AGE / 60)) min old: skip"
exit 0
