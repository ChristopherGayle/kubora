#!/bin/zsh
set -euo pipefail

service_prefix="mexxie"
account="${USER}"

require_var() {
  local name="$1"
  if [[ -z "${(P)name:-}" ]]; then
    echo "Missing env var: ${name}" >&2
    exit 1
  fi
}

require_var FINNHUB_KEY
require_var TWELVEDATA_KEY
require_var FMP_KEY
require_var EODHD_KEY

security add-generic-password -U -a "$account" -s "${service_prefix}.finnhub" -w "$FINNHUB_KEY" >/dev/null
security add-generic-password -U -a "$account" -s "${service_prefix}.twelvedata" -w "$TWELVEDATA_KEY" >/dev/null
security add-generic-password -U -a "$account" -s "${service_prefix}.fmp" -w "$FMP_KEY" >/dev/null
security add-generic-password -U -a "$account" -s "${service_prefix}.eodhd" -w "$EODHD_KEY" >/dev/null

echo "Stored Mexxie API keys in macOS Keychain for account ${account}."
