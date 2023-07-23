import "@logseq/libs";
import { describe, it, expect } from "@jest/globals";
import { memoContentGenerate } from "../utils";
import { Memo } from "../type";

describe("memos to logseq format", () => {
  it("code body should have nothing changed", () => {
    const codeBody = `
\`\`\`python

def hello():
    return "world"

\`\`\`
`;
    const memo: Memo = {
      content: codeBody,
      id: 0,
      rowStatus: "NORMAL",
      updatedTs: 0,
      visibility: "PUBLIC",
      displayTs: 0,
      createdTs: 0,
      creatorId: 1,
      pinned: false,
      creatorName: "eindex",
      creatorUsername: "eindex",
      resourceList: [],
      relationList: [],
    };

    const res = memoContentGenerate(memo, "host", "openId", "TODO");
    expect(res[0]["content"]).toBe(codeBody);
  });

  it("public resources could rending without openId", () => {
    const memo: Memo = {
      id: 1,
      rowStatus: "NORMAL",
      creatorId: 1,
      createdTs: 1690045876,
      updatedTs: 1690079500,
      displayTs: 1690045876,
      content: "test",
      visibility: "PUBLIC",
      pinned: false,
      creatorName: "eindex",
      creatorUsername: "eindex",
      resourceList: [
        {
          id: 1,
          createdTs: 1690079497,
          updatedTs: 1690079497,
          filename: "memos.png",
          externalLink: "",
          type: "image/png",
          size: 1539508,
          linkedMemoAmount: 1,
        },
      ],
      relationList: [],
    };

    const res = memoContentGenerate(memo, "host", "openId", "TODO");
    expect(res[0].children?.length).toBe(1);
    expect(res[0].children![0].content).toBe("![memos.png](host/o/r/1)");
  });

  it("private resources could rending with openId", () => {
    const memo: Memo = {
      id: 1,
      rowStatus: "NORMAL",
      creatorId: 1,
      createdTs: 1690045876,
      updatedTs: 1690079500,
      displayTs: 1690045876,
      content: "test",
      visibility: "PRIVATE",
      pinned: false,
      creatorName: "eindex",
      creatorUsername: "eindex",
      resourceList: [
        {
          id: 1,
          createdTs: 1690079497,
          updatedTs: 1690079497,
          filename: "memos.png",
          externalLink: "",
          type: "image/png",
          size: 1539508,
          linkedMemoAmount: 1,
        },
      ],
      relationList: [],
    };

    const res = memoContentGenerate(memo, "host", "openId", "TODO");
    expect(res[0].children?.length).toBe(1);
    expect(res[0].children![0].content).toBe(
      "![memos.png](host/o/r/1?openId=openId)"
    );
  });

  it("private resources have external link should using external link", () => {
    const memo: Memo = {
      id: 1,
      rowStatus: "NORMAL",
      creatorId: 1,
      createdTs: 1690045876,
      updatedTs: 1690079500,
      displayTs: 1690045876,
      content: "test",
      visibility: "PRIVATE",
      pinned: false,
      creatorName: "eindex",
      creatorUsername: "eindex",
      resourceList: [
        {
          id: 1,
          createdTs: 1690079497,
          updatedTs: 1690079497,
          filename: "memos.png",
          externalLink: "link",
          type: "image/png",
          size: 1539508,
          linkedMemoAmount: 1,
        },
      ],
      relationList: [],
    };

    const res = memoContentGenerate(memo, "host", "openId", "TODO");
    expect(res[0].children?.length).toBe(1);
    expect(res[0].children![0].content).toBe("![memos.png](link)");
  });

  it("public resources have external link should using external link", () => {
    const memo: Memo = {
      id: 1,
      rowStatus: "NORMAL",
      creatorId: 1,
      createdTs: 1690045876,
      updatedTs: 1690079500,
      displayTs: 1690045876,
      content: "test",
      visibility: "PUBLIC",
      pinned: false,
      creatorName: "eindex",
      creatorUsername: "eindex",
      resourceList: [
        {
          id: 1,
          createdTs: 1690079497,
          updatedTs: 1690079497,
          filename: "memos.png",
          externalLink: "link",
          type: "image/png",
          size: 1539508,
          linkedMemoAmount: 1,
        },
      ],
      relationList: [],
    };

    const res = memoContentGenerate(memo, "host", "openId", "TODO");
    expect(res[0].children?.length).toBe(1);
    expect(res[0].children![0].content).toBe("![memos.png](link)");
  });
});
