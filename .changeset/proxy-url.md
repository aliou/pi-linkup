---
"@aliou/pi-linkup": minor
---

Add a global proxyUrl setting in /linkup:settings to route all Linkup API calls through a compatible HTTP(S) API base URL. Proxy requests omit the Linkup API key and can use keyless authenticated gateways; direct access still requires LINKUP_API_KEY. Preserve direct routing by default and validate proxy URLs before use.
