#!/usr/bin/env bash
set -e

# Antigravity PostToolUse Hook for Auto-formatting and Linting
# Reads tool execution context from stdin (JSON)
# Outputs empty JSON object {} to stdout on completion

INPUT_JSON=$(cat)

TARGET_FILE=$(node -e '
try {
  const data = JSON.parse(process.argv[1] || "{}");
  const args = data?.toolCall?.args || {};
  const file = args.Path || args.TargetFile || args.path || args.file || "";
  process.stdout.write(file);
} catch (e) {
  process.stdout.write("");
}
' "$INPUT_JSON" 2>/dev/null || true)

if [ -n "$TARGET_FILE" ] && [ -f "$TARGET_FILE" ]; then
  case "$TARGET_FILE" in
    *.vue|*.ts|*.js|*.json|*.css|*.md)
      npx prettier --write "$TARGET_FILE" >/dev/null 2>&1 || true
      ;;
  esac
fi

# PostToolUse requires an empty JSON object as output
echo "{}"
exit 0

