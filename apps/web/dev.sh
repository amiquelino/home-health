#!/bin/bash
# WSL2 dev server — uses webpack (--no-turbopack) to avoid NTFS chunk truncation bugs.
set -e

pkill -f "next dev" 2>/dev/null || true
rm -rf .next .next-internal

npm run dev
