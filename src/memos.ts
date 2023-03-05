import "@logseq/libs";
import { BlockEntity, IBatchBlock } from "@logseq/libs/dist/LSPlugin";
import axios, { AxiosResponse } from "axios";
import { format } from "date-fns";
import { sleep } from "./utils";

const BREAK_LINE = "!!!-!!!";

type Memo = {
  content: string;
  id: number;
  rowStatus: string;
  updatedTs: number;
  visibility: string;
  displayTs: number;
  createdTs: number;
};

type ListMemo = {
  data: Memo[];
};

type SingleMemo = {
  data: Memo;
  message: string;
};

const searchExistsMemo = async (
  memoId: number
): Promise<BlockEntity | null> => {
  const memo_blocks: BlockEntity[] | null = await logseq.DB.q(
    `(or (property memoid ${memoId}) (property memo-id ${memoId}))`
  );
  if (memo_blocks && memo_blocks.length > 0) {
    return memo_blocks[0];
  }
  return null;
};

const memoContentGenerate = (
  memo: Memo,
  preferredTodo: string,
): IBatchBlock[] => {
  let content = memo.content;
  content = content.replaceAll(/^[-\*] /gm, "* ");
  content = content.replaceAll(
    /^\* \[ \](.*)/gm,
    `${BREAK_LINE}${preferredTodo} $1 ${BREAK_LINE}`
  );
  content = content.replaceAll(
    /^\* \[x\](.*)/gm,
    `${BREAK_LINE}DONE $1 ${BREAK_LINE}`
  );
  const result = content.split(BREAK_LINE).filter((item) => !!item.trim());
  return result
    .filter((item) => !!item.trim())
    .map((item) => {
      const data: IBatchBlock = { content: item };
      return data;
    });
};

const renderMemoParentBlockContent = (
  memo: Memo,
  preferredDateFormat: string,
  isJournal: boolean,
  isGrouped: boolean
) => {
  const createDate = new Date(memo.createdTs * 1000);
  if (isGrouped) {
    return `${format(createDate, "HH:mm")}`;
  }
  if (isJournal) {
    return `${format(createDate, "HH:mm")} #memos`;
  }
  return `[[${format(createDate, preferredDateFormat)}]] ${format(
    createDate,
    "HH:mm"
  )} #memos`;
};

class MemosSync {
  private mode: string | undefined;
  private customPage: string | undefined;
  private openId: string | undefined;
  private host: string | undefined;
  private includeArchive: boolean | undefined;
  private autoSync: boolean | undefined;
  private backgroundSync: string | undefined;
  private archiveMemoAfterSync: boolean | undefined;
  private inboxName: string | undefined;
  private timerId: NodeJS.Timer | undefined;
  private sendVisibility: string | undefined;
  private tagFilter: string | undefined;

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

  public async autoSyncWhenStartLogseq() {
    await sleep(2000);
    if (this.autoSync) {
      await this.syncMemos();
    }
  }

  private timeSpentByConfig(word: string): number {
    switch (word) {
      case "Minutely":
        return 60 * 1000;
      case "Hourly":
        return 60 * 60 * 1000;
      case "Half-Hourly":
        return 30 * 60 * 1000;
      case "Bi-Hourly":
        return 2 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  }

  private backgroundConfigChange() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
    if (this.backgroundSync) {
      this.timerId = setInterval(() => {
        this.syncMemos("Background");
      }, this.timeSpentByConfig(this.backgroundSync));
    }
  }

  private openAPI(basePath = "/api/memo") {
    const url = new URL(`${this.host}${basePath}`);
    url.searchParams.append("openId", String(this.openId));
    if (!this.includeArchive) {
      url.searchParams.append("rowStatus", "NORMAL");
    }
    url.searchParams.append("limit", "1000");
    return url.toString();
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
        sendVisibility,
        tagFilter,
      }: any = logseq.settings;
      const openAPIURL = new URL(openAPI);
      this.host = openAPIURL.origin;
      const openId = openAPIURL.searchParams.get("openId");
      if (!openId) {
        throw "OpenId not exist";
      }
      this.openId = openId;
      this.mode = mode;
      this.autoSync = autoSync;
      this.customPage = customPage;
      this.includeArchive = includeArchive;
      this.backgroundSync = backgroundSync;
      this.archiveMemoAfterSync = archiveMemoAfterSync;
      this.inboxName = inboxName || "#Memos";
      this.tagFilter = tagFilter || "";

      sendVisibility.forEach((visibility: string) => {
        console.log(visibility);
        logseq.Editor.registerSlashCommand(
          `memos: Send in ${visibility}`,
          async () => {
            const entity: BlockEntity | null =
              await logseq.Editor.getCurrentBlock();
            await this.post(entity, visibility.toUpperCase());
          }
        );
      });

