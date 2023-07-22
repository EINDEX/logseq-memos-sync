import { IBatchBlock } from "@logseq/libs/dist/LSPlugin";
import { Mode } from "../settings";
import { Memo } from "./type";
import { format } from "date-fns";

const BREAK_LINE = "!!!-!!!";

export const formatContentWhenPush = (content: string) => {
  return content
    .replaceAll(/^-?\S*?TODO /gm, "- [ ] ")
    .replaceAll(/^-?\S*?NOW /gm, "- [ ] ")
    .replaceAll(/^-?\S*?DOING /gm, "- [ ] ")
    .replaceAll(/^-?\S*?DONE /gm, "- [x] ")
    .replaceAll(/\nmemo-id::.*/gm, "")
    .replaceAll(/\nmemoid::.*/gm, "")
    .replaceAll(/\nmemo-visibility::.*/gm, "");
};

export const memoContentGenerate = (
  memo: Memo,
  preferredTodo: string,
  withProperties: boolean = false
): IBatchBlock[] => {
  let content = memo.content;
  content = content.replaceAll(/^[-*] /gm, "* ");
  content = content.replaceAll(
    /^\* \[ \](.*)/gm,
    `${BREAK_LINE}${preferredTodo} $1 ${BREAK_LINE}`
  );
  content = content.replaceAll(
    /^\* \[x\](.*)/gm,
    `${BREAK_LINE}DONE $1 ${BREAK_LINE}`
  );
  const result = content.split(BREAK_LINE).filter((item) => !!item.trim());

  const children: IBatchBlock[] = [];
  if (memo.resourceList.length > 0){
    for(let i = 0; i < memo.resourceList.length; i++) {
      let resource = memo.resourceList[i];
      children.push({
        content: `![${resource.filename}](${resource.externalLink})`,
      })
    }
  }

  return result
    .filter((item) => !!item.trim())
    .map((item) => {
      const data: IBatchBlock = { content: item, properties: {} };
      if (withProperties) {
        data.properties = {
          "memo-id": memo.id,
        };
      }
      data.children = children;
      return data;
    });
};

export const renderMemoParentBlockContent = (
  memo: Memo,
  preferredDateFormat: string,
  mode: Mode
) => {
  const createDate = new Date(memo.createdTs * 1000);
  if (mode === Mode.JournalGrouped) {
    return `${format(createDate, "HH:mm")}`;
  } else if (mode === Mode.Journal) {
    return `${format(createDate, "HH:mm")} #memos`;
  }
  return `[[${format(createDate, preferredDateFormat)}]] ${format(
    createDate,
    "HH:mm"
  )} #memos`;
};
