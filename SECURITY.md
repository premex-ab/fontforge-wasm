# Security

This experimental port processes complex, potentially malformed binary inputs.
It has not undergone a security audit. Input checks are bounds checks and format
restrictions, not a complete font sanitizer. Native parsing occurs in a disposable
WebAssembly worker with a 512 MiB linear-memory ceiling and a default 30-second
wall-clock timeout. No host filesystem is mounted and no font upload is performed.

A worker limits UI disruption; it is not a replacement for browser/OS security
boundaries. Applications should limit concurrent conversions and total input
size. Use separate OS processes/containers and resource limits for hostile bulk
workloads in Node.js.

Report security issues using this repository's GitHub private vulnerability
reporting feature. Avoid posting exploit fonts publicly until the issue is triaged.
Only the latest alpha is maintained; there is no response-time SLA.
