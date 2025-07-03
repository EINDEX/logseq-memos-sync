# Memos V1 API Fixes

This document summarizes the fixes made to support the Memos V1 API in the Logseq plugin.

## Issues Fixed

1. **Incorrect API endpoints**:
   - Changed `/api/v1/memo` to `/api/v1/memos` for listing memos
   - Changed `/api/v1/memo/{id}` to `/api/v1/memos/{id}` for updates
   - Changed `/api/v1/user/me` to `/api/v1/users/me` for user info

2. **Response format transformation**:
   - V1 API returns different field names than expected by the plugin
   - Added transformation from V1 format (name, createTime, etc.) to V0 format (id, createdTs, etc.)
   - Properly extract memo ID from the `name` field (e.g., "memos/123" → 123)

3. **Request parameters**:
   - Changed from `limit`/`offset` to `pageSize`/`pageToken`
   - Removed incorrect `rowStatus` filter (V1 API doesn't support it)
   - Added client-side filtering for archived memos

4. **HTTP headers**:
   - Added proper Accept and Content-Type headers
   - Ensured proper JSON response handling

## Files Modified

- `src/memos/impls/clientV1.ts`: Main V1 client implementation
- `src/memos.ts`: Fixed typo "fitler" → "filter"

## Testing

The plugin has been tested and can now:
- ✅ Connect to Memos V1 API
- ✅ Fetch memos list
- ✅ Create new memos
- ✅ Update existing memos
- ✅ Get user information

## Build

Run `pnpm build` to build the plugin with these fixes.