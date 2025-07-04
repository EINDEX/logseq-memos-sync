import "@logseq/libs";
import { BlockEntity, PageEntity } from "@logseq/libs/dist/LSPlugin";
import { format, max } from "date-fns";
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
  private host: string | undefined;
  private openId: string | undefined;
  private token: string | undefined;

  constructor() {
    this.parseSetting();
  }

  /**
   * syncMemos
   */
  public async syncMemos(mode = "Manual") {
    console.log("memos-sync: Starting sync process in mode:", mode);
    const { host, token, openId }: any = logseq.settings;
    console.log("memos-sync: Settings loaded - host:", host, "hasToken:", !!token, "hasOpenId:", !!openId);
    
    if (!host || (!openId && !token)) {
      console.error("memos-sync: Missing required settings");
      logseq.UI.showMsg("Memos Setting up needed.");
      logseq.showSettingsUI();
      return;
    }
    
    await this.choosingClient();
    if (this.memosClient === undefined || this.memosClient === null) {
      console.error("memos-sync: Failed to initialize Memos client");
      logseq.UI.showMsg("Memos Sync Setup issue", "error");
      return;
    }
    
    console.log("memos-sync: Client initialized successfully");
    try {
      await this.sync();
      console.log("memos-sync: Sync completed successfully");
      if (mode !== "Background") {
        logseq.UI.showMsg("Memos Sync Success", "success");
      }
    } catch (e) {
      console.error("memos-sync: Sync failed with error:", e);
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
    console.log("memos-sync: Starting sync process");
    await this.beforeSync();

    if (this.memosClient === undefined || this.memosClient === null) {
      await this.choosingClient();
    }

    let maxMemoId = (await this.lastSyncId()) || -1;
    console.log("memos-sync: Last sync ID:", maxMemoId);
    
    let newMaxMemoId = maxMemoId;
    let end = false;
    let cousor = 0;
    let totalProcessed = 0;
    let totalInserted = 0;
    
    while (!end) {
      console.log("memos-sync: Fetching memos batch - offset:", cousor, "batchSize:", BATCH_SIZE);
      const memos = await this.memosClient!.getMemos(
        BATCH_SIZE,
        cousor,
        this.includeArchive!
      );
      console.log("memos-sync: Retrieved", memos.length, "memos");

      const filteredMemos = this.memosFilter(memos);
      console.log("memos-sync: After filtering:", filteredMemos.length, "memos remain");

      for (const memo of filteredMemos) {
        totalProcessed++;
        if (memo.id <= maxMemoId && memo.pinned === false) {
          console.log("memos-sync: Reached already synced memo ID:", memo.id, "- stopping sync");
          end = true;
          break;
        }
        if (memo.id > newMaxMemoId) {
          newMaxMemoId = memo.id;
        }
        const existMemo = await searchExistsMemo(memo.id);
        if (!existMemo) {
          console.log("memos-sync: Inserting new memo ID:", memo.id);
          await this.insertMemo(memo);
          totalInserted++;
          if (
            this.archiveMemoAfterSync &&
            memo.visibility.toLowerCase() === Visibility.Private.toLowerCase()
          ) {
            console.log("memos-sync: Archiving private memo ID:", memo.id);
            await this.archiveMemo(memo.id);
          }
        } else {
          console.log("memos-sync: Skipping existing memo ID:", memo.id);
        }
      }
      if (memos.length < BATCH_SIZE) {
        console.log("memos-sync: Last batch received, ending sync");
        end = true;
        break;
      }
      cousor += BATCH_SIZE;
    }
    
    console.log("memos-sync: Sync complete - processed:", totalProcessed, "inserted:", totalInserted);
    console.log("memos-sync: Saving new sync ID:", newMaxMemoId);
    await this.saveSyncId(newMaxMemoId);
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
    const { host, token, openId }: any = logseq.settings;
    const client = new MemosGeneralClient(host, token, openId);
    try {
      this.memosClient = await client.getClient();
    } catch (error) {
      console.error("memos-sync: get client error", error);
    }
  }

  public parseSetting() {
    console.log("memos-sync: Parsing settings");
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
        host,
        openId,
        token,
      }: any = logseq.settings;
      
      console.log("memos-sync: Settings values:", {
        mode,
        customPage,
        includeArchive,
        autoSync,
        backgroundSync,
        inboxName,
        archiveMemoAfterSync,
        tagFilter,
        flat,
        host: host ? "***" : undefined,
        hasOpenId: !!openId,
        hasToken: !!token
      });
      
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
      this.host = host;
      this.openId = openId;
      this.token = token;

      console.log("memos-sync: Settings parsed successfully");
      this.backgroundConfigChange();
    } catch (e) {
      console.error("memos-sync: Error parsing settings:", e);
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

  private memosFilter(memos: Array<Memo>): Array<Memo> {
    if (!memos) {
      return [];
    }
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
    console.log("memos-sync: generateParentBlock - mode:", this.mode, "memoId:", memo.id);
    const opts = {
      properties: {
        "memo-id": memo.id,
      },
    };
    
    if (this.mode === Mode.CustomPage) {
      console.log("memos-sync: Using CustomPage mode - page:", this.customPage, "flat:", this.flat);
      if (this.flat) {
        const page = await this.ensurePage(this.customPage!);
        console.log("memos-sync: Ensured page:", page?.uuid);
        return page;
      }
      const content = renderMemoParentBlockContent(memo, preferredDateFormat, this.mode);
      console.log("memos-sync: Appending block with content:", content);
      return await logseq.Editor.appendBlockInPage(
        String(this.customPage),
        content,
        opts
      );
    } else if (this.mode === Mode.Journal) {
      const journalPage = format(
        new Date(memo.createdTs * 1000),
        preferredDateFormat
      );
      console.log("memos-sync: Using Journal mode - page:", journalPage, "flat:", this.flat);
      if (this.flat) {
        const page = await this.ensurePage(journalPage, true);
        console.log("memos-sync: Ensured journal page:", page?.uuid);
        return page;
      }
      const content = renderMemoParentBlockContent(memo, preferredDateFormat, this.mode);
      console.log("memos-sync: Appending block with content:", content);
      return await logseq.Editor.appendBlockInPage(
        journalPage,
        content,
        opts
      );
    } else if (this.mode === Mode.JournalGrouped) {
      const journalPage = format(
        new Date(memo.createdTs * 1000),
        preferredDateFormat
      );
      console.log("memos-sync: Using JournalGrouped mode - page:", journalPage, "inboxName:", this.inboxName);
      await this.ensurePage(journalPage, true);
      const groupedBlock = await this.checkGroupBlock(
        journalPage,
        String(this.inboxName)
      );
      console.log("memos-sync: Got grouped block:", groupedBlock?.uuid);
      if (this.flat) return groupedBlock;
      const content = renderMemoParentBlockContent(memo, preferredDateFormat, this.mode);
      console.log("memos-sync: Appending block with content:", content);
      return await logseq.Editor.appendBlockInPage(
        groupedBlock.uuid,
        content,
        opts
      );
    } else {
      console.error("memos-sync: Unsupported mode:", this.mode);
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
    console.log("memos-sync: insertMemo - Starting insertion for memo ID:", memo.id);
    const { preferredDateFormat, preferredTodo } =
      await logseq.App.getUserConfigs();
    console.log("memos-sync: User configs - dateFormat:", preferredDateFormat, "todo:", preferredTodo);
    
    const parentBlock = await this.generateParentBlock(
      memo,
      preferredDateFormat
    );
    if (!parentBlock) {
      console.error("memos-sync: Failed to create parent block for memo ID:", memo.id);
      throw "Not able to create parent Block";
    }
    console.log("memos-sync: Created parent block with UUID:", parentBlock.uuid);

    if (!this.host || (!this.openId && !this.token)) {
      throw new Error("Host or OpenId is undefined");
    }

    const batchBlocks = memoContentGenerate(
      memo,
      this.host,
      preferredTodo,
      !this.archiveMemoAfterSync &&
        this.flat &&
        memo.visibility.toLowerCase() === Visibility.Private.toLowerCase()
    );
    
    console.log("memos-sync: Generated batch blocks:", JSON.stringify(batchBlocks, null, 2));
    console.log("memos-sync: Inserting", batchBlocks.length, "blocks into parent UUID:", parentBlock.uuid);
    
    try {
      const result = await logseq.Editor.insertBatchBlock(
        parentBlock.uuid,
        batchBlocks,
        { sibling: false }
      );
      console.log("memos-sync: insertBatchBlock result:", result);
      console.log("memos-sync: Successfully inserted memo ID:", memo.id);
    } catch (error) {
      console.error("memos-sync: Failed to insert batch blocks:", error);
      throw error;
    }
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
