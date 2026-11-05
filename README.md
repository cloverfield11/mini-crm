# Mini-CRM «Объекты и задачи»

Небольшая CRM-система для строительной компании на стеке **React + TypeScript + Supabase + Tailwind CSS**.

## Запуск проекта локально

1. Установите зависимости:
```bash
npm install
```

2. Запустите dev-сервер:
```bash
npm run dev
```

Приложение откроется по адресу `http://localhost:5173`.

## Переменные окружения (.env)
Скопируйте `.env.example` в `.env` и укажите данные вашего проекта Supabase:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
```

## Тестовые пользователи (пароль у всех: `123456`)
* **Постановщик:** `boss@test.com`
* **Исполнитель 1:** `worker1@test.com`
* **Исполнитель 2:** `worker2@test.com`

---

## Архитектура безопасности (Supabase & PostgreSQL)

1. **Row Level Security (RLS)**:
   * Исполнитель видит только свои задачи (`executor_id = auth.uid()`).
   * Исполнитель видит только те объекты, к которым привязаны его задачи (проверка через `EXISTS (SELECT 1 FROM tasks WHERE tasks.object_id = objects.id AND tasks.executor_id = auth.uid())`).
   * Постановщик видит все объекты и задачи.

2. **Защита переходов статусов (State Machine в БД)**:
   * Переходы статусов выполняются через хранимую процедуру PostgreSQL `change_task_status(...)`.
   * Прямой `UPDATE` статуса через клиентский API запрещён (`REVOKE UPDATE (status) ON tasks`).
   * Недопустимый переход вызывает `RAISE EXCEPTION`.
   * При возврате задачи «На доработку» база требует обязательный непустой комментарий.

3. **Защита истории**:
   * Прямой `INSERT`/`UPDATE`/`DELETE` в таблицу `task_history` закрыт для пользователей через RLS.
   * История пополняется исключительно на стороне базы внутри функции `change_task_status` с правами `SECURITY DEFINER`. Подделать историю через DevTools или Postman невозможно.
