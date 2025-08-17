import fetch from 'node-fetch';

async function testServer() {
  const ports = [4000, 3000, 5000, 8000];
  
  for (const port of ports) {
    try {
      console.log(`🔍 Testing port ${port}...`);
      const response = await fetch(`http://localhost:${port}/api/health`, {
        method: 'GET',
        timeout: 2000
      });
      
      if (response.ok) {
        console.log(`✅ Server found on port ${port}`);
        return port;
      }
    } catch (error) {
      console.log(`❌ Port ${port}: ${error.code || error.message}`);
    }
  }
  
  console.log('❌ No server found on any tested port');
  return null;
}

testServer(); 