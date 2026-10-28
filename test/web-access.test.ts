// The web-access module, as a drop-in: its tools load from pi-web-access, and Pi can call them.
//
// This file belongs in Pi Pocket's own `test/` folder, because it uses that folder's helpers:
//
//     cp test/web-access.test.ts /path/to/pi-pocket/test/
//     cd /path/to/pi-pocket && WEB_ACCESS_MODULE=/path/to/pi-pocket-web-access/web-access.ts \
//         node --test test/web-access.test.ts
//
// It makes no network call.
import {
    cleanUp,
    lastText,
    modelTexts,
    newSession,
    openApp,
    owner,
    root,
    say,
    scriptedModel,
} from "./helpers.ts";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import type { FauxResponseStep } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";

/** The module to test: `WEB_ACCESS_MODULE`, else beside this file as it lies in its own repository. */
const MODULE = [
    process.env.WEB_ACCESS_MODULE,
    join(import.meta.dirname, "..", "web-access.ts"),
    join(import.meta.dirname, "web-access.ts"),
].find((path): path is string => typeof path === "string" && existsSync(path));

const route: FauxResponseStep = (context) => {
    const { role, text } = lastText(context as never);

    if (role === "toolResult") {
        return fauxAssistantMessage([fauxText(`tool said: ${text.slice(0, 200)}`)]);
    }

    if (text.includes("stored result")) {
        // No network: an unknown responseId is an error result from the package's own core.
        return fauxAssistantMessage(
            [fauxToolCall("get_search_content", { responseId: "no-such-id" })],
            { stopReason: "toolUse" },
        );
    }

    if (text.includes("bad arguments")) {
        return fauxAssistantMessage([fauxToolCall("web_search", { nope: 1 })], {
            stopReason: "toolUse",
        });
    }

    return fauxAssistantMessage([fauxText(`echo: ${text}`)]);
};

after(cleanUp);

test("the web tools load from pi-web-access and run", async () => {
    const dropIns = join(root, "data", "extensions");

    mkdirSync(dropIns, { recursive: true });
    // The module comes from this repository, not from the test's folder.
    assert.ok(MODULE, "set WEB_ACCESS_MODULE to the module's file");
    copyFileSync(MODULE, join(dropIns, "web-access.ts"));

    const app = await openApp(scriptedModel(route));

    try {
        await app.setExtensionEnabled(owner(app), "web-access.ts", true);

        const info = (await app.extensions(owner(app))).modules.find(
            (each: { file: string }) => each.file === "web-access.ts",
        );

        assert.equal(info?.error, undefined, info?.error);
        assert.deepEqual(info?.extensions[0].tools, [
            "web_search",
            "fetch_content",
            "get_search_content",
            "source_check",
        ]);

        const id = await newSession(app);

        await say(app, id, "show the stored result");
        const texts = await modelTexts(app, id);
        assert.match(texts.at(-1) ?? "", /tool said: /);
        assert.match(texts.at(-1) ?? "", /no-such-id|not found|Unknown|No .*result/i);

        await say(app, id, "bad arguments");
        assert.match((await modelTexts(app, id)).at(-1) ?? "", /tool said: /);
    } finally {
        await app.close();
    }
});
