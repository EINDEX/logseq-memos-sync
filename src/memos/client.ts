import MemosClientV1 from "./impls/clientV1";
import MemosClientV0 from "./impls/clientV0";
import { Memo } from "./type";

export interface MemosClient {
  getMemos(
    limit: number,
    offset: number,
    includeArchive: boolean
  ): Promise<Memo[]>;
  updateMemo(memoId: number, payload: Record<string, any>): Promise<Memo>;
  createMemo(content: string, visibility: string): Promise<Memo>;
}

export default class MemosGeneralClient {
  private v1: MemosClientV1;
  private v0: MemosClientV0;

  constructor(host: string, token: string, openId?: string) {
    console.log("memos-sync: MemosGeneralClient constructor - host:", host, "hasToken:", !!token, "hasOpenId:", !!openId);
    if (!openId && !token) {
      throw "Token not exist";
    }
    this.v1 = new MemosClientV1(host, token, openId);
    this.v0 = new MemosClientV0(host, token, openId);
  }

  public async getClient(): Promise<MemosClient> {
    console.log("memos-sync: Using Memos V1 API");
    return this.v1;
  }
}
