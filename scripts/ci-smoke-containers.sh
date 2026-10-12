#!/usr/bin/env bash
set -euo pipefail

api_image="${1:-testimonial-cms-api:ci}"
web_image="${2:-testimonial-cms-web:ci}"
api_id="$(docker image inspect --format '{{.Id}}' "$api_image")"
# Same harness as final release: owned PG/Redis, migration ACK, positive auth/write/read.
node scripts/e2e/run.mjs --api-smoke "$api_id"

run_id="$(openssl rand -hex 6)"
web_container="testimonial-web-smoke-$run_id"
cleanup() {
  local result=$?
  if docker inspect "$web_container" >/dev/null 2>&1; then
    if [ "$(docker inspect --format '{{index .Config.Labels "testimonial.web-smoke.run"}}' "$web_container")" = "$run_id" ]; then
      docker rm --force "$web_container" >/dev/null || result=1
    else
      result=1
    fi
  fi
  return "$result"
}
trap cleanup EXIT

web_uid="$(docker run --rm --network none --entrypoint id "$web_image" -u)"
test "$web_uid" -ne 0

docker run --detach --name "$web_container" \
  --label "testimonial.web-smoke.run=$run_id" --publish 127.0.0.1::3000 \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,nosuid,nodev,size=64m \
  --tmpfs /app/apps/web/.next/cache:rw,nosuid,nodev,uid=1001,gid=1001,mode=0700,size=128m \
  --env HOSTNAME=0.0.0.0 "$web_image" >/dev/null
web_port="$(docker inspect --format '{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}' "$web_container")"
web_origin="http://127.0.0.1:$web_port"
bash scripts/wait-http.sh "$web_origin/health"
curl --fail --silent --show-error "$web_origin/" >/dev/null

# La capa raíz debe ser inmutable; /tmp y la caché de Next.js son efímeros.
for container in "$web_container"; do
  test "$(docker inspect --format '{{json .HostConfig.CapDrop}}' "$container")" = '["ALL"]'
  docker exec "$container" node -e 'const fs=require("node:fs"); try { fs.writeFileSync("/app/rootfs-probe", "x"); process.exit(1); } catch (error) { if (error.code !== "EROFS") process.exit(1); }'
  docker exec "$container" node -e 'const fs=require("node:fs"); fs.writeFileSync("/tmp/smoke-probe","x"); fs.unlinkSync("/tmp/smoke-probe");'
done
docker exec "$web_container" node -e 'const fs=require("node:fs"); const path="/app/apps/web/.next/cache/smoke-probe"; fs.writeFileSync(path,"x"); fs.unlinkSync(path);'

docker stop --time 30 "$web_container" >/dev/null
for container in "$web_container"; do
  test "$(docker inspect --format '{{.State.ExitCode}}' "$container")" -ne 137
  test "$(docker inspect --format '{{.State.OOMKilled}}' "$container")" = false
done
