import { BlockEntity } from "@logseq/libs/dist/LSPlugin";
import { BackgroundSync } from "./settings";

export const sleep = (waitSec: number): Promise<void> => {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve();
    }, waitSec);
  });
};

export const tagFilterList = (tagFilter: string): Array<string> => {
  if (tagFilter && tagFilter.trim()) {
    return tagFilter!
      .split("|")
      .map((item) => `#${item.trim()}`)
      .filter((item) => item !== "#");
  }
  return [];
};

export const timeSpentByConfig = (word: string): number => {
  switch (word) {
    case BackgroundSync.Minutely:
      return 60 * 1000;
    case BackgroundSync.Hourly:
      return 60 * 60 * 1000;
    case BackgroundSync.HalfHourly:
      return 30 * 60 * 1000;
    case BackgroundSync.BiHourly:
      return 2 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
};

export const searchExistsMemo = async (
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

export const getMemoId = (properties: Record<string, any>): number | null => {
  if (!properties) {
    return null;
  }
  const memoId = properties["memoId"] || properties["memoid"];
  if (memoId) {
    console.log("memos", memoId);
    return parseInt(memoId);
  }
  return null;
};
