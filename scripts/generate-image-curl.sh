#!/usr/bin/env bash
set -euo pipefail

mode="both"
prompt="A simple red apple on a plain white background, studio product photo, centered composition."
output="fig/curl-test-image.png"
env_file="/etc/gpt-image-mcp.env"
model="gpt-image-2"
size="1024x1024"
quality="low"
background="opaque"
moderation="low"
n=1
format="png"

usage() {
  cat <<'EOF'
Usage: scripts/generate-image-curl.sh [options]

Options:
  --mode json|image|both   Output raw JSON, save image, or do both (default: both)
  --prompt TEXT            Prompt to send to the image API
  --output PATH            Output image path when saving image data
  --env-file PATH          Env file with OPENAI_BASE_URL and OPENAI_API_KEY
  --model NAME             Image model (default: gpt-image-2)
  --size SIZE              Canvas size (default: 1024x1024)
  --quality LEVEL          Image quality (default: low)
  --background VALUE       Background mode (default: opaque)
  --moderation VALUE       Moderation level (default: low)
  --n COUNT                Number of images (default: 1)
  --format EXT             Output format (default: png)
  -h, --help               Show this help

Examples:
  scripts/generate-image-curl.sh
  scripts/generate-image-curl.sh --mode json
  scripts/generate-image-curl.sh --mode image --output fig/apple.png
EOF
}

cleanup() {
  rm -f "${tmp_json:-}" "${tmp_b64:-}" "${payload_file:-}"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode|--prompt|--output|--env-file|--model|--size|--quality|--background|--moderation|--n|--format)
      [[ $# -ge 2 ]] || die "$1 requires a value"
      ;;
  esac

  case "$1" in
    --mode) mode="${2:-}"; shift 2 ;;
    --prompt) prompt="${2:-}"; shift 2 ;;
    --output) output="${2:-}"; shift 2 ;;
    --env-file) env_file="${2:-}"; shift 2 ;;
    --model) model="${2:-}"; shift 2 ;;
    --size) size="${2:-}"; shift 2 ;;
    --quality) quality="${2:-}"; shift 2 ;;
    --background) background="${2:-}"; shift 2 ;;
    --moderation) moderation="${2:-}"; shift 2 ;;
    --n) n="${2:-}"; shift 2 ;;
    --format) format="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

case "$mode" in
  json|image|both) ;;
  *) die "--mode must be json, image, or both" ;;
esac

[[ "$n" =~ ^[1-9][0-9]*$ ]] || die "--n must be a positive integer"

if [[ -f "$env_file" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a
fi

: "${OPENAI_BASE_URL:=https://api.openai.com/v1}"
: "${OPENAI_API_KEY:?OPENAI_API_KEY is required (set it in the environment or the env file)}"

mkdir -p "$(dirname "$output")"

tmp_json="$(mktemp /tmp/gpt-image-response.XXXXXX.json)"
tmp_b64="$(mktemp /tmp/gpt-image-b64.XXXXXX.txt)"
payload_file="$(mktemp /tmp/gpt-image-payload.XXXXXX.json)"
trap cleanup EXIT

node - <<'NODE' "$payload_file" "$model" "$prompt" "$size" "$quality" "$n" "$background" "$moderation" "$format"
const [payloadFile, model, prompt, size, quality, n, background, moderation, format] = process.argv.slice(2);
const fs = require('fs');
fs.writeFileSync(payloadFile, JSON.stringify({
  model,
  prompt,
  size,
  quality,
  n: Number(n),
  background,
  moderation,
  output_format: format,
}, null, 2));
NODE

http_code="$({
  curl -sS -o "$tmp_json" -w '%{http_code}' \
    "$OPENAI_BASE_URL/images/generations" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H 'Content-Type: application/json' \
    --data-binary "@$payload_file"
} )"

if [[ "$mode" == "json" || "$mode" == "both" ]]; then
  cat "$tmp_json"
  printf '\n'
fi

if [[ "$http_code" != 2* ]]; then
  printf 'request failed with HTTP %s\n' "$http_code" >&2
  exit 1
fi

if [[ "$mode" == "image" || "$mode" == "both" ]]; then
  if ! jq -r '.data[0].b64_json // empty' "$tmp_json" > "$tmp_b64"; then
    die "response did not include data[0].b64_json"
  fi
  if [[ ! -s "$tmp_b64" ]]; then
    die "response did not include image data"
  fi
  base64 -d "$tmp_b64" > "$output"
  printf 'saved image: %s\n' "$output"
fi
