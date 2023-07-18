import "@logseq/libs";
import { BlockEntity, PageEntity } from "@logseq/libs/dist/LSPlugin";
import { format } from "date-fns";
import { BATCH_SIZE } from "./constants";
import MemosGeneralClient, { MemosClient } from "./memos/client";
import { Memo } from "./memos/type";
import {
  formatContentWhenPush,
  memoContentGenerate,
  renderMemoParentBlockContent,
} from "./memos/utils";
import { Mode, Visibility } from "./settings";
import {
  sleep,
  tagFilterList,
  timeSpentByConfig,
  searchExistsMemo,
  getMemoId,
  fetchSyncStatus,
  saveSyncStatus,
} from "./utils";

class MemosSync {
  private mode: string | undefined;
  private customPage: string | undefined;
  private memosClient: MemosClient | undefined;
  private includeArchive: boolean | undefined;
  private autoSync: boolean | undefined;
  private backgroundSync: string | undefined;
  private archiveMemoAfterSync: boolean | undefined;
  private inboxName: string | undefined;
  private timerId: NodeJS.Timer | undefined;
  private tagFilterList: Array<string> | undefined;
  private flat: boolean | undefined;

  constructor() {
    this.parseSetting();
  }

  /**
   * syncMemos
   */
  public async syncMemos(mode = "Manual") {
    const { host, openId }: any = logseq.settings;
    if (!host || !openId) {
      logseq.UI.showMsg("Memos Setting up needed.");
      logseq.showSettingsUI();
    }
    await this.choosingClient();
    if (this.memosClient === undefined || this.memosClient === null) {
      logseq.UI.showMsg("Memos Sync Setup issue", "error");
    }
    try {
      await this.sync();
      if (mode !== "Background") {
        logseq.UI.showMsg("Memos Sync Success", "success");
      }
    } catch (e) {
      console.error("memos-sync: ", e);
      if (mode !== "Background") {
        logseq.UI.showMsg(String(e), "error");
      }
    }
  }

  private async lastSyncId(): Promise<number> {
    return (await fetchSyncStatus()).lastSyncId;
  }

  private async saveSyncId(memoId: number) {
    await saveSyncStatus(memoId);
  }

  private async beforeSync() {
    if (logseq.settings?.fullSync === "Agree") {
      logseq.updateSettings({ fullSync: "" });
      await saveSyncStatus(-1);
    }
  }

  private async sync() {
    await this.beforeSync();

    let maxMemoId = await this.lastSyncId();
    let newMaxMemoId = maxMemoId;
    let end = false;
    let cousor = 0;
    while (!end) {
      const memos = await this.memosClient!.getMemos(
        BATCH_SIZE,
        cousor,
        this.includeArchive!
      );
      for (const memo of this.memosFitler(memos)) {
        if (memo.id <= maxMemoId) {
          end = true;
          break;
        }
        if (memo.id > newMaxMemoId) {
          newMaxMemoId = memo.id;
        }
        const existMemo = await searchExistsMemo(memo.id);
        if (!existMemo) {
          await this.insertMemo(memo);
          if (
            this.archiveMemoAfterSync &&
            memo.visibility.toLowerCase() === Visibility.Private.toLowerCase()
          ) {
            await this.archiveMemo(memo.id);
          }
        }
      }
      if (memos.length < BATCH_SIZE) {
        end = true;
        break;
      }
      cousor += BATCH_SIZE;
    }
    this.saveSyncId(newMaxMemoId);
  }

  public async autoSyncWhenStartLogseq() {
    await sleep(2000);
    if (this.autoSync) {
      await this.syncMemos();
    }
  }

