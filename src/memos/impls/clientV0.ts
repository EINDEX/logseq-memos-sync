import axios, { AxiosResponse, Method } from "axios";
import { Memo } from "../type";
import { MemosClient } from "../client";

type MemosAPIResponse<T> = {
  data: T;
  message: string;
};

export default class MemosClientV0 implements MemosClient {
  private openId: string | undefined;
  private host: string;
  private token: string;

  constructor(host: string, token: string, openId?: string) {
    this.host = host;
    this.openId = openId;
    this.token = token;
  }

  private async request<T>(
    url: URL,
    method: Method,
    payload: any
  ): Promise<T> {
    try {
      if (this.openId) {
        url.searchParams.append("openId", String(this.openId));
      }
      const resp: AxiosResponse<MemosAPIResponse<T>> = await axios({
        method: method,
        url: url.toString(),
        data: payload,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (resp.status !== 200) {
        throw "Something wrong!";
      } else if (resp.status >= 400 && resp.status < 500) {
        throw resp.data?.message || "Error occurred";
      }
      const data = resp.data.data;
      return data;
    } catch (error) {
      throw "Cannot connect to memos server";
    }
  }

  public async getMemos(
    limit: number,
    offset: number,
    includeArchive: boolean
  ): Promise<Memo[]> {
    const url = new URL(`${this.host}/api/memo`);
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
    const url = new URL(`${this.host}/api/memo/${memoId}`);
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
    const url = new URL(`${this.host}/api/memo`);
    url.searchParams.append("openId", String(this.openId));
    try {
      return await this.request<Memo>(url, "POST", payload);
    } catch (error) {
      throw new Error(`Failed to create memo, ${error}.`);
    }
  }
}
