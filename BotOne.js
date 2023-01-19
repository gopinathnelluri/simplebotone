const Binance = require('binance-api-node').default;
const client = Binance({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
});
const fs = require('fs');
let lastPrice = 0;
let portfolio = { USDT: { balance: 0 } };
let paperTrading = true;
let fileName = 'portfolio.json';

// Check if portfolio file exists and paperTrading flag is true
if (!fs.existsSync(fileName) && paperTrading) {
    portfolio.USDT = { balance: 100 };
    fs.writeFileSync(fileName, JSON.stringify(portfolio));
} else if (paperTrading) {
    portfolio = JSON.parse(fs.readFileSync(fileName));
}

// Define your scalping strategy
const scalpingStrategy = async () => {
    let symbol = "BTCUSDT"
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
    if (portfolio.USDT) {
        usdtBalance = portfolio.USDT.balance;
    }

    // Get the current price of the asset you want to trade
    const ticker = await client.prices();
    let price = ticker[symbol];
    if (lastPrice == 0) {
        lastPrice = price;
    }
    // Get the trading fee
    const makerFee = accountInfo.makerCommission / 100;
    const takerFee = accountInfo.takerCommission / 100;

    if (price > (lastPrice * (1 + makerFee + takerFee)) * 1.002) {
        // Implement your strategy logic here
        if (!paperTrading) {
            // Place a sell order
            let sellQuantity = balance;
            const order = await client.order({
                symbol: symbol,
                side: 'SELL',
                type: 'MARKET',
                quantity: sellQuantity,
            });
            console.log(order);
        } else {
            console.log(`PAPER TRADE: Sell ${balance} ${symbol} at market price`);
        }
        lastPrice = price;
        portfolio[symbol] = { balance: 0, purchasePrice: lastPrice };
        portfolio.USDT.balance = usdtBalance + sellQuantity * price;
    } else if (price < (lastPrice * 0.998)) {
        // Implement your strategy logic here
        if (!paperTrading) {
            // Place a buy order
            let buyQuantity = usdtBalance / price;
            const order = await client.order({
                symbol: symbol,
                side: 'BUY',
                type: 'MARKET',
                quantity: buyQuantity,
            });
            console.log(order);
        } else {
            console.log(`PAPER TRADE: Buy ${buyQuantity} ${symbol} at market price`);
        }
        lastPrice = price;
        portfolio[symbol] = { balance: buyQuantity, purchasePrice: lastPrice };
        portfolio.USDT.balance = usdtBalance - buyQuantity * price;
    }
    if (paperTrading) {
        fs.writeFileSync(fileName, JSON.stringify(portfolio));
    }
};

// Run the scalping strategy
setInterval(scalpingStrategy, 5 * 60 * 1000);
