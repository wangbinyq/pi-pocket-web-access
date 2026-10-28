# pi-pocket-web-access

A [Pi Pocket](https://github.com/TannerMidd/pi-pocket) drop-in that gives Pi the web tools of
[pi-web-access](https://github.com/nicobailon/pi-web-access), running that package's own implementation.

It does not copy or reimplement anything. pi-web-access already ships a host-neutral core
(`web-tool-core.ts` plus `mcp-tool-definitions.ts`) that its MCP server uses. This module loads that core
with [jiti](https://github.com/unjs/jiti) inside the Pi Pocket server process, so Pi gets the same search,
fetch, storage, and provider logic that pi-web-access gives Pi itself.

## Tools

| Tool                 | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `web_search`         | Search the web; 2 to 4 varied queries in one call for research   |
| `fetch_content`      | Read a page, a GitHub repository, or a PDF                       |
| `get_search_content` | Page through a stored result, or find passages in it             |
| `source_check`       | Gather sources for a claim, with exact passage citations         |

Names, descriptions, and parameter schemas come from pi-web-access's own `MCP_TOOL_DEFINITIONS`, so they stay
in step with the package.

## Requirements

- Pi Pocket 0.22.0 or later (the module uses `host.notice` and the `pocketApi = 2` result shape).
- pi-web-access installed for Pi, in any version that has `web-tool-core.ts`:

  ```bash
  pi install npm:pi-web-access
  ```

  The module looks for it in `<agent folder>/npm/node_modules/pi-web-access`, then in
  `~/.pi/agent/npm/node_modules/pi-web-access`.

- Put the module in Pi Pocket's drop-in folder, `~/.pi-pocket/extensions/`.
- Turn it on in **Menu → Extensions**. Drop-ins start off.

## Configuration

It reads pi-web-access's own settings file, `web-search.json` in Pi's agent folder (`~/.pi/agent/web-search.json`):
API keys, `proxy`, `ssrf.allowRanges`, `fetch`, `fetchRouting`, and the switches that turn single tools off
(`webSearch`, `fetchContent`, `getSearchContent`, `sourceCheck`).

To use a copy of pi-web-access at another path, set `PI_WEB_ACCESS_DIR` before the Pi Pocket server starts.

## What it adds around the tools

- **Fenced results.** Every result's text goes to Pi between `<web_result tool="…">` tags with the sentence that
  it is data from the web, not instructions. The text passes through `host.text.defang`, so it cannot close the
  tag early.
- **Replay policy.** `get_search_content` only reads a stored result, so it is marked safe to run again after a
  restart. The three tools that spend a provider request are not, so a call a restart cuts off comes back to Pi
  as interrupted instead of being paid for twice.
- **Argument repair.** Some models send array arguments as JSON strings (`'["exa"]'`). The module parses them
  before validation, as pi-web-access's own tools do.
- **A prompt section** that tells Pi how to use the tools.
- **Read-only marking.** `get_search_content` carries `annotations.readOnlyHint`, so Plan mode lets it run.

## Limits

These come from pi-web-access's standalone core, not from this module:

- **Pi sign-in providers do not work.** Kimi search, and OpenAI search through a ChatGPT/Codex subscription,
  authenticate only through Pi's own `/login`. A call that asks for them fails with a message that says so.
  API keys in `web-search.json` work normally.
- **Stored results live in memory.** `responseId` values, and the content behind them, are gone after a Pi Pocket
  restart. Its MCP server behaves the same way.
- **No direct image fetch.** `fetch_content` returns text in standalone mode.

## Test

`test/web-access.test.ts` runs the module as a drop-in on a temporary data folder with a scripted model. It needs
the Pi Pocket sources, so copy it into a checkout of Pi Pocket and run it there:

```bash
cp test/web-access.test.ts /path/to/pi-pocket/test/
cd /path/to/pi-pocket
node --test test/web-access.test.ts
```

It makes no network call: it checks that the tools load, that the four names are installed, that a stored result
is read back, and that invalid arguments are refused.

## Not gallery-ready as it is

The module imports `jiti` and loads pi-web-access from outside its own folder, which the
[gallery rules](https://github.com/TannerMidd/pi-pocket/blob/main/docs/extensions/publishing.md) do not allow.
Install it by copying `web-access.ts` into the drop-in folder, or by cloning this repository there.

## License

MIT
