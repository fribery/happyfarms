import { useEffect, useState } from 'react';

const tg = window.Telegram.WebApp;

export function useTelegram() {
  const onClose = () => tg.close();

  return {
    tg,
    onClose,
    user: tg.initDataUnsafe?.user, // НЕПРОВЕРЕННЫЕ данные, для отображения[citation:6]
    queryId: tg.initDataUnsafe?.query_id,
  };
}