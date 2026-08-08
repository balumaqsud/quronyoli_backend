#!/usr/bin/env bash
# Idempotent Docker Engine + Compose v2 install (Ubuntu / Debian via apt).
#
# Usage:
#   ./scripts/install-docker.sh

set -euo pipefail

LABEL="install-docker"

docker_ready() {
  command -v docker >/dev/null 2>&1 \
    && docker compose version >/dev/null 2>&1
}

if docker_ready; then
  echo "[${LABEL}] Docker Engine + Compose already available:"
  docker --version
  docker compose version
  exit 0
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "[${LABEL}] Docker auto-install is only supported on Linux (got $(uname -s))." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[${LABEL}] apt-get not found. Install Docker Engine + Compose v2 manually." >&2
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "[${LABEL}] Re-run as root (or with sudo) to install Docker." >&2
  exit 1
fi

echo "[${LABEL}] Installing Docker CE + Compose plugin..."

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

ARCH="$(dpkg --print-architecture)"
# shellcheck source=/dev/null
. /etc/os-release
CODENAME="${VERSION_CODENAME:-}"
if [[ -z "$CODENAME" ]]; then
  echo "[${LABEL}] Could not detect Ubuntu/Debian VERSION_CODENAME." >&2
  exit 1
fi

case "${ID:-}" in
  ubuntu) DOCKER_DISTRO="ubuntu" ;;
  debian) DOCKER_DISTRO="debian" ;;
  *)
    echo "[${LABEL}] Unsupported distro ID='${ID:-unknown}'. Use Ubuntu 24.04 or install Docker manually." >&2
    exit 1
    ;;
esac

echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${DOCKER_DISTRO} ${CODENAME} stable" \
  >/etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

if ! docker_ready; then
  echo "[${LABEL}] Docker install finished but 'docker compose' is still unavailable." >&2
  exit 1
fi

echo "[${LABEL}] Installed:"
docker --version
docker compose version
