import "@logseq/libs";

import { BlockEntity, IHookEvent } from "@logseq/libs/dist/LSPlugin";
import settingSchema, { Visibility } from "./settings";
import MemosSync from "./memos";

function main() {
  console.info("memos-sync: Logseq Memos Plugin Loading!");

  settingSchema();

  const memosSync = new MemosSync();

  logseq.App.registerCommandPalette(
    { key: "sync-memos", label: "Sync Memos" },
    async () => {
      logseq.UI.showMsg("Staring Sync Memos");
      memosSync.syncMemos();
    }
  );

  logseq.onSettingsChanged((e: IHookEvent) => {
    memosSync.parseSetting();
  });

  const { sendVisibility }: any = logseq.settings;
  sendVisibility.forEach((visibility: Visibility) => {
    logseq.Editor.registerSlashCommand(
      `memos: Send in ${visibility}`,
      async () => {
        const entity: BlockEntity | null =
          await logseq.Editor.getCurrentBlock();
        await memosSync.post(entity, visibility);
      }
    );
  });

  memosSync.autoSyncWhenStartLogseq();
}

logseq.ready(main).catch(console.error);
