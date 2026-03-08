#!/bin/bash
set -euo pipefail

QUALITY_SCORE="docs/QUALITY_SCORE.md"

if [ ! -f "$QUALITY_SCORE" ]; then
    echo "ERROR: $QUALITY_SCORE not found"
    exit 1
fi

claimed_ts=$(sed -n 's/.*Total TypeScript tests: \([0-9]*\).*/\1/p' "$QUALITY_SCORE")

if [ -z "$claimed_ts" ]; then
    echo "ERROR: Could not find 'Total TypeScript tests: <N>' in $QUALITY_SCORE"
    exit 1
fi

actual_ts=$(cd backend && bun test 2>&1 | sed -n 's/.*Ran \([0-9]*\) tests.*/\1/p')
actual_ts=${actual_ts:-0}

if [ "$actual_ts" -lt "$claimed_ts" ]; then
    echo "ERROR: QUALITY_SCORE claims $claimed_ts TypeScript tests but only $actual_ts found"
    exit 1
fi

if [ "$actual_ts" -gt "$claimed_ts" ]; then
    echo "WARNING: QUALITY_SCORE claims $claimed_ts TypeScript tests but $actual_ts exist — update the doc"
    exit 1
fi

echo "TypeScript test count OK: $actual_ts"
echo "Test count check passed."
