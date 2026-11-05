#!/bin/sh
# Publish docs/examples/personas.json to your ntfy topic.
# The topic is a secret. Pass it in the environment; do not write it into this repo.
#
#   TOPIC='your-topic' sh docs/examples/publish-personas.sh
#   NTFY_BASE='https://ntfy.sh' TOPIC='your-topic' sh docs/examples/publish-personas.sh
#
# One say-line, same idea (replace the names):
#   curl -s -d '{"say":{"from":"小萤","to":"仪表盘","text":"先把方向对齐","id":"m1"}}' "$NTFY_BASE/$TOPIC"
set -eu
if [ -z "${TOPIC:-}" ]; then
  echo 'Set TOPIC to your ntfy topic (it is a secret; do not commit it).' >&2
  exit 1
fi
BASE="${NTFY_BASE:-https://ntfy.sh}"
BASE="${BASE%/}"
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
curl -sS -H 'Content-Type: application/json' --data-binary @"$DIR/personas.json" "$BASE/$TOPIC"
echo
