const Binance = require('binance-api-node').default;
const client = Binance();
const { SMA } = require('technicalindicators');
const heikinAshi = require('heikin-ashi-candlesticks');

let portfolio = {
    USDT: {
        balance: 10000
    }
};

let config = {
    symbol: "BTCUSDT",
    interval: "5m",
    smaPeriods: {
        short: 50,
        long: 200
    },
    profitMargin: 0.05,
    paperTrading: true
};

let tradeData;

// Function to calculate Simple Moving Average (SMA)
function calculateSMA(data, period) {
    let sma = new SMA({ period: period, values: data });
    return sma.calculate()[sma.calculate().length - 1].toFixed(8);
}

// Function to get trading data from Binance API
function getTradingData() {
    client.candles({
        symbol: config.symbol,
        interval: config.interval
    }).then(data => {
        tradeData = data;
        // calculate Heikin-Ashi data
        let heikinAshiData = heikinAshi(tradeData);

        // get last candle data
        let lastCandle = heikinAshiData[heikinAshiData.length - 1];

        // calculate short and long SMA
        let shortSMA = calculateSMA(heikinAshiData.map(trade => trade.close), config.smaPeriods.short);
        let longSMA = calculateSMA(heikinAshiData.map(trade => trade.close), config.smaPeriods.long);

        console.log(`Short SMA: ${shortSMA}, Long SMA: ${longSMA}`);

        // Check if short SMA is greater than long SMA
        if (shortSMA > longSMA) {
            // Check if last candle is bullish
            if (lastCandle.close > lastCandle.open) {
                if (portfolio[config.symbol] && portfolio[config.symbol].balance) {
                    sell(config.symbol, portfolio, tradeData[tradeData.length - 1].close);
                } else {
                    buy(config.symbol, portfolio, tradeData[tradeData.length - 1].close);
                }
            }
        } else if (shortSMA < longSMA) {
            // Check if last candle is bearish
            if (lastCandle.close < lastCandle.open) {
                if (portfolio[config.symbol] && portfolio[config.symbol].balance) {
                    sell(config.symbol, portfolio, tradeData[tradeData.length - 1].close);
                }
            }
        }
    });
}

// Function to buy a symbol
function buy(symbol, portfolio, price) {
    console.log(`Buying ${symbol} at ${price}`);
    if (config.paperTrading) {
        // update portfolio with new symbol purchase
        portfolio[symbol] = {
            balance: (portfolio.USDT.balance / price).toFixed(8),
            purchasePrice: price
        };
        // update USDT balance
        portfolio.USDT.balance = 0;
    }
}

// Function to sell a symbol
function sell(symbol, portfolio, price) {
    console.log(`Selling ${symbol} at ${price}`);
    if (config.paperTrading) {
        // update USDT balance
        portfolio.USDT.balance = (portfolio[symbol].balance * price).toFixed(8);
        // remove symbol from portfolio
        delete portfolio[symbol];
    }
}

// Run the trading bot
getTradingData();
