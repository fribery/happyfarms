import { useEffect, useState } from 'react';
import { useTelegram } from './hooks/useTelegram'; // Хук из [citation:6]
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL; // Адрес вашего бэкенда

function App() {
  const { tg, user } = useTelegram();
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Инициализация Mini App
  useEffect(() => {
    tg.ready(); // Сообщаем Telegram, что приложение готово[citation:6]
    tg.expand(); // Разворачиваем на весь экран
    fetchUserData();
  }, []);

  // Запрос данных пользователя у бэкенда
  const fetchUserData = async () => {
    try {
      // Отправляем на бэкенд initData для проверки подлинности
      const response = await axios.post(`${API_URL}/api/user-data`, {
        initData: tg.initData, // Безопасные данные для проверки[citation:6]
        userId: user?.id
      });
      setGameData(response.data.user);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Функция "собрать урожай"
  const handleHarvest = async (vegetableType) => {
    // Отправляем запрос на бэкенд, чтобы обновить состояние и добавить монеты
    // После успешного ответа обновляем gameData
    alert(`Вы собрали урожай! +10 монет`);
  };

  // Функция открытия магазина (для покупки животных за монеты или за Stars)
  const openShop = () => {
    // Здесь может быть модальное окно с товарами.
    // При покупке за Stars нужно вызвать бэкенд-роут /api/create-invoice
    // и затем tg.openInvoice(...) для открытия платежной формы Telegram[citation:4].
  };

  if (loading) return <div className="app-container">Загрузка фермы...</div>;

  return (
    <div className="app-container" style={{ backgroundColor: tg.themeParams.bg_color }}>
      <h1>🌿 Моя Ферма</h1>
      <p>Привет, {user?.first_name}! У тебя {gameData?.coins} 🪙</p>

      <div className="farm-section">
        <h2>Грядки</h2>
        <button onClick={() => handleHarvest('carrot')}>🥕 Собрать морковь</button>
        {/* Здесь будет отображение текущих овощей из gameData.farm */}
      </div>

      <div className="animals-section">
        <h2>Животные</h2>
        <p>Коров: {gameData?.farm?.animals.get('cow') || 0}</p>
        <button onClick={openShop}>🛒 Купить животное</button>
      </div>

      <button
        className="tg-button"
        onClick={() => tg.openTelegramLink('https://t.me/gift/...')}
      >
        🎁 Обменять монеты на подарок
      </button>
    </div>
  );
}

export default App;