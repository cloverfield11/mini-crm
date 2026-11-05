-- МИГРАЦИЯ БАЗЫ ДАННЫХ ДЛЯ MINI-CRM «ОБЪЕКТЫ И ЗАДАЧИ»

-- 1. ТИПЫ ДАННЫХ
CREATE TYPE user_role AS ENUM ('manager', 'executor');
CREATE TYPE task_status AS ENUM ('Новая', 'В работе', 'На проверке', 'Принята', 'На доработке');

-- 2. ТАБЛИЦА ПРОФИЛЕЙ
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'executor',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. ТАБЛИЦА ОБЪЕКТОВ
CREATE TABLE objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ТАБЛИЦА ЗАДАЧ
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  executor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status task_status NOT NULL DEFAULT 'Новая',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ТАБЛИЦА ИСТОРИИ (Требование 3.4: нельзя подделать/изменить через API)
CREATE TABLE task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  old_status task_status,
  new_status task_status NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ВКЛЮЧАЕМ RLS НА ВСЕХ ТАБЛИЦАХ
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

-- RLS: PROFILES
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT TO authenticated USING (true);

-- RLS: OBJECTS
CREATE POLICY "Objects view policy"
  ON objects FOR SELECT TO authenticated
  USING (
    current_user_role() = 'manager'
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.object_id = objects.id
        AND tasks.executor_id = auth.uid()
    )
  );

CREATE POLICY "Objects insert/update/delete by managers only"
  ON objects FOR ALL TO authenticated
  USING (current_user_role() = 'manager')
  WITH CHECK (current_user_role() = 'manager');

-- RLS: TASKS
CREATE POLICY "Tasks view policy"
  ON tasks FOR SELECT TO authenticated
  USING (
    current_user_role() = 'manager'
    OR executor_id = auth.uid()
  );

CREATE POLICY "Tasks insert by managers only"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = 'manager'
    AND author_id = auth.uid()
  );

CREATE POLICY "Tasks delete by managers only"
  ON tasks FOR DELETE TO authenticated
  USING (current_user_role() = 'manager');

CREATE POLICY "Tasks update fields by managers only"
  ON tasks FOR UPDATE TO authenticated
  USING (current_user_role() = 'manager')
  WITH CHECK (current_user_role() = 'manager');

-- RLS: TASK_HISTORY
CREATE POLICY "Task history view policy"
  ON task_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_history.task_id
        AND (current_user_role() = 'manager' OR tasks.executor_id = auth.uid())
    )
  );

-- ФУНКЦИЯ ДЛЯ СМЕНЫ СТАТУСА (Стейт-машина в БД)
CREATE OR REPLACE FUNCTION change_task_status(
  p_task_id UUID,
  p_new_status task_status,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_role user_role;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Не авторизован';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Задача не найдена';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id;

  -- Валидация стейт-машины
  IF v_task.status = 'Новая' AND p_new_status = 'В работе' THEN
    IF v_task.executor_id != v_user_id THEN
      RAISE EXCEPTION 'Только назначенный исполнитель может взять задачу в работу';
    END IF;

  ELSIF v_task.status = 'В работе' AND p_new_status = 'На проверке' THEN
    IF v_task.executor_id != v_user_id THEN
      RAISE EXCEPTION 'Только назначенный исполнитель может отправить задачу на проверку';
    END IF;

  ELSIF v_task.status = 'На проверке' AND p_new_status = 'Принята' THEN
    IF v_role != 'manager' OR v_task.author_id != v_user_id THEN
      RAISE EXCEPTION 'Только постановщик этой задачи может её принять';
    END IF;

  ELSIF v_task.status = 'На проверке' AND p_new_status = 'На доработке' THEN
    IF v_role != 'manager' OR v_task.author_id != v_user_id THEN
      RAISE EXCEPTION 'Только постановщик этой задачи может вернуть её на доработку';
    END IF;
    IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
      RAISE EXCEPTION 'Комментарий обязателен при возврате на доработку';
    END IF;

  ELSIF v_task.status = 'На доработке' AND p_new_status = 'В работе' THEN
    IF v_task.executor_id != v_user_id THEN
      RAISE EXCEPTION 'Только назначенный исполнитель может взять задачу в работу';
    END IF;

  ELSE
    RAISE EXCEPTION 'Недопустимый переход из "%" в "%"', v_task.status, p_new_status;
  END IF;

  -- Обновление статуса
  UPDATE tasks SET status = p_new_status WHERE id = p_task_id;

  -- Логирование в историю (невозможно обойти через API)
  INSERT INTO task_history (task_id, changed_by, old_status, new_status, comment)
  VALUES (p_task_id, v_user_id, v_task.status, p_new_status, trim(p_comment));

  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
