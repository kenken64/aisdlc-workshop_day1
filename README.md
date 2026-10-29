# Snip CLI

A zero-dependency Node.js command-line client for the Snip API. Requires Node 20 or newer.

```sh
node cli.js add https://example.com
node cli.js ls
node cli.js open <code>
```

Run `node cli.js help` for usage. Set `SNIP_API` to change the API base URL; it defaults to `http://localhost:3000`. Errors are printed to stderr with exit code 1. The `snip`, `snip.cmd`, and `snip.ps1` wrappers forward their arguments to `cli.js`.