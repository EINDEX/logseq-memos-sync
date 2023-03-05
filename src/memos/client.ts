import axios, { AxiosResponse } from "axios";
import { ListMemo, Memo, SingleMemo } from "./type";

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

  public async getMemos(includeArchive: boolean): Promise<Array<Memo>> {
    const url = new URL(`${this.host}/api/memo`);
    url.searchParams.append("openId", String(this.openId));
    if (!includeArchive) {
      url.searchParams.append("rowStatus", "NORMAL");
    }
    url.searchParams.append("limit", "1000");
    const resp: AxiosResponse<ListMemo> = await axios.get(url.toString());
    if (resp.status !== 200) {
      throw "Connect issue";
    }
    return resp.data.data;
  }

  public async updateMemo(
    memoId: number,
    payload: Record<string, any>
  ): Promise<Memo> {
    const url = new URL(`${this.host}/api/memo/${memoId}`);
    url.searchParams.append("openId", String(this.openId));
    const resp: AxiosResponse<SingleMemo> = await axios.patch(
      url.toString(),
      payload
    );
    if (resp.status !== 200) {
      throw "Connect issue";
    } else if (resp.status >= 400 && resp.status < 500) {
      throw resp.data.message;
    }
    return resp.data.data;
  }

  public async createMemo(content: string, visibility: string): Promise<Memo> {
    const payload = {
      content: content,
      visibility: visibility,
    };
    const url = new URL(`${this.host}/api/memo`);
    url.searchParams.append("openId", String(this.openId));
    const resp: AxiosResponse<SingleMemo> = await axios.post(
      url.toString(),
      payload
    );
    if (resp.status !== 200) {
      throw "Connect issue";
    } else if (resp.status >= 400 && resp.status < 500) {
      throw resp.data.message;
    }
    return resp.data.data;
  }
}
