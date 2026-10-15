#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Allowlists baked into the image by the Dockerfile. They are read from here and not from /workspace,
# so nothing inside the container can widen them and rerun this script with sudo
ALLOWLIST_DIR=/usr/local/etc/dd-e2e-firewall

# Written only after verification passes; tells start-claude.sh the firewall is up for this container start
FIREWALL_MARKER=/run/dd-e2e-firewall-active
rm -f "$FIREWALL_MARKER"

# The default policies are DROP from the first moment, and every ACCEPT rule is in place before the
# allowlist is filled. If anything below fails, the container is left with no outbound access except
# to whatever was already allowed, never with an open network.
trap 'status=$?; if [ "$status" -ne 0 ]; then echo "ERROR: Firewall setup failed (exit $status). Outbound traffic stays blocked; fix the error and run sudo /usr/local/bin/init-firewall.sh again." >&2; fi' EXIT

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Flush existing rules and delete existing ipsets
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# 2. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "No Docker DNS rules to restore"
fi

# Reads an allowlist file into the named array, without comments and blank lines. Runs in the main
# shell, so a missing file or a bad entry stops the script
load_allowlist() {
    local file=$1 host
    local -n hosts=$2
    if [ ! -r "$file" ]; then
        echo "ERROR: Missing allowlist $file"
        exit 1
    fi
    mapfile -t hosts < <(sed -e 's/#.*//' -e 's/[[:space:]]//g' "$file" | grep -v '^$' || true)
    for host in "${hosts[@]}"; do
        if [[ ! "$host" =~ ^[A-Za-z0-9.-]+$ ]]; then
            echo "ERROR: Invalid host in $file: $host"
            exit 1
        fi
    done
}

allowed_domains=()
allowed_ssh_hosts=()
load_allowlist "$ALLOWLIST_DIR/allowed-domains.txt" allowed_domains
load_allowlist "$ALLOWLIST_DIR/allowed-ssh-hosts.txt" allowed_ssh_hosts

# Allow DNS only to the resolvers in /etc/resolv.conf, so DNS can't be used to reach other servers.
# Docker's embedded resolver (127.0.0.11) is covered by the localhost rules below
nameservers=$(awk '$1 == "nameserver" {print $2}' /etc/resolv.conf)
if [ -z "$nameservers" ]; then
    echo "ERROR: No nameserver in /etc/resolv.conf"
    exit 1
fi
while read -r ns; do
    if [[ ! "$ns" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "Skipping non-IPv4 nameserver $ns"
        continue
    fi
    echo "Allowing DNS to $ns"
    for proto in udp tcp; do
        iptables -A OUTPUT -p "$proto" -d "$ns" --dport 53 -j ACCEPT
        iptables -A INPUT -p "$proto" -s "$ns" --sport 53 -m state --state ESTABLISHED -j ACCEPT
    done
done < <(echo "$nameservers")

# Allow SSH only to the hosts in allowed-ssh-hosts.txt, filled in below
ipset destroy allowed-ssh 2>/dev/null || true
ipset create allowed-ssh hash:net
iptables -A OUTPUT -p tcp --dport 22 -m set --match-set allowed-ssh dst -j ACCEPT
iptables -A INPUT -p tcp --sport 22 -m set --match-set allowed-ssh src -m state --state ESTABLISHED -j ACCEPT
# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Get host IP from default route
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi

HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network detected as: $HOST_NETWORK"

iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Allow established connections for already approved traffic
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Create ipset with CIDR support. The rule refers to the set by name, so the IPs added below take
# effect as they are added
ipset create allowed-domains hash:net
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Explicitly REJECT all other outbound traffic for immediate feedback
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# Allow api.github.com first, so the meta request below can get through
add_domain_ips() {
    local domain=$1 set=${2:-allowed-domains} ips ip
    ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
    if [ -z "$ips" ]; then
        return 1
    fi

    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "ERROR: Invalid IP from DNS for $domain: $ip"
            exit 1
        fi
        echo "Adding $ip for $domain to $set"
        ipset add -exist "$set" "$ip"
    done < <(echo "$ips")
}

if ! add_domain_ips "api.github.com"; then
    echo "ERROR: Failed to resolve api.github.com"
    exit 1
fi

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s --connect-timeout 10 --max-time 30 https://api.github.com/meta || true)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    echo "Adding GitHub range $cidr"
    ipset add -exist allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# Resolve and add other allowed domains. One failed lookup only leaves that domain blocked, so it
# warns instead of stopping the whole setup
unresolved=()
for domain in "${allowed_domains[@]}"; do
    echo "Resolving $domain..."
    if ! add_domain_ips "$domain"; then
        echo "WARNING: Failed to resolve $domain"
        unresolved+=("$domain")
    fi
done

for host in "${allowed_ssh_hosts[@]}"; do
    echo "Resolving SSH host $host..."
    if ! add_domain_ips "$host" allowed-ssh; then
        echo "WARNING: Failed to resolve SSH host $host"
        unresolved+=("$host (ssh)")
    fi
done

if [ "${#unresolved[@]}" -gt 0 ]; then
    echo "WARNING: These domains stay blocked: ${unresolved[*]}. Run the script again to retry"
fi

echo "Firewall configuration complete"
echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "Firewall verification passed - unable to reach https://example.com as expected"
fi

# Verify that DNS only reaches the resolvers in /etc/resolv.conf
if dig +short +time=3 +tries=1 @8.8.8.8 example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to query DNS at 8.8.8.8"
    exit 1
else
    echo "Firewall verification passed - unable to query DNS at 8.8.8.8 as expected"
fi

# Verify GitHub API access
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi

# Record PID 1's start time so a marker left over from an earlier container start is not trusted
sed 's/.*) //' /proc/1/stat | cut -d' ' -f20 > "$FIREWALL_MARKER"
