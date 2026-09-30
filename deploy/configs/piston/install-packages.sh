#!/bin/sh
# Install missing packages from packages.txt; CHECK_ONLY=1 only checks.

set -eu

# --- GLOBALS ---
PISTON_URL="${PISTON_URL:-http://piston:2000}"
PACKAGES_FILE="${PACKAGES_FILE:-/packages.txt}"
CHECK_ONLY="${CHECK_ONLY:-0}"

# --- CODE ---
# installed "<package> <version>", from runtimes: /packages needs internet
installed="$(
  curl -fsS "$PISTON_URL/api/v2/runtimes" \
    | tr '{' '\n' \
    | grep '"version"' \
    | sed -E \
        -e 's/.*"language":"([^"]+)","version":"([^"]+)".*"runtime":"([^"]+)".*/\3 \2/' \
        -e 's/.*"language":"([^"]+)","version":"([^"]+)".*/\1 \2/'
)"

missing=0

# skip comments and blank lines, install the rest
grep -Ev '^\s*(#|$)' "$PACKAGES_FILE" | {
  while read -r language version; do

    # already there: nothing to do
    if printf '%s\n' "$installed" | grep -qx "$language $version"; then
      echo "skip    $language $version"
      continue
    fi

    # checking only: report it, install nothing
    if [ "$CHECK_ONLY" = "1" ]; then
      echo "missing $language $version"
      missing=1
      continue
    fi

    echo "install $language $version"

    curl -fsS -X POST "$PISTON_URL/api/v2/packages" \
      -H 'Content-Type: application/json' \
      -d "{\"language\":\"$language\",\"version\":\"$version\"}" \
      --max-time 900 \
      > /dev/null
  done

  if [ "$missing" = "1" ]; then
    echo "packages missing: install them first"
    exit 1
  fi
}

echo "done"
