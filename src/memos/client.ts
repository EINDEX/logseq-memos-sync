import axios, { AxiosResponse } from "axios";
import { ListMemo, Memo } from "./type";

type MemosAPIResponse<T> = {
  data:T;
  message: string;
};


export default class MemosClient {
  private openId: string;
  private host: string;

  constructor(openAPI: string) {
    const openAPIURL = new URL(openAPI);
    this.host = openAPIURL.origin;
    const openId = openAPIURL.searchParams.get("openId");
    if (!openId) {
      throw "OpenId not exist";
    }
    this.openId = openId;
  }


  private async request<T>(url: string, method: string, payload: any): Promise<T> {
    const resp: AxiosResponse<MemosAPIResponse<T>> = await axios({
      method: method,
      url: url,
      data: payload,
    });
    if (resp.status !== 200) {
      throw "Connect issue";
    } else if (resp.status >= 400 && resp.status < 500) {
      throw resp.data?.message || "Error occurred";
    }
    const data = resp.data.data;
    return data;  
  }

  public async getMemos(
    includeArchive: boolean,
    limit: number,
    offset: number
  ): Promise<Memo[]> {
    const url = new URL(`${this.host}/api/memo`);
    url.searchParams.append("openId", String(this.openId));
    if (!includeArchive) {
      url.searchParams.append("rowStatus", "NORMAL");
    }
    url.searchParams.append("limit", limit.toString());
    url.searchParams.append("offset", offset.toString());
    try {
      return await this.request<Memo[]>(url.toString(), "GET", {});
    } catch (error) {
      throw new Error(`Failed to get memos, ${error}`);
    }
  }

  public async updateMemo(
    memoId: number,
    payload: Record<string, any>
  ): Promise<Memo> {
    const url = new URL(`${this.host}/api/memo/${memoId}`);
    url.searchParams.append("openId", String(this.openId));
    try {
      return await this.request<Memo>(url.toString(), "PATCH", payload);
    } catch (error) {
      throw new Error(`Failed to update memo, ${error}.`);
    }
  }

  public async createMemo(content: string, visibility: string): Promise<Memo> {
    const payload = {
      content: content,
      visibility: visibility,
    };
    const url = new URL(`${this.host}/api/memo`);
    url.searchParams.append("openId", String(this.openId));
    try {
      return await this.request<Memo>(url.toString(), "POST", payload);
    } catch (error) {
      throw new Error(`Failed to create memo, ${error}.`);
    }
  }
}
