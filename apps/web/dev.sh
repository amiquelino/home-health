#!/bin/bash
# WSL2 dev server — keeps .next on Linux ext4 to avoid Turbopack/NTFS chunk truncation
set -e

pkill -f "next dev" 2>/dev/null || true

rm -rf /tmp/hh-next /tmp/hh-next-internal
mkdir -p /tmp/hh-next /tmp/hh-next-internal

# node_modules symlink — needed so require('react') resolves from /tmp/hh-next chunks
ln -sfn /mnt/c/home-health/node_modules /tmp/hh-next/node_modules

# Symlink .next and .next-internal to Linux filesystem
rm -f .next .next-internal
ln -sfn /tmp/hh-next          .next
ln -sfn /tmp/hh-next-internal .next-internal

npm run dev
