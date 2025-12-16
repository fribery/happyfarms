require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// ============ 1. КОНФИГУРАЦИЯ БОТА (РЕЖИМ WEBHOOK) ============
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('❌ FATAL: TELEGRAM_BOT_TOKEN не найден в переменных окружения.');
    process.exit(1);
}
const bot = new TelegramBot(token);
console.log('🤖 Бот инициализирован (режим вебхука)');

// ============ 2. ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ ============
// Важно: используйте ту переменную, которую вы добавили в Railway (например, DATABASE_URL или MONGO_URL)
const mongoUri = process.env.MONGO_URL_URL || process.env.MONGO_URL;
if (!mongoUri) {
    console.error('❌ FATAL: Переменная для подключения к MongoDB (DATABASE_URL/MONGO_URL) не найдена.');
    process.exit(1);
}

// Подключаемся к БД. Сервер запустим ПОСЛЕ успешного подключения.
console.log('🔗 Устанавливаю соединение с MongoDB...');
mongoose.connect(mongoUri)
    .then(() => {
        console.log('✅ MongoDB connected');

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
            try {
                let user = await User.findOne({ telegramId: userId });
                if (!user) {
                    user = new User({
                        telegramId: userId,
                        username: msg.from.username
                    });
                    await user.save();
                    await bot.sendMessage(chatId, 'Добро пожаловать на ферму! У вас ' + user.coins + ' монет.');
                } else {
                    await bot.sendMessage(chatId, 'С возвращением! На вашем счету ' + user.coins + ' монет.');
                }
                // Кнопка для открытия Mini App
                await bot.sendMessage(chatId, 'Открыть ферму', {
                    reply_markup: {
                        inline_keyboard: [[
                            {
                                text: '🌾 Открыть ферму',
                                web_app: { url: process.env.MINI_APP_URL }
                            }
                        ]]
                    }
                });
            } catch (error) {
                console.error('Ошибка в обработчике /start:', error);
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

        // ============ 8. ЗАПУСК СЕРВЕРА ============
        const PORT = process.env.PORT || 8080;
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('📡 Backend server is running on port ' + PORT);
            console.log('🌐 Локальный Health Check: http://localhost:' + PORT + '/');
            console.log('✅ Server initialization complete.');
        });

        // ============ 9. ГРАЦИОЗНОЕ ЗАВЕРШЕНИЕ ============
        const gracefulShutdown = () => {
            console.log('🛑 Получен сигнал завершения, останавливаю сервер...');
            server.close(() => {
                console.log('Сервер остановлен.');
                mongoose.connection.close(false, () => {
                    console.log('Соединение с MongoDB закрыто.');
                    process.exit(0);
                });
            });
        };
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

        // Простой "якорь" для процесса (опционально)
        const keepAliveInterval = setInterval(() => {
            // Тихий интервал, чтобы процесс не завершился случайно
        }, 60000);
        // Очистка интервала при завершении
        process.on('SIGTERM', () => clearInterval(keepAliveInterval));
        process.on('SIGINT', () => clearInterval(keepAliveInterval));

    })
    .catch((err) => {
        // Если подключение к БД не удалось, сервер НЕ запускаем
        console.error('❌ FATAL: Ошибка подключения к MongoDB:', err.message);
        process.exit(1);
    });

// ============ 10. ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК ============
process.on('uncaughtException', (error) => {
    console.error('⚠️ CRITICAL: Непойманное исключение!', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ CRITICAL: Необработанный rejection промиса:', reason);
});