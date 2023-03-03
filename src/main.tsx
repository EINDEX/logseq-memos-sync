import "@logseq/libs";

import {BlockEntity, IHookEvent} from "@logseq/libs/dist/LSPlugin";
import MemosSync from "./memos";

function main() {
  console.log("Logseq Memos Plugin Loading!");
  logseq.useSettingsSchema([
    {
      key: "openAPI",
      type: "string",
      title: "Open API",
      description: "Memos Open API, you can find this in memos setting",
      default: "",
    },
    {
      key: "includeArchive",
      type: "boolean",
      title: "Include archive",
      description: "Sync archive memos",
      default: false,
    },
    {
      key: "autoSync",
      type: "boolean",
      title: "Auto Sync",
      description: "Also sync when open Logseq",
      default: false,
    },
    {
      key: "mode",
      type: "enum",
      title: "Mode",
      description: "Mode to Sync Memos",
      default: "Custom Page",
      enumChoices: ["Journal", "Custom Page"],
      enumPicker: "select",
    },
    {
      key: "customPage",
      type: "string",
      title: "Custom Page",
      description:
        "When you using `Custom Page` mode. You can choose a page to store Sync Memos",
      default: "Memos",
    },
    {
      key: "backgroundSync",
      type: "enum",
      title: "Background Sync",
      description:
        "Sync Memos background, you can set this to `Half-Hourly` or `Hourly` or `Bi-Hourly`",
      default: "Off",
      enumChoices: ["Off", "Half-Hourly", "Hourly", "Bi-Hourly"],
      enumPicker: "select",
    },
    {
      key: "backgroundNotify",
      type: "boolean",
      title: "Background Sync Notify",
      description:
        "When doing background, did you want any notify? Will close error message too.",
      default: true,
    },
  ]);

  const memosSync = new MemosSync();

  logseq.App.registerCommandPalette(
    { key: "sync-memos", label: "Sync Memos" },
    async (e: IHookEvent) => {
      logseq.UI.showMsg("Staring Sync Memos");
      memosSync.syncMemos();
    }
  );
  logseq.onSettingsChanged((e: IHookEvent) => {
    console.log(e);
    memosSync.parseSetting();
  });

  logseq.Editor.registerSlashCommand("Post memo", async () => {
    const entity: BlockEntity | null = await logseq.Editor.getCurrentBlock()
    if (entity) {
      await memosSync.publish(entity);
    }
  },);

  memosSync.autoSyncWhenStartLogseq();
}

logseq.ready(main).catch(console.error);
