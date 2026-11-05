import React, { useEffect, useState } from 'react'
import { supabase, Profile, ObjectItem, TaskItem } from './supabase'
import { Login } from './Login'
import { TaskModal } from './TaskModal'
import { StatusBadge } from './StatusBadge'
import { 
  Building2, 
  CheckSquare, 
  LogOut, 
  Plus, 
  MapPin, 
  User
} from 'lucide-react'

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Навигация
  const [currentTab, setCurrentTab] = useState<'objects' | 'my_tasks'>('objects')
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Данные
  const [objects, setObjects] = useState<ObjectItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [profilesList, setProfilesList] = useState<Profile[]>([])

  // Модалки создания
  const [showCreateObject, setShowCreateObject] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [newObjName, setNewObjName] = useState('')
  const [newObjAddress, setNewObjAddress] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskExecutorId, setNewTaskExecutorId] = useState('')

  // 1. Проверка сессии
  const checkAuth = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      setProfile(null)
      setLoading(false)
      return
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileData) {
      setProfile(profileData)
      // Если исполнитель, по умолчанию можно открыть «Мои задачи»
      if (profileData.role === 'executor') {
        setCurrentTab('my_tasks')
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    checkAuth()
  }, [])

  // 2. Загрузка данных
  const loadData = async () => {
    if (!profile) return

    // Загрузка объектов (RLS в базе сам отфильтрует для исполнителя только релевантные стройки!)
    const { data: objs } = await supabase
      .from('objects')
      .select('*')
      .order('created_at', { ascending: false })
    if (objs) setObjects(objs)

    // Загрузка задач (RLS в базе сам отдаст только разрешенные задачи!)
    const { data: tsks } = await supabase
      .from('tasks')
      .select(`
        *,
        object:objects(id, name, address),
        executor:profiles!tasks_executor_id_fkey(id, email, role)
      `)
      .order('created_at', { ascending: false })
    if (tsks) setTasks(tsks as unknown as TaskItem[])

    // Список исполнителей для выпадающего списка
    if (profile.role === 'manager') {
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'executor')
      if (profs) setProfilesList(profs)
    }
  }

  useEffect(() => {
    if (profile) {
      loadData()
    }
  }, [profile])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSelectedObjectId(null)
    setSelectedTaskId(null)
  }

  // Создание объекта (только менеджер)
  const handleCreateObject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newObjName.trim() || !newObjAddress.trim()) return

    const { error } = await supabase.from('objects').insert({
      name: newObjName.trim(),
      address: newObjAddress.trim(),
    })

    if (!error) {
      setNewObjName('')
      setNewObjAddress('')
      setShowCreateObject(false)
      await loadData()
    } else {
      alert(error.message)
    }
  }

  // Создание задачи (только менеджер)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !selectedObjectId || !profile) return

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        object_id: selectedObjectId,
        executor_id: newTaskExecutorId || null,
        author_id: profile.id,
        status: 'Новая',
      })
      .select()
      .single()

    if (!error && data) {
      // Запись первого события в историю
      await supabase.from('task_history').insert({
        task_id: data.id,
        changed_by: profile.id,
        old_status: null,
        new_status: 'Новая',
        comment: 'Задача создана',
      })

      setNewTaskTitle('')
      setNewTaskDesc('')
      setNewTaskExecutorId('')
      setShowCreateTask(false)
      await loadData()
    } else {
      alert(error?.message || 'Ошибка создания')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!profile) {
    return <Login onSuccess={checkAuth} />
  }

  // Фильтрация
  const activeObject = objects.find((o) => o.id === selectedObjectId)
  const objectTasks = tasks.filter((t) => t.object_id === selectedObjectId)
  const myTasks = tasks.filter((t) => t.executor_id === profile.id)

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Верхний Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight block text-sm sm:text-base">
                СтройТрест CRM
              </span>
              <span className="text-[11px] text-slate-400 block -mt-0.5">
                Объекты и задачи
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Тег роли текущего юзера */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">{profile.email}</span>
              <span
                className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase tracking-wide ${
                  profile.role === 'manager'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {profile.role === 'manager' ? 'Постановщик' : 'Исполнитель'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Навигационные табы */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-4 border-t border-slate-100 text-xs font-medium">
          <button
            onClick={() => {
              setCurrentTab('objects')
              setSelectedObjectId(null)
            }}
            className={`py-3 px-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              currentTab === 'objects'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Объекты ({objects.length})
          </button>

          {profile.role === 'executor' && (
            <button
              onClick={() => {
                setCurrentTab('my_tasks')
                setSelectedObjectId(null)
              }}
              className={`py-3 px-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                currentTab === 'my_tasks'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Мои задачи ({myTasks.length})
            </button>
          )}
        </div>
      </header>

      {/* Основной контент */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        {/* ============================================================== */}
        {/* ЭКРАН 1: МОИ ЗАДАЧИ ДЛЯ ИСПОЛНИТЕЛЯ */}
        {/* ============================================================== */}
        {currentTab === 'my_tasks' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Мои задачи</h1>
                <p className="text-xs text-slate-500">Задачи, назначенные на вас на всех объектах</p>
              </div>
            </div>

            {myTasks.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-800">Нет назначенных задач</h3>
                <p className="text-xs text-slate-500 mt-1">Как только постановщик создаст задачу, она появится здесь</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className="bg-white rounded-xl p-5 border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {t.object?.name || 'Объект'}
                        </span>
                        <StatusBadge status={t.status} />
                      </div>
                      <h3 className="font-semibold text-slate-900 text-sm">{t.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {t.description || 'Без описания'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                      <span>Создана {new Date(t.created_at).toLocaleDateString('ru-RU')}</span>
                      <span className="text-blue-600 font-medium">Открыть →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* ЭКРАН 2: СПИСОК ОБЪЕКТОВ */}
        {/* ============================================================== */}
        {currentTab === 'objects' && !selectedObjectId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Объекты строительства</h1>
                <p className="text-xs text-slate-500">
                  {profile.role === 'manager' 
                    ? 'Все стройки компании и контроль хода выполнения' 
                    : 'Объекты, на которых у вас есть активные задачи'}
                </p>
              </div>

              {profile.role === 'manager' && (
                <button
                  onClick={() => setShowCreateObject(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Добавить объект
                </button>
              )}
            </div>

            {objects.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-800">Объектов пока нет</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {profile.role === 'manager'
                    ? 'Создайте первый строительный объект'
                    : 'У вас пока нет задач ни на одном объекте (согласно правилам RLS)'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {objects.map((obj) => {
                  const count = tasks.filter((t) => t.object_id === obj.id).length
                  return (
                    <div
                      key={obj.id}
                      onClick={() => setSelectedObjectId(obj.id)}
                      className="bg-white rounded-xl p-5 border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                            {obj.name}
                          </h3>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{obj.address}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                        <span className="text-slate-500">
                          Задач: <strong className="text-slate-800">{count}</strong>
                        </span>
                        <span className="text-blue-600 font-medium text-xs">
                          Перейти к задачам →
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* ЭКРАН 3: КАРТОЧКА ОБЪЕКТА СО СПИСКОМ ЗАДАЧ */}
        {/* ============================================================== */}
        {currentTab === 'objects' && selectedObjectId && activeObject && (
          <div className="space-y-5">
            {/* Хлебные крошки */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedObjectId(null)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                ← Вернуться ко всем объектам
              </button>

              {profile.role === 'manager' && (
                <button
                  onClick={() => setShowCreateTask(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Поставить задачу
                </button>
              )}
            </div>

            {/* Карточка объекта */}
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">{activeObject.name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{activeObject.address}</span>
              </div>
            </div>

            {/* Список задач по объекту */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Задачи по объекту ({objectTasks.length})
              </h3>

              {objectTasks.length === 0 ? (
                <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
                  <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">На этом объекте пока нет задач</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {objectTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 text-sm">{t.title}</span>
                          <StatusBadge status={t.status} />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span>
                            Исполнитель: <strong className="text-slate-600">{t.executor?.email || 'Не назначен'}</strong>
                          </span>
                          <span>
                            Создана: {new Date(t.created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </div>

                      <button className="text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0">
                        Открыть →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* МОДАЛКА: КАРТОЧКА ЗАДАЧИ (ЭКРАН 4 ИЗ ТЗ) */}
      {/* ============================================================== */}
      {selectedTaskId && (
        <TaskModal
          taskId={selectedTaskId}
          currentProfile={profile}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={loadData}
        />
      )}

      {/* МОДАЛКА: СОЗДАНИЕ ОБЪЕКТА */}
      {showCreateObject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4">Новый строительный объект</h3>
            <form onSubmit={handleCreateObject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Название объекта</label>
                <input
                  type="text"
                  required
                  placeholder="ЖК Приморский"
                  value={newObjName}
                  onChange={(e) => setNewObjName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Адрес объекта</label>
                <input
                  type="text"
                  required
                  placeholder="ул. Набережная, 12"
                  value={newObjAddress}
                  onChange={(e) => setNewObjAddress(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateObject(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* МОДАЛКА: СОЗДАНИЕ ЗАДАЧИ */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4">Поставить новую задачу</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Название задачи</label>
                <input
                  type="text"
                  required
                  placeholder="Монтаж электропроводки"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Описание</label>
                <textarea
                  rows={3}
                  placeholder="Подробности задачи..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Назначить исполнителя</label>
                <select
                  value={newTaskExecutorId}
                  onChange={(e) => setNewTaskExecutorId(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Не назначен</option>
                  {profilesList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTask(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
                >
                  Поставить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default App
