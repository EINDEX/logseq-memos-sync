import "@logseq/libs";
import { BlockEntity, IBatchBlock } from "@logseq/libs/dist/LSPlugin";
import axios from "axios";
import { AxiosResponse } from "axios";
import { format } from "date-fns";

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
    `(property memoid ${memoId})`
  );
  if (memo_blocks && memo_blocks.length > 0) {
    return memo_blocks[0];
  }
  return null;
};

const memoContentGenerate = (
  memo: Memo,
  preferredTodo: string
): IBatchBlock[] => {
  let content = memo.content;
  content = content.replaceAll(/^[-\*] /gm, "* ");
  content = content.replaceAll(
    /^\* \[ \](.*)/gm,
    `${BREAK_LINE}${preferredTodo} $1 ${BREAK_LINE}`
  );
  const result = content.split(BREAK_LINE).filter((item) => !!item.trim());
  return result
    .filter((item) => !!item.trim())
    .map((item) => {
      return { content: item, properties: {"memoid":memo.id,"memo-visibility": memo.visibility} };
    });
};

const renderMemoParentBlockContent = (
  memo: Memo,
  preferredDateFormat: string,
  isJournal: boolean
) => {
  const createDate = new Date(memo.createdTs * 1000);
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
  private backgroundNotify: boolean | undefined;
  private groupMemos: boolean | undefined;
  private inboxName: string | undefined;
  private timerId: NodeJS.Timer | undefined;
  private sendVisibility: string | undefined;

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
        logseq.UI.showMsg("Moes Sync Success", "success");
      }
    } catch (e) {
      console.error(e);
      if (mode !== "Background") {
        logseq.UI.showMsg(String(e), "error");
      }
    }
  }

  public async autoSyncWhenStartLogseq() {
    if (this.autoSync) {
      await this.syncMemos();
    }
  }

  private timeSpentByConfig(word: string): number {
    switch (word) {
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
        backgroundNotify,
        groupMemos,
        inboxName,
        sendVisibility,
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
      this.backgroundNotify = backgroundNotify;
      this.groupMemos = groupMemos;
      this.inboxName = inboxName;
      this.sendVisibility = sendVisibility.toUpperCase();

      this.backgroundConfigChange();
    } catch (e) {
      console.error(e);
      logseq.UI.showMsg("Memos OpenAPI is not a URL", "error");
    }
  }

  public async post(block: BlockEntity | null, visibility: string | null) {
    if (block === null) {
      console.error("block is not exits");
      await logseq.UI.showMsg("block is not exits", "error");
    }
    const memoId = block?.properties?.memoid;
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

    await logseq.Editor.upsertBlockProperty(block!.uuid, "memoid", memo.id);
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
      const existMemo = await searchExistsMemo(memo.id);
      if (!existMemo) {
        await this.insertMemo(memo);
      }
    }
  }

  private async generateParentBlock(
    memo: Memo,
    preferredDateFormat: string
  ): Promise<BlockEntity | null> {
    const opts = {
      properties: {
        memoid: memo.id,
        "memo-visibility": memo.visibility,
      },
    };
    if (this.mode === "Custom Page") {
      const groupBlock = await this.checkGroupBlock(String(this.customPage), String(this.inboxName));
      if (groupBlock) {
        return groupBlock;
      }
      return await logseq.Editor.appendBlockInPage(
        String(this.customPage),
        renderMemoParentBlockContent(memo, preferredDateFormat, false),
        opts
      );
    } else if (this.mode === "Journal") {
      const journalPage = format(
          new Date(memo.createdTs * 1000),
          preferredDateFormat
      );
      const groupBlock = await this.checkGroupBlock(journalPage, String(this.inboxName));
      if (groupBlock) {
        return groupBlock;
      }
      return await logseq.Editor.appendBlockInPage(
        journalPage,
        renderMemoParentBlockContent(memo, preferredDateFormat, true),
        opts
      );
    } else {
      throw "Not Support this Mode";
    }
  }

  private async checkGroupBlock(pageName: string, inboxName: string | null) : Promise<BlockEntity | null> {
    console.log({ pageName, inboxName });
    const pageBlocksTree = await logseq.Editor.getPageBlocksTree(pageName);

    if (inboxName === null || inboxName === "null") {
      console.log("No group");
      return pageBlocksTree[0];
    }

    const inboxBlock = pageBlocksTree.find((block: { content: string }) => {
      return block.content === inboxName;
    });

    if (!inboxBlock) {
      const newInboxBlock = await logseq.Editor.insertBlock(
          pageBlocksTree[pageBlocksTree.length - 1].uuid,
          inboxName,
          {
            before: !pageBlocksTree[pageBlocksTree.length - 1].content,
            sibling: true
          }
      );
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

  private filterOutProperties(content: string) {
    return content
      .replaceAll(/\nmemoid::.*/gm, "")
      .replaceAll(/\nmemo-visibility::.*/gm, "");
  }

  private async updateMemos(
    memoId: number,
    content: string,
    visibility: string
  ): Promise<Memo> {
    const payload = {
      id: `${memoId}`,
      content: `${this.filterOutProperties(content)}`,
      visibility: `${visibility}`,
    };
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

  private async postMemo(content: string, visibility: string): Promise<Memo> {
    const payload = {
      content: `${this.filterOutProperties(content)}`,
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
}

export default MemosSync;
