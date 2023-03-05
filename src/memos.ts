import "@logseq/libs";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin";
import { format } from "date-fns";
import MemosClient from "./memos/client";
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

  constructor() {
    this.parseSetting();
  }

  /**
   * syncMemos
   */
  public async syncMemos(mode = "Manual") {
    try {
      await this.sync();
      if (mode !== "Background") {
        logseq.UI.showMsg("Memos Sync Success", "success");
      }
    } catch (e) {
      console.error(e);
      if (mode !== "Background") {
        logseq.UI.showMsg(String(e), "error");
      }
    }
  }

  private async sync() {
    const memos = await this.memosClient!.getMemos(this.includeArchive!);
    for (const memo of this.memosFitler(memos)) {
      const existMemo = await searchExistsMemo(memo.id);
      if (!existMemo) {
        await this.insertMemo(memo);
        if (this.archiveMemoAfterSync) {
          await this.archiveMemo(memo.id);
        }
      }
    }
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

  public parseSetting() {
    try {
      const {
        openAPI,
        mode,
        customPage,
        includeArchive,
        autoSync,
        backgroundSync,
        inboxName,
        archiveMemoAfterSync,
        tagFilter,
      }: any = logseq.settings;
      this.memosClient = new MemosClient(openAPI);
      this.mode = mode;
      this.autoSync = autoSync;
      this.customPage = customPage;
      this.includeArchive = includeArchive;
      this.backgroundSync = backgroundSync;
      this.archiveMemoAfterSync = archiveMemoAfterSync;
      this.inboxName = inboxName || "#Memos";
      this.tagFilterList = tagFilterList(tagFilter);

      this.backgroundConfigChange();
    } catch (e) {
      console.error(e);
      logseq.UI.showMsg("Memos OpenAPI is not a URL", "error");
    }
  }

  public async post(block: BlockEntity | null, visibility: Visibility) {
    try {
      if (block === null) {
        console.error("block is not exits");
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
      console.error(error);
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

  private async generateParentBlock(
    memo: Memo,
    preferredDateFormat: string
  ): Promise<BlockEntity | null> {
    const opts = {
      properties: {
        "memo-id": memo.id,
        "memo-visibility": memo.visibility,
      },
    };
    if (this.mode === Mode.CustomPage) {
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
      const groupedBlock = await this.checkGroupBlock(
        journalPage,
        String(this.inboxName)
      );
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
  ): Promise<BlockEntity> {
    const pageEntity = await logseq.Editor.getPage(page, {
      includeChildren: true,
    });
    if (!pageEntity) {
      await logseq.Editor.createPage(page, {}, { journal: true });
    }

    const blocks = await logseq.Editor.getPageBlocksTree(page);

    const inboxBlock = blocks.find((block: { content: string }) => {
      console.log(block);
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
    await logseq.Editor.insertBatchBlock(
      parentBlock.uuid,
      memoContentGenerate(memo, preferredTodo),
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
}

export default MemosSync;