      this.backgroundConfigChange();
    } catch (e) {
      console.error(e);
      logseq.UI.showMsg("Memos OpenAPI is not a URL", "error");
    }
  }

  private tagFilterList(): Array<string> {
    if (this.tagFilter) {
      return this.tagFilter!.split("|")
        .map((item) => `#${item.trim()}`)
        .filter((item) => item !== "#");
    }
    return [];
  }

  public async post(block: BlockEntity | null, visibility: string | null) {
    if (block === null) {
      console.error("block is not exits");
      await logseq.UI.showMsg("block is not exits", "error");
    }
    const memoId =
      block?.properties?.get("memo-id") || block?.properties?.memoid;
    const memo =
      memoId !== undefined
        ? await this.updateMemos(
            memoId,
            block!.content,
            visibility || this.sendVisibility!
          )
        : await this.postMemo(
            block!.content,
            visibility || this.sendVisibility!
          );

    await logseq.Editor.upsertBlockProperty(block!.uuid, "memo-id", memo.id);
    await logseq.Editor.upsertBlockProperty(
      block!.uuid,
      "memo-visibility",
      memo.visibility
    );
    await logseq.UI.showMsg("Post memo success");
  }

  private async sync() {
    const memos = await this.fetchMemos();
    for (const memo of memos) {
      let flag = false;
      for (const tagFilter of this.tagFilterList()) {
        if (memo.content.includes(tagFilter)) {
          flag = true;
          break;
        }
      }
      if (this.tagFilterList().length !== 0 && !flag) {
        return;
      }
      const existMemo = await searchExistsMemo(memo.id);
      if (!existMemo) {
        await this.insertMemo(memo);
        if (this.archiveMemoAfterSync) {
          await this.archiveMemo(memo.id);
        }
      }
    }
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
    if (this.mode === "Custom Page") {
      return await logseq.Editor.appendBlockInPage(
        String(this.customPage),
        renderMemoParentBlockContent(memo, preferredDateFormat, false, false),
        opts
      );
    } else if (this.mode === "Journal") {
      const journalPage = format(
        new Date(memo.createdTs * 1000),
        preferredDateFormat
      );
      return await logseq.Editor.appendBlockInPage(
        journalPage,
        renderMemoParentBlockContent(memo, preferredDateFormat, true, false),
        opts
      );
    } else if (this.mode === "Journal Grouped") {
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
        renderMemoParentBlockContent(memo, preferredDateFormat, true, true),
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
    console.info({ page, inboxName });
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
      console.log(pageEntity);
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

  private async fetchMemos(): Promise<Memo[]> {
    const resp: AxiosResponse<ListMemo> = await axios.get(this.openAPI());
    if (resp.status !== 200) {
      logseq.Request;
      throw "Connect issue";
    }
    return resp.data.data;
  }

  private formatContentWhenPush(content: string) {
    return content
      .replaceAll(/^-?\S*?TODO /gm, "- [ ] ")
      .replaceAll(/^-?\S*?NOW /gm, "- [ ] ")
      .replaceAll(/^-?\S*?DONE /gm, "- [x] ")
      .replaceAll(/^memo-id::.*/gm, "")
      .replaceAll(/^memoid::.*/gm, "")
      .replaceAll(/^memo-visibility::.*/gm, "");
  }

  private async updateMemos(
    memoId: number,
    content: string,
    visibility: string
  ): Promise<Memo> {
    const payload = {
      id: `${memoId}`,
      content: `${this.formatContentWhenPush(content)}`,
      visibility: `${visibility}`,
    };
    return await this.patchSingleMemo(memoId, payload);
  }

  private async postMemo(content: string, visibility: string): Promise<Memo> {
    const payload = {
      content: `${this.formatContentWhenPush(content)}`,
      visibility: `${visibility}`,
    };
    const resp: AxiosResponse<SingleMemo> = await axios.post(
      this.openAPI(),
      payload
    );
    if (resp.status !== 200) {
      throw "Connect issue";
    }
    return resp.data.data;
  }

  private async archiveMemo(memoId: number): Promise<Memo> {
    const payload = {
      rowStatus: "ARCHIVED",
    };
    return await this.patchSingleMemo(memoId, payload);
  }

  private async patchSingleMemo(
    memoId: number,
    payload: Record<string, any>
  ): Promise<Memo> {
    const resp: AxiosResponse<SingleMemo> = await axios.patch(
      `${this.openAPI(`/api/memo/${memoId}`)}`,
      payload
    );
    if (resp.status !== 200) {
      throw "Connect issue";
    } else if (resp.status >= 400 || resp.status < 500) {
      logseq.UI.showMsg(resp.data.message, "error");
    }
    return resp.data.data;
  }
}

export default MemosSync;
