// ==================== 1. ИМПОРТЫ И НАСТРОЙКА ====================
require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(require('cors')());

// ==================== 2. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ====================
const PORT = process.env.PORT || 8080;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URL = process.env.MONGO_URL;

// Проверка обязательных переменных
if (!BOT_TOKEN) {
    console.error('❌ ОШИБКА: TELEGRAM_BOT_TOKEN не найден!');
    process.exit(1);
}
if (!MONGO_URL) {
    console.error('❌ ОШИБКА: MONGO_URL или DATABASE_URL не найдены!');
    process.exit(1);
}

// ==================== 3. ПОДКЛЮЧЕНИЕ К TELEGRAM ====================
const bot = new TelegramBot(BOT_TOKEN);
console.log('🤖 Бот инициализирован');

        // ============ 3. МОДЕЛЬ ПОЛЬЗОВАТЕЛЯ ============
        const userSchema = new mongoose.Schema({
            telegramId: { type: Number, required: true, unique: true },
            username: String,
            coins: { type: Number, default: 100 },
            farm: {
                vegetables: { type: Map, of: Number, default: {} },
                animals: { type: Map, of: Number, default: {} }
            },
            lastHarvest: Date
        });
        const User = mongoose.model('User', userSchema);
        console.log('📝 Модель User загружена');

        // ============ 4. ОБРАБОТЧИК КОМАНДЫ /START ============
        bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const username = msg.from.username || 'фермер';
            
            try {
              console.log('🟢 /start от:', userId);
              
              // ВРЕМЕННО: Не обращаемся к базе, используем заглушку
              // let user = await User.findOne({ telegramId: userId });
              // if (!user) { ... }
              
              // Отправляем сообщение без данных из БД
              await bot.sendMessage(chatId, `Привет, ${username}! Добро пожаловать. База данных временно недоступна.`);
              
              // Кнопка с Mini App
              const miniAppUrl = process.env.MINI_APP_URL;
              if (miniAppUrl) {
                await bot.sendMessage(chatId, 'Открыть ферму:', {
                  reply_markup: {
                    inline_keyboard: [[
                      { text: '🌾 Открыть ферму', web_app: { url: miniAppUrl } }
                    ]]
                  }
                });
              }
              
            } catch (error) {
              console.error('Ошибка в /start:', error.message);
              await bot.sendMessage(chatId, 'Ошибка: ' + error.message);
            }
          });

        // ============ 5. API ДЛЯ FRONTEND (MINI APP) ============
        // Важно: В реальном приложении здесь должна быть проверка подписи initData от Telegram!

        app.post('/api/user-data', async (req, res) => {
            try {
                const userId = req.body.userId;
                const user = await User.findOne({ telegramId: userId });
                if (user) {
                    res.json({ success: true, user: user });
                } else {
                    res.status(404).json({ success: false, error: 'User not found' });
                }
            } catch (error) {
                console.error('Ошибка в /api/user-data:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Эндпоинт для создания платежного счета (заглушка)

        app.post('/api/create-invoice', (req, res) => {
            console.log('Запрос на создание инвойса:', req.body);
            // Реализуйте логику создания инвойса через bot.sendInvoice(...)
            res.json({ success: true, message: 'Invoice endpoint (stub)' });
        });

        // Обработчик успешных платежей (заглушка)
        bot.on('successful_payment', async (msg) => {
            console.log('Успешный платеж:', msg.successful_payment);
            // Реализуйте зачисление монет/предметов пользователю
        });

        // ============ 6. HEALTH CHECK (КРИТИЧЕСКИ ВАЖНО ДЛЯ RAILWAY) ============
        app.get('/', (req, res) => {
            console.log('✅ GET / — Health Check passed!');
            res.json({
                status: 'ok',
                message: 'Farm Bot API is running',
                timestamp: new Date().toISOString()
            });
        });

        // ============ 7. ОБРАБОТЧИК ВЕБХУКА ОТ TELEGRAM ============
        // Убедитесь, что в настройках вебхука в setWebhook.js указан этот путь
        app.post('/bot-webhook', (req, res) => {
            try {
                console.log('📨 Получен вебхук от Telegram');
                bot.processUpdate(req.body);
                res.sendStatus(200);
            } catch (error) {
                console.error('Ошибка в обработчике вебхука:', error);
                res.sendStatus(500);
            }
        });

        // Простой "якорь" для процесса (опционально)
        const keepAliveInterval = setInterval(() => {
            // Тихий интервал, чтобы процесс не завершился случайно
        }, 60000);
        // Очистка интервала при завершении
        process.on('SIGTERM', () => clearInterval(keepAliveInterval));
        process.on('SIGINT', () => clearInterval(keepAliveInterval));

// ==================== 6. КОМАНДА /START ДЛЯ БОТА ====================
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username;

    try {
        // Ищем или создаём пользователя
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            user = new User({
                telegramId: userId,
                username: username,
                coins: 100,
                farm: { vegetables: {}, animals: {} }
            });
            await user.save();
            console.log('🆕 Создан новый пользователь: ${userId}');
            await bot.sendMessage(chatId, `Добро пожаловать на ферму! У вас ${user.coins} монет.`);
        } else {
            console.log('👋 Возвращение пользователя: ${userId}');
            await bot.sendMessage(chatId, `С возвращением, ${username || 'Фермер'}! На счету: ${user.coins} монет.`);
        }

        // Отправляем кнопку для открытия Mini App
        const miniAppUrl = process.env.MINI_APP_URL || 'https://ваш-фронтенд.vercel.app';
        await bot.sendMessage(chatId, 'Открыть ферму:', {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '🌾 Открыть ферму',
                        web_app: { url: miniAppUrl }
                    }
                ]]
            }
        });

    } catch (error) {
        console.error('Ошибка в /start:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
    }
});

