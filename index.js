const Binance = require('binance-api-node').default;
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
let config = require('./config.json');

const client = Binance({
  apiKey: config.binance.apiKey,
  apiSecret: config.binance.apiSecret,
});
const bot = new TelegramBot(config.telegram.token, {polling: true});

let paperTrading = config.paperTrading;
let buyTriggerPercentage = config.buyTriggerPercentage;
let sellTriggerPercentage = config.sellTriggerPercentage;
let useStopLoss = config.useStopLoss;
let stopLossPercentage = config.stopLossPercentage;

bot.onText(/\/buy/, async (msg) => {
  const chatId = msg.chat.id;
  let available = await client.accountInfo();
  let quantity = (available.balances.find(x => x.asset === 'USDT')).free / currentPrice;
  let finalQuantity = quantity - (quantity* feePercentage);
  if(!paperTrading) {
    const response = await client.buy({
      symbol: 'BTCUSDT',
      quantity: finalQuantity,
      price: currentPrice,
    });
  }
  bot.sendMessage(chatId, `Bought ${finalQuantity} BTC at ${currentPrice}`);
});

bot.onText(/\/sell/, async (msg) => {
  const chatId = msg.chat.id;
  let available = await client.accountInfo();
  let quantity = (available.balances.find(x => x.asset === 'BTC')).free;
  let finalQuantity = quantity - (quantity* feePercentage);
  if(!paperTrading) {
    const response = await client.sell({
      symbol: 'BTCUSDT',
      quantity: finalQuantity,
      price: currentPrice,
    });
  }
  bot.sendMessage(chatId, `Sold ${finalQuantity} BTC at ${currentPrice}`);
});

bot.onText(/\/setconfig (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  let key = match[1];
  let value = match[2];
  config[key] = value;
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
  bot.sendMessage(chatId, `Config ${key} set to ${value}`);
  
  // re-read the config file
  config = require('./config.json');
  paperTrading = config.paperTrading;
  buyTriggerPercentage = config.buyTriggerPercentage;
  sellTriggerPercentage = config.sellTriggerPercentage;
  useStopLoss = config.useStopLoss;
  stopLossPercentage = config.stopLossPercentage;
});

// Scalping strategy with percentage increase/decrease and optional stop loss
let lastPrice;
async function scalping() {
  // Use the Binance API to get the current price of a coin
  const ticker = await client.prices();
  const currentPrice = ticker.BTCUSDT;

  // Get the current fee percentage
  const exchangeInfo = await client.exchangeInfo();
  const symbol = exchangeInfo.symbols.find(s => s.symbol === 'BTCUSDT');
  const fee = symbol.filters.find(f => f.filterType === 'FEE_FILTER');
  const feePercentage = fee.value / 100;

  // Check if the current price is below the buy trigger percentage
  if (currentPrice < lastPrice * (1 + (buyTriggerPercentage/100))) {
    // If the price is below the buy trigger, buy
    let available = await client.accountInfo();
    let quantity = (available.balances.find(x => x.asset === 'USDT')).free / currentPrice;
    let finalQuantity = quantity - (quantity* feePercentage);
    if(!paperTrading) {
      const response = await client.buy({
        symbol: 'BTCUSDT',
        quantity: finalQuantity,
        price: currentPrice,
      });
    }
    console.log(`Bought ${finalQuantity} BTC at ${currentPrice}`);
    bot.sendMessage(config.telegram.chatId, `Bought ${finalQuantity} BTC at ${currentPrice}`);
  }

  // Check if the current price is above the sell trigger percentage
  if (currentPrice > lastPrice * (1 + (sellTriggerPercentage/100))) {
    // If the price is above the sell trigger, sell
    let available = await client.accountInfo();
    let quantity = (available.balances.find(x => x.asset === 'BTC')).free;
    let finalQuantity = quantity - (quantity* feePercentage);
    if(!paperTrading) {
      const response = await client.sell({
        symbol: 'BTCUSDT',
        quantity: finalQuantity,
        price: currentPrice,
      });
    }
    console.log(`Sold ${finalQuantity} BTC at ${currentPrice}`);
    bot.sendMessage(config.telegram.chatId, `Sold ${finalQuantity} BTC at ${currentPrice}`);
  }

  // check if the current price is below the stop loss percentage
  if (useStopLoss && currentPrice < lastPrice * (1 + (stopLossPercentage/100))) {
    // If the price is below the stop loss, sell
    let available = await client.accountInfo();
    let quantity = (available.balances.find(x => x.asset === 'BTC')).free;
    let finalQuantity = quantity - (quantity* feePercentage);
    if(!paperTrading) {
      const response = await client.sell({
        symbol: 'BTCUSDT',
        quantity: finalQuantity,
        price: currentPrice,
      });
    }
    console.log(`Stop loss triggered. Sold ${finalQuantity} BTC at ${currentPrice}`);
    bot.sendMessage(config.telegram.chatId, `Stop loss triggered. Sold ${finalQuantity} BTC at ${currentPrice}`);
  }
  lastPrice = currentPrice;
}

setInterval(() => scalping(), 10000);
