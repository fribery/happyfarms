require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); // Для чтения JSON из запросов

// Подключение к Telegram Bot API
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token); // Используйте webhook для продакшена

// Подключение к MongoDB (замените ссылку)
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// --- ОПРЕДЕЛЕНИЕ МОДЕЛЕЙ БАЗЫ ДАННЫХ (пример) ---
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  coins: { type: Number, default: 100 }, // Стартовый капитал
  farm: {
    vegetables: { type: Map, of: Number, default: {} }, // Например, { "carrot": 5 }
    animals: { type: Map, of: Number, default: {} }
  },
  lastHarvest: Date
});
const User = mongoose.model('User', userSchema);
// --- КОНЕЦ МОДЕЛЕЙ ---

// Команда /start для регистрации пользователя
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    let user = await User.findOne({ telegramId: userId });
    if (!user) {
      user = new User({
        telegramId: userId,
        username: msg.from.username
      });
      await user.save();
      await bot.sendMessage(chatId, `Добро пожаловать на ферму! У вас ${user.coins} монет.`);
    } else {
      await bot.sendMessage(chatId, `С возвращением! На вашем счету ${user.coins} монет.`);
    }
    // Здесь можно отправить кнопку для открытия Mini App
    await bot.sendMessage(chatId, 'Открыть ферму', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🌾 Открыть ферму', web_app: { url: process.env.MINI_APP_URL } }
        ]]
      }
    });
  } catch (error) {
    console.error(error);
  }
});

// --- КРИТИЧЕСКИЙ МОМЕНТ: Обработка платежей Telegram Stars ---
// 1. Создание счета (инвойса) для покупки монет/животных через Mini App
app.post('/api/create-invoice', async (req, res) => {
  // Здесь ваш код для создания инвойса с помощью bot.sendInvoice(...)
  // Валюта для Stars - "XTR"[citation:8].
  // Этот метод должен вызываться с фронтенда Mini App.
});

// 2. Подтверждение успешного платежа
// Обработчик срабатывает, когда Telegram подтверждает оплату.
bot.on('successful_payment', async (msg) => {
  const userId = msg.from.id;
  const payload = msg.successful_payment.invoice_payload; // Ваши данные: что куплено

  try {
    const user = await User.findOne({ telegramId: userId });
    if (payload.startsWith('add_coins_')) {
      const coinsToAdd = parseInt(payload.split('_')[2]);
      user.coins += coinsToAdd;
      await user.save();
      bot.sendMessage(msg.chat.id, `На ваш счет зачислено ${coinsToAdd} монет!`);
    }
    // ... обработка других типов покупок (животные и т.д.)
  } catch (error) {
    console.error('Ошибка обработки платежа:', error);
  }
});
// --- КОНЕЦ ОБРАБОТКИ ПЛАТЕЖЕЙ ---

//Обработчик вебхука

app.post('/', (req, res) => {
  try {
  console.log('Received webhook update');
  bot.processUpdate(req.body); // Передаем данные обновления боту
  res.sendStatus(200); // Отвечаем Telegram, что все получили
  } catch (error) {
    console.error('Ошибка в обработчике вебхука:', error);
    res.sendStatus(500);
  }
});

// API-роут для фронтенда: получить данные пользователя
app.post('/api/user-data', async (req, res) => {
  // ВАЖНО: Здесь необходимо проверить подлинность данных из Telegram (initData),
  // используя токен бота, чтобы предотвратить подделку[citation:6].
  const initData = req.body.initData;
  // ... код проверки подписи ...

  const userId = req.body.userId; // Извлеченный из initData ID
  try {
    const user = await User.findOne({ telegramId: userId });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Добавьте этот маршрут ПЕРЕД app.listen()
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Farm bot API', 
    timestamp: new Date().toISOString() 
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
  console.log('Webhook URL: happyfarms-production.up.railway.app/bot-webhook')
});


// =================== ИСПРАВЛЕНИЕ 1: Явный "якорь" для процесса ===================
// Создаем интервал, который ничего не делает, но держит процесс активным.
// Это стандартный паттерн для серверов, у которых вся работа реактивная (через запросы).
const keepAlive = setInterval(() => {
    // Тихое проверка, что процесс еще жив. Можно логировать раз в минуту для отладки.
    // console.log('[Keep-Alive] Process is running...');
}, 60000); // Проверка раз в минуту

// Обрабатываем завершение, чтобы корректно очистить интервал
process.on('SIGTERM', () => {
    clearInterval(keepAlive);
    console.log('SIGTERM received, shutting down gracefully.');
    process.exit(0);
});
// ===============================================================================


// =================== ИСПРАВЛЕНИЕ 2: Глобальный обработчик неотловленных ошибок ===================
// Ловим любые ошибки, которые могли "проскользнуть" и завершить процесс.
process.on('uncaughtException', (error) => {
    console.error('⚠️ CRITICAL: Uncaught Exception!', error);
    // Даже после критической ошибки даем время записать лог перед выходом
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ CRITICAL: Unhandled Promise Rejection at:', promise, 'reason:', reason);
});
// ==============================================================================================

// Простое логирование успешного старта (добавьте, если у вас этого еще нет)
console.log('✅ Server initialization complete. Waiting for incoming requests...');