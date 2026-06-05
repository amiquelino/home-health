#!/bin/bash
# WSL2 dev server restart — clears Turbopack cache before starting.
set -e

pkill -f "next dev" 2>/dev/null || true
rm -rf .next .next-internal

npm run dev
