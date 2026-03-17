#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL_NAME="mt-label"
MODEL_FILE="${SCRIPT_DIR}/mt-label-qwen35.Modelfile"

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/create_mt_label_qwen35.sh [options] [model-name]

Options:
  --modelfile <path>   Modelfile to use
  -h, --help           Show help
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --modelfile)
      MODEL_FILE="${2:?missing value for --modelfile}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      MODEL_NAME="$1"
      shift
      ;;
  esac
done

if ! command -v ollama >/dev/null 2>&1; then
  echo "[create-mt-label] missing command: ollama" >&2
  exit 1
fi

if [ ! -f "$MODEL_FILE" ]; then
  echo "[create-mt-label] missing modelfile: $MODEL_FILE" >&2
  exit 1
fi

echo "[create-mt-label] creating ${MODEL_NAME} from ${MODEL_FILE}"
ollama create "$MODEL_NAME" -f "$MODEL_FILE"
echo "[create-mt-label] done"
ollama show "$MODEL_NAME"
