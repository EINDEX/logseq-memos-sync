import axios, { AxiosResponse, Method } from "axios";
import { Memo } from "../type";
import { MemosClient } from "../client";

export default class MemosClientV1 implements MemosClient {
  private openId: string;
  private host: string;

  constructor(host: string, openId: string) {
    this.host = host;
    this.openId = openId;
  }

  private async request<T>(
    url: URL,
    method: Method,
    payload: any = null
  ): Promise<T> {
    try {
      url.searchParams.append("openId", String(this.openId));
      const resp: AxiosResponse<T> = await axios({
        method: method,
        url: url.toString(),
        data: payload,
      });
      if (resp.status >= 400) {
        // @ts-ignore
        throw resp.data?.message || "Error occurred";
      } else if (resp.status >= 300) {
        throw "Something wrong!";
      } 
      return resp.data;
    } catch (error) {
      throw "Cannot connect to memos server";
    }
  }

  public async me() {
    const url = new URL(`${this.host}/api/v1/user/me`);
    return await this.request(url, "GET");
  }

  public async getMemos(
    limit: number,
    offset: number,
    includeArchive: boolean,
  ): Promise<Memo[]> {
    const url = new URL(`${this.host}/api/v1/memo`);
    if (!includeArchive) {
      url.searchParams.append("rowStatus", "NORMAL");
    }
    url.searchParams.append("limit", limit.toString());
    url.searchParams.append("offset", offset.toString());
    try {
      return await this.request<Memo[]>(url, "GET", {});
    } catch (error) {
      throw new Error(`Failed to get memos, ${error}`);
    }
  }

  public async updateMemo(
    memoId: number,
    payload: Record<string, any>
  ): Promise<Memo> {
    const url = new URL(`${this.host}/api/v1/memo/${memoId}`);
    try {
      return await this.request<Memo>(url, "PATCH", payload);
    } catch (error) {
      throw new Error(`Failed to update memo, ${error}.`);
    }
  }

  public async createMemo(content: string, visibility: string): Promise<Memo> {
    const payload = {
      content: content,
      visibility: visibility,
    };
    const url = new URL(`${this.host}/api/v1/memo`);
    try {
      return await this.request<Memo>(url, "POST", payload);
    } catch (error) {
      throw new Error(`Failed to create memo, ${error}.`);
    }
  }
}