  private backgroundConfigChange() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
    if (this.backgroundSync) {
      this.timerId = setInterval(() => {
        this.syncMemos("Background");
      }, timeSpentByConfig(this.backgroundSync));
    }
  }

  private async choosingClient() {
    const { host, openId }: any = logseq.settings;
    const client = new MemosGeneralClient(host, openId);
    this.memosClient = await client.getClient();
  }

  public parseSetting() {
    this.configMigrate();
    try {
      const {
        mode,
        customPage,
        includeArchive,
        autoSync,
        backgroundSync,
        inboxName,
        archiveMemoAfterSync,
        tagFilter,
        flat,
      }: any = logseq.settings;
      this.choosingClient();
      this.mode = mode;
      this.autoSync = autoSync;
      this.customPage = customPage || "Memos";
      this.includeArchive = includeArchive;
      this.backgroundSync = backgroundSync;
      this.archiveMemoAfterSync = archiveMemoAfterSync;
      this.inboxName = inboxName || "#Memos";
      this.tagFilterList = tagFilterList(tagFilter);
      this.flat = flat;

      this.backgroundConfigChange();
    } catch (e) {
      console.error("memos-sync: ", e);
      logseq.UI.showMsg("Memos OpenAPI is not a URL", "error");
    }
  }

  public async post(block: BlockEntity | null, visibility: Visibility) {
    try {
      if (block === null) {
        console.error("memos-sync: block is not exits");
        await logseq.UI.showMsg("block is not exits", "error");
        return;
      }

      const memoId = getMemoId(block!.properties!);
      const memoContent = formatContentWhenPush(block!.content);
      const memoVisibility = visibility.toUpperCase();
      const memo =
        memoId !== null
          ? await this.updateMemos(memoId, memoContent, memoVisibility)
          : await this.postMemo(memoContent, memoVisibility);

      await logseq.Editor.upsertBlockProperty(block!.uuid, "memo-id", memo.id);
      await logseq.Editor.upsertBlockProperty(
        block!.uuid,
        "memo-visibility",
        memo.visibility
      );
      if (memoId !== null) {
        await logseq.UI.showMsg("Update memo success");
      } else {
        await logseq.UI.showMsg("Post memo success");
      }
    } catch (error) {
      console.error("memos-sync: ", error);
      await logseq.UI.showMsg(String(error), "error");
    }
  }

  private memosFitler(memos: Array<Memo>): Array<Memo> {
    return memos.filter((memo) => {
      if (this.tagFilterList!.length === 0) {
        return true;
      }
      for (const tagFilter of this.tagFilterList!) {
        if (memo.content.includes(tagFilter)) {
          return true;
        }
      }
      return false;
    });
  }

  private async ensurePage(page: string, isJournal: boolean = false) {
    const pageEntity = await logseq.Editor.getPage(page);
    if (!pageEntity) {
      return await logseq.Editor.createPage(page, {}, { journal: isJournal });
    }
    return pageEntity;
  }

  private async generateParentBlock(
    memo: Memo,
    preferredDateFormat: string
  ): Promise<BlockEntity | PageEntity | null> {
    const opts = {
      properties: {
        "memo-id": memo.id,
      },
    };
    if (this.mode === Mode.CustomPage) {
      if (this.flat) return await this.ensurePage(this.customPage!);
      return await logseq.Editor.appendBlockInPage(
        String(this.customPage),
        renderMemoParentBlockContent(memo, preferredDateFormat, this.mode),
        opts
      );
    } else if (this.mode === Mode.Journal) {
      const journalPage = format(
        new Date(memo.createdTs * 1000),
        preferredDateFormat
      );
      if (this.flat) return await this.ensurePage(journalPage, true);
      return await logseq.Editor.appendBlockInPage(
        journalPage,
        renderMemoParentBlockContent(memo, preferredDateFormat, this.mode),
        opts
      );
    } else if (this.mode === Mode.JournalGrouped) {
      const journalPage = format(
        new Date(memo.createdTs * 1000),
        preferredDateFormat
      );
      await this.ensurePage(journalPage, true);
      const groupedBlock = await this.checkGroupBlock(
        journalPage,
        String(this.inboxName)
      );
      if (this.flat) return groupedBlock;
      return await logseq.Editor.appendBlockInPage(
        groupedBlock.uuid,
        renderMemoParentBlockContent(memo, preferredDateFormat, this.mode),
        opts
      );
    } else {
      throw "Not Support this Mode";
    }
  }

  private async checkGroupBlock(
    page: string,
    inboxName: string
  ): Promise<BlockEntity | PageEntity> {
    const blocks = await logseq.Editor.getPageBlocksTree(page);

    const inboxBlock = blocks.find((block: { content: string }) => {
      return block.content === inboxName;
    });

    if (!inboxBlock) {
      const newInboxBlock = await logseq.Editor.appendBlockInPage(
        page,
        inboxName
      );
      if (!newInboxBlock) {
        throw "Memos: Cannot create new inbox block";
      }
      return newInboxBlock;
    } else {
      return inboxBlock;
    }
  }

  private async insertMemo(memo: Memo) {
    const { preferredDateFormat, preferredTodo } =
      await logseq.App.getUserConfigs();
    const parentBlock = await this.generateParentBlock(
      memo,
      preferredDateFormat
    );
    if (!parentBlock) {
      throw "Not able to create parent Block";
    }
    console.debug("memos-sync: parentBlock", parentBlock);
    await logseq.Editor.insertBatchBlock(
      parentBlock.uuid,
      memoContentGenerate(
        memo,
        preferredTodo,
        !this.archiveMemoAfterSync &&
          this.flat &&
          memo.visibility.toLowerCase() === Visibility.Private.toLowerCase()
      ),
      { sibling: false }
    );
  }

  private async updateMemos(
    memoId: number,
    content: string,
    visibility: string
  ): Promise<Memo> {
    const payload = {
      id: `${memoId}`,
      content: `${formatContentWhenPush(content)}`,
      visibility: `${visibility}`,
    };
    return await this.memosClient!.updateMemo(memoId, payload);
  }

  private async postMemo(content: string, visibility: string): Promise<Memo> {
    return await this.memosClient!.createMemo(
      formatContentWhenPush(content),
      visibility
    );
  }

  private async archiveMemo(memoId: number): Promise<Memo> {
    const payload = {
      rowStatus: "ARCHIVED",
    };
    return await this.memosClient!.updateMemo(memoId, payload);
  }

  private configMigrate() {
    // memos v0 -> v1
    const { openAPI, host, openId }: any = logseq.settings;
    if (openAPI && !host && !openId) {
      const memosUrl = new URL(openAPI);
      logseq.updateSettings({
        host: memosUrl.origin,
        openId: memosUrl.searchParams.get("openId"),
        openAPI: null,
      });
    }
  }
}

export default MemosSync;
