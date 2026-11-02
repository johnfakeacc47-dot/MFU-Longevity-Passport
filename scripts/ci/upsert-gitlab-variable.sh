#!/bin/sh
set -eu

if [ "$#" -lt 2 ]; then
  echo "Usage: GITLAB_TOKEN=... $0 KEY VALUE [env|file]" >&2
  exit 2
fi

: "${GITLAB_TOKEN:?GITLAB_TOKEN is required}"
: "${CI_API_V4_URL:=https://gitlab.mfu.ac.th/api/v4}"
: "${CI_PROJECT_ID:?CI_PROJECT_ID is required}"

key=$1
value=$2
variable_type=${3:-env_var}
encoded_key=$(printf '%s' "$key" | sed 's/ /%20/g')

http_code=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$CI_API_V4_URL/projects/$CI_PROJECT_ID/variables/$encoded_key")

if [ "$http_code" = "200" ]; then
  curl --fail --silent --show-error --request PUT \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    --form "value=$value" --form "variable_type=$variable_type" \
    --form "protected=true" --form "masked=false" \
    "$CI_API_V4_URL/projects/$CI_PROJECT_ID/variables/$encoded_key" >/dev/null
else
  curl --fail --silent --show-error --request POST \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    --form "key=$key" --form "value=$value" --form "variable_type=$variable_type" \
    --form "protected=true" --form "masked=false" \
    "$CI_API_V4_URL/projects/$CI_PROJECT_ID/variables" >/dev/null
fi

echo "Updated GitLab variable: $key"

