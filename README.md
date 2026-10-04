# dsh-browser-use-bundle

Installs the **browser-use** provider pair into a DSH profile, so the agent can
drive the browser guest that lives in the right Sidebar.

## What it contributes

Two host rows, inserted through this package's `cordis.patch.yml`:

| row | package | what it does |
|---|---|---|
| `browser-use` | `@deepseek-ai/dsh-browser-use` | the exclusive named browser-use service (one provider at a time) |
| `browser-use-chrome-devtools-mcp` | `@deepseek-ai/dsh-experimental-browser-use-chrome-devtools-mcp` | runs the pinned `chrome-devtools-mcp` per Session, attached to the Sidebar guest's CDP endpoint |

Both rows carry

```yaml
disabled: !!js "process.env.DSH_DESKTOP_CDP_PORT === undefined || process.env.DSH_DESKTOP_CDP_PORT === ''"
```

so installing this bundle **changes nothing** until the desktop shell is actually
publishing its loopback endpoint. The endpoint itself comes from the
`sidebar-browser-durable-identity` source patch (the `installGuestDebuggingEndpoint`
edit) and only listens on `127.0.0.1`.

## Why the packages are vendored

`@deepseek-ai/dsh-browser-use` is not part of the DSH desktop app, and the
`browser-use-chrome-devtools-mcp` build here carries two DSH-specific lines that
are not upstream at 0.2.0-rc.2:

```js
args.push("--experimentalIncludeAllPages");   // Electron labels <webview> targets "webview", not "page"
args.push("--blockedUrlPattern", "dsh-app://*/*");  // never let the agent operate on DSH itself
```

Vendoring keeps them pinned and makes the bundle self-contained.

## Install

```powershell
dsh plugin --profile desktop add <path-to-this-package>
```

## The `node_modules` note

`dsh plugin add` links the package (`link:…`) rather than copying it, and pnpm
does not install dependencies of linked packages. This bundle therefore carries
its own `node_modules` (junctions into `vendor/` plus `chrome-devtools-mcp` and
`@deepseek-ai/schemastery`). If a later `pnpm install` prunes them, recreate the
junctions — `node_modules/` is the only thing that depends on them.

## Remove

```powershell
dsh plugin --profile desktop remove dsh-browser-use-bundle
```
