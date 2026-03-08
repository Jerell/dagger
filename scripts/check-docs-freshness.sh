#!/bin/bash
set -euo pipefail

QUALITY_SCORE="docs/QUALITY_SCORE.md"

if [ ! -f "$QUALITY_SCORE" ]; then
    echo "ERROR: $QUALITY_SCORE not found"
    exit 1
fi

required_refs=(
    "backend/src/core/http.ts"
    "backend/src/core/server.ts"
    "backend/src/core/operations.ts"
    "backend/src/dagger/modules/query.ts"
    "backend/src/dagger/modules/network.ts"
    "backend/src/dagger/modules/schema.ts"
    "backend/src/dagger/modules/operations/costing.ts"
    "backend/src/dagger/modules/operations/snapshot.ts"
    "backend/src/services/costing/"
    "backend/src/services/snapshot/"
    "backend/src/services/effectValidation.ts"
    "backend/src/services/effectSchemaProperties.ts"
    "backend/src/services/network.ts"
    "backend/src/services/query.ts"
    "frontend/electron/main.ts"
    "frontend/src/lib/desktop.ts"
)

missing=0

for ref in "${required_refs[@]}"; do
    if ! grep -Fq "$ref" "$QUALITY_SCORE"; then
        echo "ERROR: $QUALITY_SCORE is missing reference to $ref"
        missing=1
    fi
done

if [ "$missing" -eq 0 ]; then
    echo "Docs freshness check passed."
    exit 0
fi

exit 1
