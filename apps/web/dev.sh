#!/bin/bash
# WSL2 dev server — keeps .next on Linux ext4 to avoid Turbopack/NTFS chunk truncation
set -e

pkill -f "next dev" 2>/dev/null || true

rm -rf /tmp/hh-next /tmp/hh-next-internal
mkdir -p /tmp/hh-next /tmp/hh-next-internal

# Remove any existing .next on NTFS, create symlinks to Linux filesystem
rm -rf .next .next-internal
ln -sfn /tmp/hh-next          .next
ln -sfn /tmp/hh-next-internal .next-internal

npm run dev
