import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
if (!MCP_AUTH_TOKEN) {
  console.error('❌ MCP_AUTH_TOKEN not set. Run with: node --env-file=.env test-live.mjs');
  process.exit(1);
}

async function test() {
  const baseUrl = new URL('http://localhost:3000/mcp');
  const transport = new StreamableHTTPClientTransport(baseUrl, {
    authProvider: {
      tokens: () => Promise.resolve({ access_token: MCP_AUTH_TOKEN }),
      saveTokens: () => {},
    }
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  
  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server');
    
    const tools = await client.listTools();
    console.log('✅ Tools found:', tools.tools.length);
    console.log('Tool names:', tools.tools.map(t => t.name).join(', '));
    
    // Test order_list (safer than creating orders)
    console.log('\n📦 Testing order_list...');
    const orders = await client.callTool({
      name: 'order_list',
      arguments: {}
    });
    console.log('✅ order_list result:', JSON.stringify(orders, null, 2).substring(0, 500));
    
    // Test shipping_rate_calculator
    console.log('\n🚚 Testing shipping_rate_calculator...');
    const rates = await client.callTool({
      name: 'shipping_rate_calculator',
      arguments: {
        pickup_postcode: '110001',
        delivery_postcode: '110092',
        weight: 1,
        cod: 0
      }
    });
    console.log('✅ shipping_rate_calculator result:', JSON.stringify(rates, null, 2).substring(0, 500));
    
    // Test list_pickup_addresses
    console.log('\n📍 Testing list_pickup_addresses...');
    const addresses = await client.callTool({
      name: 'list_pickup_addresses',
      arguments: {}
    });
    console.log('✅ list_pickup_addresses result:', JSON.stringify(addresses, null, 2).substring(0, 500));
    
    await client.close();
    console.log('\n✅ All tests completed successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause) console.error('Cause:', error.cause);
    process.exit(1);
  }
}

test();