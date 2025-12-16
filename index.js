// ==================== 1. ИМПОРТЫ И НАСТРОЙКА ====================
require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== 2. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ====================
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URL || process.env.DATABASE_URL;

// Проверка обязательных переменных
if (!BOT_TOKEN) {
    console.error('❌ ОШИБКА: TELEGRAM_BOT_TOKEN не найден!');
    process.exit(1);
}
if (!MONGO_URI) {
    console.error('❌ ОШИБКА: MONGO_URL или DATABASE_URL не найдены!');
    process.exit(1);
}

// ==================== 3. ПОДКЛЮЧЕНИЕ К TELEGRAM ====================
const bot = new TelegramBot(BOT_TOKEN);
console.log('🤖 Бот инициализирован');

// ==================== 4. ПОДКЛЮЧЕНИЕ К MONGODB ====================
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB подключена'))
    .catch(err => {
        console.error('❌ Ошибка подключения к MongoDB:', err.message);
        process.exit(1);
    });

// ==================== 5. СХЕМА И МОДЕЛЬ ПОЛЬЗОВАТЕЛЯ ====================
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
console.log('📝 Модель User создана');

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
            await bot.sendMessage(chatId, 'Добро пожаловать на ферму! У вас ${user.coins} монет.');
        } else {
            console.log('👋 Возвращение пользователя: ${userId}');
            await bot.sendMessage(chatId, 'С возвращением, ${username} || фермер! На счету: ${user.coins} монет.');
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

        if (!userId) {
            return res.status(400).json({ success: false, error: 'Требуется userId' });
        }

        const user = await User.findOne({ telegramId: userId });

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Пользователь не найден. Напишите боту /start' 
            });
        }

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
        console.error('Ошибка в /api/user-data:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// ==================== 8. HEALTH CHECK (ОБЯЗАТЕЛЬНО!) ====================
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Farm Bot API работает',
        timestamp: new Date().toISOString()
    });
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

// ==================== 10. ЗАПУСК СЕРВЕРА ====================
app.listen(PORT, () => {
    console.log('🚀 Сервер запущен на порту ${PORT}');
    console.log('🔗 Health Check: http://localhost:${PORT}/');
    console.log('📨 Вебхук: /bot-webhook');
    console.log('🎮 API для фронтенда: /api/user-data');
});

// ==================== 11. ОБРАБОТКА ОШИБОК ====================
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Необработанный rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Непойманное исключение:', error);
});