const Binance = require('binance-api-node').default;
const CandleChartInterval  = require('binance-api-node').CandleChartInterval;

const technicalindicators = require('technicalindicators');
const heikinashi = require('heikinashi');
const fs = require('fs');
const pm2 = require('pm2');

// Load config
const config = require('./configBotOne.json');

// Initialize Binance client
const client = Binance({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret
});

// Initialize portfolio
let portfolio = {};

// Get trading data
let tradeData = [];

// Function to get trading data from Binance API
function getTradingData() {
    
    client.candles({
        symbol: config.symbol,
        interval: CandleChartInterval.FIVE_MINUTES,
        limit: 20
    }).then(candles => {
        
        let data = candles.map(candle => {
            return {
                time: candle.openTime,
                open: parseFloat(candle.open),
                high: parseFloat(candle.high),
                low: parseFloat(candle.low),
                close: parseFloat(candle.close),
                volume: candle.volume,
            }
        });

        
        tradeData = data;
        // calculate Heikin-Ashi data
        let heikinAshiData = heikinashi(tradeData);
        //console.log(heikinAshiData);
        // console.log(heikinAshiData);
        // calculate short-term SMA
        const closePrices = heikinAshiData.map(candle => candle.close);

        let shortSMA = technicalindicators.SMA.calculate({
            period: config.shortSMA,
            values: closePrices
        });
        
        // calculate long-term SMA
        let longSMA = technicalindicators.SMA.calculate({
            period: config.longSMA,
            values: closePrices
        });

        

        // Check if short SMA is greater than long SMA
        if (shortSMA[shortSMA.length - 1] > longSMA[longSMA.length - 1]) {
            console.log("short SMA is greater than long SMA");
            //console.log(heikinAshiData[heikinAshiData.length - 1].close, heikinAshiData[heikinAshiData.length - 1].open);
            if (heikinAshiData[heikinAshiData.length - 1].close > heikinAshiData[heikinAshiData.length - 1].open) {
                if (portfolio[config.symbol] && portfolio[config.symbol].balance) {
                    sell(config.symbol, portfolio, tradeData[tradeData.length - 1].close);
                } else {
                    buy(config.symbol, portfolio, tradeData[tradeData.length - 1].close);
                }
            }
        } else if (shortSMA[shortSMA.length - 1] < longSMA[longSMA.length - 1]) {
            console.log("short SMA is less than long SMA");
            if (heikinAshiData[heikinAshiData.length - 1].close < heikinAshiData[heikinAshiData.length - 1].open) {
                if (portfolio[config.symbol] && portfolio[config.symbol].balance) {
                    sell(config.symbol, portfolio, tradeData[tradeData.length - 1].close);
                }
            }
        } else {
            console.log(`No Signal at price: ${tradeData[tradeData.length - 1].close}`);
        }


        // Save portfolio to file system
        fs.writeFileSync('./portfolio.json', JSON.stringify(portfolio));
        setTimeout(getTradingData, config.intervalTime);
    });
}

// Function to buy a symbol
function buy(symbol, portfolio, price) {
    console.log(`Buying ${symbol} at ${price}`);
    if (config.paperTrading) {
        if (!portfolio[symbol]) {
            portfolio[symbol] = {
                balance: 0,
                purchasePrice: 0
            };
        }
        portfolio[symbol].balance += config.leverage * portfolio.USDT.balance / price;
        portfolio[symbol].purchasePrice = (portfolio[symbol].purchasePrice * (portfolio[symbol].balance - config.leverage * portfolio.USDT.balance / price) + price * config.leverage * portfolio.USDT.balance / price) / portfolio[symbol].balance;
        portfolio.USDT.balance -= config.leverage * portfolio.USDT.balance;
    } else {
        client.testOrder({
            symbol: symbol,
            side: 'BUY',
            type: 'MARKET',
            quantity: config.leverage * portfolio.USDT.balance / price
        }).then(data => {
            if (!portfolio[symbol]) {
                portfolio[symbol] = {
                    balance: 0,
                    purchasePrice: 0
                };
            }
            portfolio[symbol].balance += data.executedQty;
            portfolio[symbol].purchasePrice = (portfolio[symbol].purchasePrice * (portfolio[symbol].balance - data.executedQty) + data.price * data.executedQty) / portfolio[symbol].balance;
            portfolio.USDT.balance -= data.executedQty * data.price;
            pm2.emit('trade_log', {
                name: 'trade_log',
                tradeType: 'buy',
                symbol: symbol,
                price: data.price,
                quantity: data.executedQty,
                time: new Date()
            });
        });
    }
}



// Function to sell a symbol
function sell(symbol, portfolio, price, tradeType = 'sell') {
    console.log(`Selling ${symbol} at ${price}`);
    if (config.paperTrading) {
        portfolio[symbol].balance = 0;
        portfolio[symbol].purchasePrice = 0;
    } else {
        client.testOrder({
            symbol: symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: portfolio[symbol].balance
        }).then(data => {
            portfolio[symbol].balance = 0;
            portfolio[symbol].purchasePrice = 0;
            pm2.emit('trade_log', {
                name: 'trade_log',
                tradeType: tradeType,
                symbol: symbol,
                price: price,
                quantity: data.executedQty,
                time: new Date()
            });
        });
    }
}

// // Check if the stopLoss is defined
// if (config.stopLoss && lastPrice && price < lastPrice * (1 - config.stopLoss)) {
//     sell(config.symbol, portfolio, price, 'stoploss');
// }
// // Check if the price is above the purchasePrice
// else if (lastPrice && price > lastPrice * (1 + config.profitMargin)) {
//     sell(config.symbol, portfolio, price);
// }

// // Check if the price is below the purchasePrice
// else if (lastPrice && price < lastPrice * (1 - config.profitMargin)) {
//     buy(config.symbol, portfolio, price);
// }
// // Save portfolio to file system
// fs.writeFileSync('./portfolio.json', JSON.stringify(portfolio));
// setTimeout(getTradingData, config.intervalTime);
//   }

// Connect to PM2
pm2.connect(async () => {
    // Start trading
    if (config.paperTrading) {
        // Load portfolio from file system
        //portfolio = JSON.parse(fs.readFileSync('./portfolio.json'));
        
        console.log("PaperTrading Mode Enabled!")
        if(fs.existsSync("portfolio.json")) {
            portfolio = JSON.parse(fs.readFileSync("./portfolio.json"));
        } else {
            console.log("No Portfolio found in file system, initialing the USDT balance to 100");
            portfolio = { USDT: { balance: 100 } };  
        }   
        getTradingData();
    } else {
        // Get account balance
        // client.accountInfo().then(data => {
        //     data.balances.forEach(balance => {
        //         if (balance.asset === 'USDT') {
        //             portfolio.USDT = {
        //                 balance: parseFloat(balance.free)
        //             };
        //         }
        //     });
        //     // Load portfolio from file system
        //     // portfolio = Object.assign(portfolio, JSON.parse(fs.readFileSync('./portfolio.json')));
        //     getTradingData();
        // });

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

        getTradingData();
        }
});
