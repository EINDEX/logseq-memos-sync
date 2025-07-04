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
    console.log("memos-sync: V1 API request - method:", method, "url:", url.toString());
    console.log("memos-sync: V1 API request - headers:", {
      "Authorization": `Bearer ${this.token ? '***' : 'NO_TOKEN'}`,
      "Accept": "application/json",
      "Content-Type": "application/json"
    });
    
    try {
      if (this.openId) {
        url.searchParams.append("openId", String(this.openId));
        console.log("memos-sync: V1 API - Added openId to URL");
      }
      
      const config = {
        method: method,
        url: url.toString(),
        data: payload,
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        decompress: true,
        responseType: 'json' as const
      };
      
      console.log("memos-sync: V1 API - Making request...");
      const resp: AxiosResponse<T> = await axios(config);
      
      console.log("memos-sync: V1 API response - status:", resp.status);
      console.log("memos-sync: V1 API response - headers:", resp.headers);
      
      if (resp.status >= 400) {
        // @ts-ignore
        const errorMsg = resp.message || "Error occurred";
        console.error("memos-sync: V1 API error response:", errorMsg);
        throw errorMsg;
      } else if (resp.status >= 300) {
        console.error("memos-sync: V1 API unexpected status:", resp.status);
        throw "Something wrong!";
      } 
      
      console.log("memos-sync: V1 API request successful");
      return resp.data;
    } catch (error) {
      console.error("memos-sync: V1 API request failed:", error);
      if (axios.isAxiosError(error)) {
        console.error("memos-sync: Axios error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          headers: error.response?.headers
        });
      }
      throw "Cannot connect to memos server";
    }
  }


  public async getMemos(
    limit: number,
    offset: number,
    includeArchive: boolean,
  ): Promise<Memo[]> {
    console.log("memos-sync: V1 getMemos called - limit:", limit, "offset:", offset, "includeArchive:", includeArchive);
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
        console.log("memos-sync: V1 - No nextPageToken available for offset > 0, returning empty array");
        return [];
      }
      url.searchParams.append("pageToken", this.nextPageToken);
    }
    
    console.log("memos-sync: V1 API request URL:", url.toString());
    
    try {
      const response = await this.request<any>(url, "GET", {});
      console.log("memos-sync: V1 API raw response:", JSON.stringify(response, null, 2));
      
      let memos = response.memos || [];
      console.log("memos-sync: V1 - Retrieved", memos.length, "memos from API");
      
      // Store next page token for subsequent calls
      this.nextPageToken = response.nextPageToken || null;
      console.log("memos-sync: V1 - Next page token:", this.nextPageToken);
      
      // Filter out archived memos if needed
      if (!includeArchive) {
        const beforeFilter = memos.length;
        memos = memos.filter((memo: any) => memo.state === 'NORMAL');
        console.log("memos-sync: V1 - Filtered out", beforeFilter - memos.length, "archived memos");
      }
      
      // Transform V1 format to expected format
      const transformedMemos = memos.map((memo: any, index: number) => ({
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
      
      console.log("memos-sync: V1 - Returning", transformedMemos.length, "transformed memos");
      return transformedMemos;
    } catch (error) {
      console.error("memos-sync: V1 getMemos error:", error);
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
