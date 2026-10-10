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
set -u

PREV="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -z "$PREV" ] && { echo "no previous deployment: build"; exit 1; }

if ! git cat-file -e "${PREV}^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=200 origin "${VERCEL_GIT_COMMIT_REF:-HEAD}" 2>/dev/null || true
fi
git cat-file -e "${PREV}^{commit}" 2>/dev/null || { echo "previous deployment not in history: build"; exit 1; }

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
