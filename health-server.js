// Файл: health-server.js - АБСОЛЮТНО МИНИМАЛЬНЫЙ СЕРВЕР ДЛЯ DEPLOY
const express = require('express');
const app = express();

// 1. Маршрут для корня (Railway проверяет его по умолчанию)
app.get('/', (req, res) => {
    console.log('✅ GET / — Health Check passed!');
    res.json({ status: 'ok', message: 'Ready' });
});

// 2. Запускаем сервер на порту от Railway
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Minimal health server listening on port ' + PORT);
});

// 3. Обработчик для graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down.');
    process.exit(0);
});