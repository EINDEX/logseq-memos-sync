export type Memo = {
  content: string;
  id: number;
  rowStatus: string;
  updatedTs: number;
  visibility: string;
  displayTs: number;
  createdTs: number;
};

export type ListMemo = {
  data: Memo[];
};

export type SingleMemo = {
  data: Memo;
  message: string;
};