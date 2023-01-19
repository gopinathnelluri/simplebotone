const Binance = require('binance-api-node').default;
let config = require('./config.json');

// Initialize the Binance API client
const client = Binance({
    apiKey: config.binance.apiKey,
    apiSecret: config.binance.apiSecret,
});

// Get account information
client.accountInfo().then(info => {
  console.log(info);
  
  // Extract the list of assets from the account info
  const assets = info.balances.filter(b => b.free > 0 || b.locked > 0);
  
  // Print the list of assets
  assets.forEach(a => {
    console.log(`${a.asset}: ${a.free} (free) ${a.locked} (locked)`);
  });
});