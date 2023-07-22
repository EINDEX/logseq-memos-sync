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
      resourceList: [],
    };

    const res = memoContentGenerate(memo, "host", "openId", "TODO");
    expect(res[0]["content"]).toBe(codeBody);
  });
});