// ==================== 7. API ДЛЯ ФРОНТЕНДА ====================
// Эндпоинт для получения данных пользователя
app.post('/api/user-data', async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('🔍 [API] Поиск пользователя для userId:', userId);

    // Пытаемся найти пользователя по telegramId (основной способ)
    let user = await User.findOne({ telegramId: userId });

    // Если не нашли, можно попробовать найти по другому полю,
    // например, по username, если он передаётся вместе с userId
    // if (!user) {
    //   user = await User.findOne({ username: someUsername });
    // }

    if (!user) {
      console.log('⚠️ [API] Пользователь не найден в БД по telegramId:', userId);
      // Можно создать нового пользователя "на лету", если нужно
      // user = new User({ telegramId: userId, coins: 100 });
      // await user.save();
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    console.log('✅ [API] Пользователь найден:', user.telegramId);
    res.json({ success: true, user: user });
  } catch (error) {
    console.error('❌ [API] Ошибка:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// ==================== 9. ВЕБХУК ДЛЯ TELEGRAM ====================
// Telegram будет отправлять сюда все обновления
app.post('/bot-webhook', (req, res) => {
    try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Ошибка в вебхуке:', error);
        res.sendStatus(500);
    }
});

// Добавьте этот маршрут:
app.get('/api/user-data', (req, res) => {
    try {
      // Здесь вы можете получить данные из базы данных или другого источника
      const userData = {
        id: 1,
        name: "Иван Иванов",
        email: "ivan@example.com",
        status: "active",
        createdAt: new Date().toISOString()
      };
      
      // Отправляем данные клиенту
      res.status(200).json({
        success: true,
        data: userData,
        message: "Данные пользователя получены успешно"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Ошибка при получении данных пользователя",
        error: error.message
      });
    }
  });
  
// ==== ДОБАВЬТЕ ЭТОТ КОД ПОСЛЕ ВЕБХУКА ====
app.post('/api/user-data', async (req, res) => {
    try {
      const { userId } = req.body;
      console.log('🔍 [API] Запрос данных для userId:', userId);
      
      if (!userId) {
        return res.status(400).json({ success: false, error: 'Требуется userId' });
      }
      
      const user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        console.log('⚠️ [API] Пользователь не найден');
        return res.status(404).json({ 
          success: false, 
          error: 'Пользователь не найден. Напишите боту /start' 
        });
      }
      
      console.log('✅ [API] Возвращаю данные для:', user.username);
      res.json({
        success: true,
        user: {
          telegramId: user.telegramId,
          username: user.username,
          coins: user.coins,
          farm: user.farm
        }
      });
      
    } catch (error) {
      console.error('❌ [API] Ошибка:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
  });

  // API для фронтенда
app.post('/api/user-data', async (req, res) => {
    try {
      console.log('🔍 [API] Запрос /api/user-data. Тело:', req.body);
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId обязателен' });
      }
      
      // Ищем пользователя
      const user = await User.findOne({ telegramId: Number(userId) });
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Пользователь не найден. Напишите /start боту' 
        });
      }
      
      // Отправляем данные
      res.json({
        success: true,
        user: {
          telegramId: user.telegramId,
          username: user.username,
          coins: user.coins,
          farm: user.farm
        }
      });
      
    } catch (error) {
      console.error('❌ Ошибка в /api/user-data:', error);
      res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
  });


// ==================== 10. ЗАПУСК СЕРВЕРА ====================

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/`);
    console.log(`📨 Вебхук: /bot-webhook`);
    console.log(`🎮 API для фронтенда: /api/user-data`);
});

// ============ 9. ГРАЦИОЗНОЕ ЗАВЕРШЕНИЕ ============
const gracefulShutdown = async () => { // ← Добавлено async
    console.log('🛑 Получен сигнал завершения, останавливаю сервер...');
    server.close(async () => { // ← Добавлено async
      console.log('Сервер остановлен.');
      try {
        await mongoose.connection.close(); // ← Исправленная строка
        console.log('✅ Соединение с MongoDB закрыто.');
      } catch (err) {
        console.error('⚠️ Ошибка при закрытии соединения с MongoDB:', err.message);
      }
      process.exit(0);
    });
  };
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ==================== 11. ОБРАБОТКА ОШИБОК ====================
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Необработанный rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Непойманное исключение:', error);
});