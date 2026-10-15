#!/bin/bash
# Starts Claude with --dangerously-skip-permissions only inside this dev container,
# and only when init-firewall.sh has completed successfully since the container started.
set -euo pipefail

FIREWALL_MARKER=/run/dd-e2e-firewall-active

if [ "${DD_E2E_DEVCONTAINER:-}" != true ]; then
    echo "Refusing to start Claude with --dangerously-skip-permissions outside the dev container."
    exit 1
fi

container_start=$(sed 's/.*) //' /proc/1/stat | cut -d' ' -f20)
if [ ! -f "$FIREWALL_MARKER" ] || [ "$(cat "$FIREWALL_MARKER")" != "$container_start" ]; then
    echo "Refusing to start Claude with --dangerously-skip-permissions: the firewall is not active."
    echo "Run 'sudo /usr/local/bin/init-firewall.sh', then run the Claude task again."
    exit 1
fi

exec claude --dangerously-skip-permissions
