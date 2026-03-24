#!/bin/zsh
set -euo pipefail

VAULT_PATH="${1:-$HOME/.mexxie/mexxie-key-vault.json}"
APP_URL="https://christophergayle.github.io/kubora/mexxie_prism.html"

if [[ ! -f "$VAULT_PATH" ]]; then
  echo "Vault file not found: $VAULT_PATH" >&2
  exit 1
fi

cat <<MSG
Safari restore helper
1. In Safari, enable: Settings > Advanced > Show features for web developers
2. Then enable: Developer > Allow JavaScript from Apple Events
3. The app will open at: $APP_URL
4. Import this vault in Settings > Secure Key Vault:
   $VAULT_PATH
MSG

osascript <<APPLESCRIPT
 tell application "Safari"
   activate
   if (count of documents) = 0 then
     make new document with properties {URL:"$APP_URL"}
   else
     set URL of front document to "$APP_URL"
   end if
 end tell
APPLESCRIPT
