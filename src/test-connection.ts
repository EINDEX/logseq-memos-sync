import MemosGeneralClient from "./memos/client";
import MemosClientV1 from "./memos/impls/clientV1";
import MemosClientV0 from "./memos/impls/clientV0";
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function testConnection() {
  const token = process.env.TOKEN;
  const host = process.env.HOST;

  if (!token || !host) {
    console.error("Missing TOKEN or HOST in .env file");
    return;
  }

  console.log("🔍 Testing Memos connection...");
  console.log(`Host: ${host}`);
  console.log(`Token: ${token.substring(0, 20)}...`);

  // Test both with and without port
  const hosts = [
    host, // With port 5230
    host.replace(":5230", ""), // Without port
  ];

  for (const testHost of hosts) {
    console.log(`\n📡 Testing host: ${testHost}`);
    
    try {
      // Test with MemosGeneralClient (auto-detection)
      console.log("\n1. Testing with MemosGeneralClient (auto-detection):");
      const generalClient = new MemosGeneralClient(testHost, token, undefined);
      const autoClient = await generalClient.getClient();
      console.log(`✅ Client detected: ${autoClient.constructor.name}`);
      
      // Get memos
      const memos = await autoClient.getMemos(10, 0, false);
      console.log(`✅ Successfully fetched ${memos.length} memos`);
      
      if (memos.length > 0) {
        console.log("\n📝 First memo:");
        const firstMemo = memos[0];
        console.log(`  ID: ${firstMemo.id}`);
        console.log(`  Content: ${firstMemo.content.substring(0, 50)}...`);
        console.log(`  Created: ${new Date(firstMemo.createdTs * 1000).toISOString()}`);
        console.log(`  Visibility: ${firstMemo.visibility}`);
        console.log(`  Pinned: ${firstMemo.pinned}`);
      }

      // Test V1 client directly
      console.log("\n2. Testing V1 client directly:");
      const v1Client = new MemosClientV1(testHost, token);
      const v1Memos = await v1Client.getMemos(5, 0, false);
      console.log(`✅ V1 API: Fetched ${v1Memos.length} memos`);

      // V1 API test successful

      console.log(`\n✅ SUCCESS: Connection to ${testHost} is working!`);
      console.log("The plugin should be able to sync memos from this host.");
      
    } catch (error: any) {
      console.error(`❌ Failed to connect to ${testHost}:`, error.message);
      
      // Try V0 API as fallback
      try {
        console.log("\n3. Trying V0 client as fallback:");
        const v0Client = new MemosClientV0(testHost, token, undefined);
        const v0Memos = await v0Client.getMemos(5, 0, false);
        console.log(`✅ V0 API: Fetched ${v0Memos.length} memos`);
        console.log(`✅ SUCCESS: V0 API connection to ${testHost} is working!`);
      } catch (v0Error: any) {
        console.error(`❌ V0 API also failed:`, v0Error.message);
      }
    }
  }
}

// Run the test
testConnection().then(() => {
  console.log("\n🏁 Test completed");
}).catch((error) => {
  console.error("\n💥 Test failed:", error);
});