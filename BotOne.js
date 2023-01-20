const pm2 = require('pm2');
const Binance = require('binance-api-node').default;
const fs = require('fs');
const config = JSON.parse(fs.readFileSync("configBotOne.json"));

// Creating the Binance client object 
let client = Binance({
  apiKey: config.apiKey,
  apiSecret: config.apiSecret,
});

let lastPrice = 0;
let portfolio = { USDT: { balance: 0 } };

// Read the portfolio from file system if it exists
if(config.paperTrading){
    console.log("PaperTrading Mode Enabled!")
    if(fs.existsSync("portfolio.json")) {
        portfolio = JSON.parse(fs.readFileSync("portfolio.json"));
      } else {
          console.log("No Portfolio found in file system, initialing the USDT balance to 100");
          portfolio = { USDT: { balance: 100 } };  
      }      
}

// Define your scalping strategy
const scalpingStrategy = async () => {
    let symbol = config.symbol;
    let price;
    //get the price from binance
    price = await client.prices();
    price = price[symbol];

  
    // Fetch the Account info and update portfolio
    if(!config.paperTrading){
      // Get the current account balance and purchase price of the symbol from portfolio if any
      const accountInfo = await client.accountInfo();
      let balance = accountInfo.balances.find(coin => coin.asset === symbol).free;
      if(balance > 0){
        // get the last purchase price of a symbol
        const trades = await client.myTrades({ symbol: symbol, limit: 1 });
        let purchasePrice = 0;
        if(trades.length > 0){
          if (trades[0].isBuyer) {
            purchasePrice = trades[0].price;
          }
        }
        portfolio[symbol] = { balance, purchasePrice };
        lastPrice = purchasePrice;
      }
      else {
        lastPrice = 0;
        portfolio[symbol] = { balance: 0, purchasePrice: 0};
      }
  
      // Get the current USDT balance
      let usdtBalance = accountInfo.balances.find(coin => coin.asset === 'USDT').free;
      portfolio.USDT.balance = usdtBalance;
    } else {
      // check portfolio if it contains the symbol
      if(portfolio[symbol]){
        lastPrice = portfolio[symbol].purchasePrice;
      } else {
        lastPrice = 0;
        portfolio[symbol] = { balance: 0, purchasePrice: 0};
      }
    }

    console.log(price, lastPrice, (lastPrice*(1-config.stopLoss)), (lastPrice*(1+config.profitMargin)));
    // Check if the stopLoss is defined
    if (config.stopLoss && lastPrice && price < lastPrice*(1-config.stopLoss)) {
      sell(symbol, portfolio, price, 'STOPLOSS');
    }
    // Check if the price is above the purchasePrice
    else if(lastPrice && price > lastPrice*(1+config.profitMargin)) {
        sell(symbol, portfolio, price);
    }
    
    // Check if the price is below the purchasePrice
    else if(lastPrice == 0 || (lastPrice && price < lastPrice*(1-config.profitMargin))) {
        buy(symbol, portfolio, price);
    }
  };
  

// Define the buy function
const buy = async (symbol, portfolio, price) => {
  let buyQuantity = (portfolio.USDT.balance*config.leverage)/price;
  if(!config.paperTrading){
    const order = await client.order({
      symbol: symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity: buyQuantity,
    });
    console.log(`Buy order placed for ${buyQuantity} ${symbol} at market price, Portfolio Balance in USDT: ${(portfolio.USDT.balance + (portfolio[symbol].balance * price))}`);

    // Log the trade to metrics table
    // pm2.emit('trade', {
    //   tradeType: 'BUY',
    //   symbol: symbol,
    //   quantity: buyQuantity,
    //   price: price,
    //   timestamp: Date.now()
    // });
  } else {
    console.log(`Buy order placed for ${buyQuantity} ${symbol} at market price, Portfolio Balance in USDT: ${(portfolio.USDT.balance + (portfolio[symbol].balance * price))}`);
  }
//   // Update the portfolio
//   portfolio[symbol].balance += buyQuantity;
//   portfolio[symbol].purchasePrice = price;
//   portfolio.USDT.balance -= buyQuantity * price;

  if(portfolio[symbol].balance) {
    let totalQuantity = portfolio[symbol].balance + buyQuantity;
    let totalCost = (portfolio[symbol].balance * portfolio[symbol].purchasePrice) + (buyQuantity * price);
    portfolio[symbol].purchasePrice = totalCost / totalQuantity;
    portfolio[symbol].balance = totalQuantity;
  } else {
    portfolio[symbol].balance = buyQuantity;
    portfolio[symbol].purchasePrice = price;
  }
  portfolio.USDT.balance -= buyQuantity * price;
}

// Define the sell function
const sell = async (symbol, portfolio, price, tradeType='SELL') => {
  let sellQuantity = portfolio[symbol].balance;
  if(!config.paperTrading){
    const order = await client.order({
      symbol: symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity: sellQuantity,
    });
    console.log(`Sell order placed for ${sellQuantity} ${symbol} at market price, Portfolio Balance in USDT: ${(portfolio.USDT.balance +(sellQuantity * price))}` + (tradeType != "SELL")? "(STOP LOSS)": "");

    // Log the trade to metrics table
    // pm2.emit('trade', {
    //   tradeType: tradeType,
    //   symbol: symbol,
    //   quantity: sellQuantity,
    //   price: price,
    //   timestamp: Date.now()
    // });
  } else {
    console.log(`Sell order placed for ${sellQuantity} ${symbol} at market price, Portfolio Balance in USDT: ${(portfolio.USDT.balance +(sellQuantity * price))}` + (tradeType != "SELL")? "(STOP LOSS)": "");
  }
  // Update the portfolio
  portfolio[symbol].balance = 0;
  portfolio[symbol].purchasePrice = 0;
  portfolio.USDT.balance += sellQuantity * price;
}

// // Start the strategy
// pm2.connect(() => {
//   pm2.start({
//     script: 'app.js',
//     exec_mode: 'fork',
//     instances: 1,
// }, (err) => {
//     if (err) throw err;
//     setInterval(scalpingStrategy, config.interval);
//   });
// });

setInterval(scalpingStrategy, config.interval);

// // Save the portfolio to file system everytime it gets updated
// setInterval(() => {
//   fs.writeFileSync("portfolio.json", JSON.stringify(portfolio));
// }, 10000);


