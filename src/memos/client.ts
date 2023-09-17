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
    if (!openId && !token) {
      throw "Token not exist";
    }
    this.v1 = new MemosClientV1(host, token, openId);
    this.v0 = new MemosClientV0(host, token, openId);
  }

  public async getClient(): Promise<MemosClient> {
    try {
      await this.v1.me();
      return this.v1;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Not Found")) {
        return this.v0;
      }
      throw error;
    }
  }
}
