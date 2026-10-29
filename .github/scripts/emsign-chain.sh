#!/usr/bin/env bash
# The intermediates IIPS needs, without switching verification off.
#
# nfhsiips.in sends two chains for its eMudhra certificate: one through Comodo's
# "AAA Certificate Services", which current trust stores no longer carry, and
# one through eMudhra's own "emSign Root CA - G1", which they do. OpenSSL takes
# the first and fails ("self-signed certificate in certificate chain"). This
# keeps only the certificates the server sends that are issued by an emSign CA,
# checks that they verify against the system's trusted roots, and writes them
# out for NODE_EXTRA_CA_CERTS / curl. A non-self-signed certificate added this
# way is not a trust anchor: every signature is still checked up to a root the
# system already trusts.
set -euo pipefail
host="${1:-www.nfhsiips.in}"
out="${2:-$RUNNER_TEMP/emsign-chain.pem}"
work="$(mktemp -d)"
timeout 30 openssl s_client -showcerts -connect "$host:443" -servername "$host" </dev/null 2>/dev/null \
  | awk -v dir="$work" '/BEGIN CERTIFICATE/{n++; f=sprintf("%s/c%02d.pem", dir, n)} f{print > f} /END CERTIFICATE/{f=""}'
: > "$out"
for c in "$work"/c*.pem; do
  issuer="$(openssl x509 -in "$c" -noout -issuer)"
  subject="$(openssl x509 -in "$c" -noout -subject)"
  # Intermediates only (issuer differs from subject), issued by eMudhra's emSign roots.
  if [[ "$issuer" == *"emSign Root"* && "$issuer" != "${subject/subject=/issuer=}" ]]; then cat "$c" >> "$out"; fi
done
leaf="$work/c01.pem"
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt -untrusted "$out" "$leaf"
echo "wrote $(grep -c 'BEGIN CERTIFICATE' "$out") intermediate(s) to $out"
