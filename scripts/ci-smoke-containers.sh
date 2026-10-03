#!/usr/bin/env bash
set -euo pipefail

api_container=testimonial-api-smoke
web_container=testimonial-web-smoke

cleanup() {
  local result=$?
  if [ "$result" -ne 0 ]; then
    docker logs "$api_container" 2>/dev/null || true
    docker logs "$web_container" 2>/dev/null || true
  fi
  docker rm --force "$api_container" "$web_container" >/dev/null 2>&1 || true
  return "$result"
}
trap cleanup EXIT

api_uid="$(docker run --rm --entrypoint id testimonial-cms-api:ci -u)"
web_uid="$(docker run --rm --entrypoint id testimonial-cms-web:ci -u)"
test "$api_uid" -ne 0
test "$web_uid" -ne 0

JWT_SECRET="$(openssl rand -hex 32)"
API_KEY_PEPPERS_JSON="{\"1\":\"$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')\"}"
WEBHOOK_SECRET_KEYS_JSON="{\"1\":\"$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')\"}"
METRICS_TOKEN="$(openssl rand -hex 32)"
export JWT_SECRET API_KEY_PEPPERS_JSON WEBHOOK_SECRET_KEYS_JSON METRICS_TOKEN
docker run --detach --network host --name "$api_container" \
  --env DATABASE_URL --env REDIS_URL --env JWT_SECRET \
  --env API_KEY_PEPPERS_JSON --env WEBHOOK_SECRET_KEYS_JSON --env METRICS_TOKEN \
  testimonial-cms-api:ci >/dev/null

curl --fail --silent --show-error --retry 20 --retry-connrefused --retry-delay 1 \
  http://127.0.0.1:4000/api/v1/health/live >/dev/null
curl --fail --silent --show-error --retry 20 --retry-connrefused --retry-delay 1 \
  http://127.0.0.1:4000/api/v1/health/ready >/dev/null
test "$(curl --silent --output /dev/null --write-out '%{http_code}' \
  http://127.0.0.1:4000/api/v1/internal/metrics)" = 404
metrics_body="$(curl --fail --silent --show-error --header "x-metrics-token: $METRICS_TOKEN" \
  http://127.0.0.1:4000/api/v1/internal/metrics)"
grep -q '^# HELP tms_http_requests_total' <<< "$metrics_body"

# Login inválido debe atravesar la cuota Redis y responder 401, no 503.
login_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --request POST http://127.0.0.1:4000/api/v1/auth/login \
  --header 'Origin: http://localhost:3000' --header 'Content-Type: application/json' \
  --header 'X-Auth-Mode: bearer' \
  --data '{"email":"nobody@example.com","password":"WrongPass123!"}')"
test "$login_status" = 401

docker run --detach --network host --name "$web_container" \
  --env HOSTNAME=0.0.0.0 testimonial-cms-web:ci >/dev/null
curl --fail --silent --show-error --retry 20 --retry-connrefused --retry-delay 1 \
  http://127.0.0.1:3000/health >/dev/null
curl --fail --silent --show-error http://127.0.0.1:3000/ >/dev/null

docker stop --time 10 "$web_container" "$api_container" >/dev/null
for container in "$web_container" "$api_container"; do
  test "$(docker inspect --format '{{.State.ExitCode}}' "$container")" -ne 137
  test "$(docker inspect --format '{{.State.OOMKilled}}' "$container")" = false
done
