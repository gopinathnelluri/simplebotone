const Binance = require('binance-api-node').default;
const client = Binance({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});

let lastPrice = 0;
let portfolio = { BTCUSDT: { quantity: 0, purchasePrice: 0 }, USDT: { balance: 0 } };

// Define your scalping strategy
const scalpingStrategy = async () => {
  // Get the current account balance and purchase price of the symbol from portfolio if any
  const accountInfo = await client.accountInfo();
  let symbol = "BTCUSDT"
  let balance = accountInfo.balances.find(coin => coin.asset === symbol).free;
  let quantity = balance;
  if (portfolio[symbol]) {
    quantity = portfolio[symbol].quantity;
    lastPrice = portfolio[symbol].purchasePrice;
  }

  // Get the current USDT balance
  let usdtBalance = accountInfo.balances.find(coin => coin.asset === 'USDT').free;
  if (portfolio.USDT) {
    usdtBalance = portfolio.USDT.balance;
  }

  // Get the current price of the asset you want to trade
  const ticker = await client.prices();
  let price = ticker[symbol];
  if(lastPrice == 0){
    lastPrice = price;
  }
  // Get the trading fee
  const makerFee = accountInfo.makerCommission / 100;
  const takerFee = accountInfo.takerCommission / 100;
  
  if(price > (lastPrice*(1+ makerFee+takerFee))*1.002){
    // Implement your strategy logic here
    // Place a sell order
    let sellQuantity = quantity;
    const order = await client.order({
        symbol: symbol,
        side: 'SELL',
        type: 'MARKET',
        quantity: sellQuantity,
      });
      console.log(order);
      lastPrice = price;
      portfolio[symbol] = { quantity: 0, purchasePrice: lastPrice };
      portfolio.USDT.balance = usdtBalance + sellQuantity * price;
    } else if(price < (lastPrice * 0.998)){
      // Implement your strategy logic here
      // Place a buy order
      let buyQuantity = usdtBalance / price;
      const order = await client.order({
        symbol: symbol,
        side: 'BUY',
        type: 'MARKET',
        quantity: buyQuantity,
      });
      console.log(order);
      lastPrice = price;
      portfolio[symbol] = { quantity: buyQuantity, purchasePrice: lastPrice };
      portfolio.USDT.balance = usdtBalance - buyQuantity * price;
    }
  }
  
  // Run your strategy every 'x' minutes
  setInterval(scalpingStrategy, 60000);
  