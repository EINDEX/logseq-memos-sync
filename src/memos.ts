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
      return { content: item };
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
  private timerId: NodeJS.Timer | undefined;

  constructor() {
    this.parseSetting();
  }

  /**
   * syncMemos
   */
  public async syncMemos(mode = "Manual") {
    try {
      await this.sync();
      if (mode !== "Background" || this.backgroundNotify) {
        logseq.UI.showMsg("Moes Sync Success", "success");
      }
    } catch (e) {
      console.error(e);
      if (mode !== "Background" || this.backgroundNotify) {
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

  private openAPI() {
    const url = new URL(`${this.host}/api/memo`);
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

      this.backgroundConfigChange();
    } catch (e) {
      console.error(e);
      logseq.UI.showMsg("Memos OpenAPI is not a URL", "error");
    }
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
      },
    };
    if (this.mode === "Custom Page") {
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
      return await logseq.Editor.appendBlockInPage(
        journalPage,
        renderMemoParentBlockContent(memo, preferredDateFormat, true),
        opts
      );
    } else {
      throw "Not Support this Mode";
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
}

export default MemosSync;
