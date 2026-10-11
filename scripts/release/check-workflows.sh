#!/usr/bin/env bash
set -euo pipefail

# Official release, fixed version and independently published SHA-256.
check_dir=$(mktemp -d)
trap 'rm -rf "$check_dir"' EXIT
archive="$check_dir/actionlint.tar.gz"
curl --fail --silent --show-error --location --retry 2 \
  https://github.com/rhysd/actionlint/releases/download/v1.7.7/actionlint_1.7.7_linux_amd64.tar.gz \
  --output "$archive"
printf '%s  %s\n' 023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757 "$archive" | sha256sum --check --status
tar -xzf "$archive" -C "$check_dir" actionlint
"$check_dir/actionlint"
