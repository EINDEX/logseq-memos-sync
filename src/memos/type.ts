type Base = {
  updatedTs: number;
  createdTs: number;
};

export type Resource = {
  id: number;
  filename: string;
  externalLink: string;
  type: string;
  size: number;
  linkedMemoAmount: number;
} & Base;

export type Memo = {
  content: string;
  id: number;
  rowStatus: string;
  visibility: string;
  displayTs: number;
  creatorId: number;
  pinned: boolean;
  creatorName: string;
  creatorUsername: string;
  resourceList: Resource[];
  relationList: [];
} & Base;
