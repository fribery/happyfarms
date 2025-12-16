// Файл: setWebhook.js
// Запуск: node setWebhook.js (один раз после деплоя)
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

// ВАЖНО: замените на ваш реальный домен из Railway!
const RAILWAY_DOMAIN = 'happyfarms-production.up.railway.app';
const WEBHOOK_PATH = '/bot-webhook';
const webhookUrl = RAILWAY_DOMAIN + WEBHOOK_PATH;

async function setWebhook() {
    try {
        console.log('🔄 Устанавливаю вебхук на URL:', webhookUrl);
        // Устанавливаем вебхук
        const isSet = await bot.setWebHook(webhookUrl);
        console.log('✅ Вебхук установлен?', isSet);
        // Получаем информацию для проверки
        const info = await bot.getWebHookInfo();
        console.log('📊 Информация о вебхуке:');
        console.log('   URL:', info.url || 'не установлен');
        console.log('   Последняя ошибка:', info.last_error_message || 'нет');
        console.log('   Кол-во обновлений в очереди:', info.pending_update_count || 0);
    } catch (error) {
        console.error('❌ Ошибка при установке вебхука:', error.message);
        console.error('   Полная ошибка:', error);
    }
}

setWebhook();