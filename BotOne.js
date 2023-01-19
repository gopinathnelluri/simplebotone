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
if (fs.existsSync("portfolio.json")) {
    portfolio = JSON.parse(fs.readFileSync("portfolio.json"));
}

// Define your scalping strategy
const scalpingStrategy = async () => {
    let symbol = config.symbol;
    let price;
    //get the price from binance
    price = await client.prices();
    price = price[symbol];
    if (!config.paperTrading) {
        // Get the current account balance and purchase price of the symbol from portfolio if any
        const accountInfo = await client.accountInfo();
        let balance = accountInfo.balances.find(coin => coin.asset === symbol).free;
        if (balance > 0) {
            // get the last purchase price of a symbol
            const trades = await client.myTrades({ symbol: symbol, limit: 1 });
            let purchasePrice = 0;
            if (trades.length > 0) {
                if (trades[0].isBuyer) {
                    purchasePrice = trades[0].price;
                }
            }
            portfolio[symbol] = { balance, purchasePrice };
            lastPrice = purchasePrice;
        }
        else {
            lastPrice = 0;
            portfolio[symbol] = { balance: 0, purchasePrice: 0 };
        }

        // Get the current USDT balance
        let usdtBalance = accountInfo.balances.find(coin => coin.asset === 'USDT').free;
        portfolio.USDT.balance = usdtBalance;
    } else {
        // check portfolio if it contains the symbol
        if (portfolio[symbol]) {
            lastPrice = portfolio[symbol].purchasePrice;
        } else {
            lastPrice = 0;
            portfolio[symbol] = { balance: 0, purchasePrice: 0 };
        }
        let usdtBalance = portfolio.USDT.balance;
    }
    let stopLoss = lastPrice * (1 - config.stopLoss);
    // Check if the price is below the stopLoss
    if (config.stopLoss && price < stopLoss) {
        // Place a sell order
        let sellQuantity = portfolio[symbol].balance;
        if (!config.paperTrading) {
            const order = await client.order({
                symbol: symbol,
                side: 'SELL',
                type: 'MARKET',
                quantity: sellQuantity,
            });
            console.log(`Sell order placed for ${sellQuantity} ${symbol} at market price`);

            // Log the trade to metrics table
            pm2.emit('trade', {
                tradeType: 'SELL',
                symbol: symbol,
                quantity: sellQuantity,
                price: price,
                timestamp: Date.now()
            });
        } else {
            console.log(`Sell order placed for ${sellQuantity} ${symbol} at market price`);
        }
        // Update the portfolio
        portfolio[symbol].balance = 0;
        portfolio[symbol].purchasePrice = 0;
        portfolio.USDT.balance += sellQuantity * price;
    }
    // Check if the price is above the purchasePrice
    else if (lastPrice && price > lastPrice * (1 + config.profitMargin)) {
        // Place a buy order
        let buyQuantity = (portfolio.USDT.balance * config.leverage) / price;
        if (!config.paperTrading) {
            const order = await client.order({
                symbol: symbol,
                side: 'BUY',
                type: 'MARKET',
                quantity: buyQuantity,
            });
            console.log(`Buy order placed for ${buyQuantity} ${symbol} at market price`);

            // Log the trade to metrics table
            pm2.emit('trade', {
                tradeType: 'BUY',
                symbol: symbol,
                quantity: buyQuantity,
                price: price,
                timestamp: Date.now()
            });
        } else {
            console.log(`Buy order placed for ${buyQuantity} ${symbol} at market price`);
        }
        // Update the portfolio
        portfolio[symbol].balance = buyQuantity;
        portfolio[symbol].purchasePrice = price;
        portfolio.USDT.balance -= buyQuantity * price;
    }
    // Save the portfolio to file system
    fs.writeFileSync("portfolio.json", JSON.stringify(portfolio));
};

// Start the strategy
pm2.connect(() => {
    pm2.start({
        script: 'app.js',
        exec_mode: 'fork',
        instances: 1,
        name: 'crypto-bot',
        max_memory_restart: '100M'
    }, (err, apps) => {
        setInterval(scalpingStrategy, config.interval);
    });
});

