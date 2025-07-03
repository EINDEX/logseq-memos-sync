import axios, { AxiosResponse, Method } from "axios";
import { Memo } from "../type";
import { MemosClient } from "../client";

export default class MemosClientV1 implements MemosClient {
  private openId: string | undefined;
  private host: string;
  private token: string;
  private idMap: Map<number, string> = new Map(); // Map numeric IDs to V1 names
  private nextPageToken: string | null = null; // Store next page token

  constructor(host: string, token: string, openId?: string) {
    this.host = host;
    this.token = token;
    this.openId = openId;
  }

  // Generate a stable numeric ID from alphanumeric string
  private generateNumericId(name: string): number {
    const id = name.split('/').pop() || '';
    // Use a simple hash function to convert string to number
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Ensure positive number
    const numericId = Math.abs(hash);
    // Store mapping for reverse lookup
    this.idMap.set(numericId, name);
    return numericId;
  }

  private async request<T>(
    url: URL,
    method: Method,
    payload: any = null
  ): Promise<T> {
    try {
      if (this.openId) {
        url.searchParams.append("openId", String(this.openId));
      }
      const resp: AxiosResponse<T> = await axios({
        method: method,
        url: url.toString(),
        data: payload,
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        decompress: true,
        responseType: 'json'
      });
      if (resp.status >= 400) {
        // @ts-ignore
        throw resp.message || "Error occurred";
      } else if (resp.status >= 300) {
        throw "Something wrong!";
      } 
      return resp.data;
    } catch (error) {
      throw "Cannot connect to memos server";
    }
  }

  public async me() {
    const url = new URL(`${this.host}/api/v1/users/me`);
    return await this.request(url, "GET");
  }

  public async getMemos(
    limit: number,
    offset: number,
    includeArchive: boolean,
  ): Promise<Memo[]> {
    const url = new URL(`${this.host}/api/v1/memos`);
    // V1 API doesn't use filter for archive status
    // It returns all memos by default, we'll filter in the response
    
    // For V1 API, we'll fetch with the requested limit
    // The plugin's pagination logic will handle multiple calls
    url.searchParams.append("pageSize", limit.toString());
    
    // V1 API uses pageToken for pagination
    // Since the plugin expects numeric offset, we need to handle this
    // For now, we'll return empty array for offset > 0 if we don't have more data
    if (offset > 0) {
      // If we're beyond the first page and don't have a token, return empty
      if (!this.nextPageToken) {
        return [];
      }
      url.searchParams.append("pageToken", this.nextPageToken);
    }
    
    try {
      const response = await this.request<any>(url, "GET", {});
      let memos = response.memos || [];
      
      // Store next page token for subsequent calls
      this.nextPageToken = response.nextPageToken || null;
      
      // Filter out archived memos if needed
      if (!includeArchive) {
        memos = memos.filter((memo: any) => memo.state === 'NORMAL');
      }
      
      // Transform V1 format to expected format
      return memos.map((memo: any, index: number) => ({
        // V1 uses alphanumeric IDs, we'll use a hash or index for compatibility
        id: this.generateNumericId(memo.name),
        content: memo.content,
        createdTs: Math.floor(new Date(memo.createTime).getTime() / 1000),
        updatedTs: Math.floor(new Date(memo.updateTime).getTime() / 1000),
        displayTs: Math.floor(new Date(memo.displayTime).getTime() / 1000),
        rowStatus: memo.state,
        visibility: memo.visibility,
        pinned: memo.pinned || false,
        creatorId: parseInt(memo.creator.split('/').pop() || '0'),
        creatorName: memo.creator,
        creatorUsername: memo.creator,
        resourceList: memo.resources || [],
        relationList: memo.relations || [],
        // Store the original name for updates
        _v1Name: memo.name
      }));
    } catch (error) {
      throw new Error(`Failed to get memos, ${error}`);
    }
  }

  public async updateMemo(
    memoId: number,
    payload: Record<string, any>
  ): Promise<Memo> {
    // Get the V1 name from our ID mapping
    const v1Name = this.idMap.get(memoId);
    if (!v1Name) {
      throw new Error(`Memo ID ${memoId} not found in mapping`);
    }
    const v1Id = v1Name.split('/').pop();
    const url = new URL(`${this.host}/api/v1/memos/${v1Id}`);
    const updatePayload: any = {};
    
    if (payload.content) updatePayload.content = payload.content;
    if (payload.visibility) updatePayload.visibility = payload.visibility.toUpperCase();
    if (payload.rowStatus === "ARCHIVED") updatePayload.row_status = "ARCHIVED";
    
    try {
      const response = await this.request<any>(url, "PATCH", updatePayload);
      // Transform V1 response to expected format
      return {
        id: this.generateNumericId(response.name),
        content: response.content,
        createdTs: Math.floor(new Date(response.createTime).getTime() / 1000),
        updatedTs: Math.floor(new Date(response.updateTime).getTime() / 1000),
        displayTs: Math.floor(new Date(response.displayTime).getTime() / 1000),
        rowStatus: response.state,
        visibility: response.visibility,
        pinned: response.pinned || false,
        creatorId: parseInt(response.creator.split('/').pop() || '0'),
        creatorName: response.creator,
        creatorUsername: response.creator,
        resourceList: response.resources || [],
        relationList: response.relations || []
      };
    } catch (error) {
      throw new Error(`Failed to update memo, ${error}.`);
    }
  }

  public async createMemo(content: string, visibility: string): Promise<Memo> {
    const payload = {
      content: content,
      visibility: visibility.toUpperCase(),
    };
    const url = new URL(`${this.host}/api/v1/memos`);
    try {
      const response = await this.request<any>(url, "POST", payload);
      // Transform V1 response to expected format
      return {
        id: this.generateNumericId(response.name),
        content: response.content,
        createdTs: Math.floor(new Date(response.createTime).getTime() / 1000),
        updatedTs: Math.floor(new Date(response.updateTime).getTime() / 1000),
        displayTs: Math.floor(new Date(response.displayTime).getTime() / 1000),
        rowStatus: response.state,
        visibility: response.visibility,
        pinned: response.pinned || false,
        creatorId: parseInt(response.creator.split('/').pop() || '0'),
        creatorName: response.creator,
        creatorUsername: response.creator,
        resourceList: response.resources || [],
        relationList: response.relations || []
      };
    } catch (error) {
      throw new Error(`Failed to create memo, ${error}.`);
    }
  }
}
