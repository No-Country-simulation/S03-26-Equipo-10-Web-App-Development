#!/usr/bin/env bash
set -euo pipefail

# Readiness polling only: never retry a suite or a business mutation.
curl --fail --silent --show-error --connect-timeout 2 --max-time 3 \
  --retry "${2:-20}" --retry-max-time 60 --retry-all-errors \
  --retry-connrefused --retry-delay 1 "$1" >/dev/null
