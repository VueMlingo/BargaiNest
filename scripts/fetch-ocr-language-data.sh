#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# BN-042 -- fetches the Tesseract OCR trained language data needed for
# receipt text recognition. Not bundled in this delivery (a ~10MB binary
# asset has no place in a source zip, same reasoning as Playwright's
# browser binaries not being bundled either -- see
# RETAILER-ADAPTER-VERIFICATION-CHECKLIST.md).
#
# The OCR *engine* itself (tesseract.js-core, the WASM binary) IS a
# normal npm dependency and needs no separate fetch -- only the
# trained language model does.
#
# Usage: ./scripts/fetch-ocr-language-data.sh
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${OCR_LANG_DATA_DIR:-$SCRIPT_DIR/../ocr-lang-data}"
LANG_FILE="eng.traineddata.gz"
SOURCE_URL="https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/${LANG_FILE}"

mkdir -p "$TARGET_DIR"

if [ -f "$TARGET_DIR/$LANG_FILE" ]; then
  echo "Already present: $TARGET_DIR/$LANG_FILE"
  exit 0
fi

echo "Fetching English OCR trained data from GitHub..."
curl -sL -o "$TARGET_DIR/$LANG_FILE" "$SOURCE_URL"

if [ ! -s "$TARGET_DIR/$LANG_FILE" ]; then
  echo "Download failed or produced an empty file." >&2
  exit 1
fi

echo "Done: $TARGET_DIR/$LANG_FILE"
echo "Set OCR_LANG_DATA_DIR=$TARGET_DIR (or leave as default) when running the backend."
