const Binance = require('binance-api-node').default;
const TelegramBot = require('node-telegram-bot-api');
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

bot.onText(/\/updateconfig/, async (msg) => {
  const chatId = msg.chat.id;
  config = require('./config.json');
  paperTrading = config.paperTrading;
  buyTriggerPercentage = config.buyTriggerPercentage;
  sellTriggerPercentage = config.sellTriggerPercentage;
  useStopLoss = config.useStopLoss;
  stopLossPercentage = config.stopLossPercentage;
  bot.sendMessage(chatId, 'config updated');
});

let lastPrice;

async function scalping() {
  let currentPrice = await client.prices({symbol: 'BTCUSDT'});
  currentPrice = parseFloat(currentPrice.BTCUSDT);
  if(!lastPrice) {
    lastPrice = currentPrice;
  }
  let feePercentage = config.defaultFeePercentage;

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

  // Check if useStopLoss is true and the current price is below the stop loss percentage
  if (useStopLoss && currentPrice < lastPrice * (1 - (stopLossPercentage/100))) {
    // If the price is below the stop loss percentage, sell
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

// setInterval(() => scalping(), 10000);


