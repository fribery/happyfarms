// Файл: setWebhook.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

// 1. Замените YOUR_RAILWAY_URL на реальный URL вашего проекта на Railway
const webhookUrl = 'https://happyfarms-production.up.railway.app/bot-webhook'; // Важно: добавить путь

async function setWebhook() {
  try {
    // 2. Устанавливаем вебхук. Указываем публичный URL и опцию для self-signed сертификата
    const isSet = await bot.setWebHook(webhookUrl, {
      // Для Railway это часто необходимо
      certificate: { source: 'inline', url: webhookUrl }
    });
    console.log('Вебхук установлен успешно?', isSet);

    // 3. Проверяем информацию о текущем вебхуке
    const webhookInfo = await bot.getWebHookInfo();
    console.log('Информация о вебхуке:', JSON.stringify(webhookInfo, null, 2));
  } catch (error) {
    console.error('Ошибка при установке вебхука:', error.message);
  }
}

setWebhook();