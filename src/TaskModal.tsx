import React, { useEffect, useState } from 'react'
import { supabase, TaskItem, TaskHistoryItem, Profile, TaskStatus } from './supabase'
import { StatusBadge } from './StatusBadge'
import { ArrowLeft, Clock, User, AlertTriangle, Send, CheckCircle2, RotateCcw, Play } from 'lucide-react'

interface TaskModalProps {
  taskId: string
  currentProfile: Profile
  onClose: () => void
  onUpdated: () => void
}

export const TaskModal: React.FC<TaskModalProps> = ({ taskId, currentProfile, onClose, onUpdated }) => {
  const [task, setTask] = useState<TaskItem | null>(null)
  const [history, setHistory] = useState<TaskHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showRejectInput, setShowRejectInput] = useState(false)

  const fetchTaskDetails = async () => {
    setLoading(true)
    setError(null)

    // 1. Загрузка задачи
    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .select(`
        *,
        object:objects(id, name, address),
        executor:profiles!tasks_executor_id_fkey(id, email, role),
        author:profiles!tasks_author_id_fkey(id, email, role)
      `)
      .eq('id', taskId)
      .single()

    if (taskErr || !taskData) {
      setError(taskErr?.message || 'Ошибка загрузки задачи')
      setLoading(false)
      return
    }

    setTask(taskData as unknown as TaskItem)

    // 2. Загрузка истории
    const { data: historyData } = await supabase
      .from('task_history')
      .select(`
        *,
        changer:profiles!task_history_changed_by_fkey(id, email, role)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })

    if (historyData) {
      setHistory(historyData as unknown as TaskHistoryItem[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchTaskDetails()
  }, [taskId])

  // Вызов RPC change_task_status (Стейт-машина в базе)
  const handleStatusChange = async (newStatus: TaskStatus, actionComment?: string) => {
    setActionLoading(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc('change_task_status', {
      p_task_id: taskId,
      p_new_status: newStatus,
      p_comment: actionComment || null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setActionLoading(false)
      return
    }

    setShowRejectInput(false)
    setComment('')
    await fetchTaskDetails()
    onUpdated()
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-sm text-slate-500">Загрузка карточки задачи...</p>
        </div>
      </div>
    )
  }

  if (!task) return null

  const isManager = currentProfile.role === 'manager'
  const isAssignedExecutor = task.executor_id === currentProfile.id

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Хедер */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Назад к списку
          </button>
          <StatusBadge status={task.status} />
        </div>

        {/* Тело модалки */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <h2 className="text-xl font-bold text-slate-900">{task.title}</h2>
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
              {task.description || 'Без описания'}
            </p>
          </div>

          {/* Метаданные */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
            <div>
              <span className="text-slate-400 block mb-0.5">Объект:</span>
              <span className="font-medium text-slate-800">{task.object?.name || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Исполнитель:</span>
              <span className="font-medium text-slate-800">{task.executor?.email || 'Не назначен'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Автор:</span>
              <span className="font-medium text-slate-800">{task.author?.email || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Дата создания:</span>
              <span className="font-medium text-slate-800">
                {new Date(task.created_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>

          {/* БЛОК ДОСТУПНЫХ ДЕЙСТВИЙ (Требование 2.5: только разрешенные действия) */}
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
            <h3 className="text-xs font-semibold text-blue-900 uppercase tracking-wider mb-3">
              Доступные действия
            </h3>

            <div className="flex flex-wrap gap-2">
              {/* Новая -> В работе (Исполнитель) */}
              {task.status === 'Новая' && isAssignedExecutor && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleStatusChange('В работе')}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" /> Взять в работу
                </button>
              )}

              {/* В работе -> На проверке (Исполнитель) */}
              {task.status === 'В работе' && isAssignedExecutor && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleStatusChange('На проверке')}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" /> Отправить на проверку
                </button>
              )}

              {/* На проверке -> Принята (Постановщик) */}
              {task.status === 'На проверке' && isManager && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleStatusChange('Принята')}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Принять задачу
                </button>
              )}

              {/* На проверке -> На доработке (Постановщик, комментарий обязателен) */}
              {task.status === 'На проверке' && isManager && !showRejectInput && (
                <button
                  disabled={actionLoading}
                  onClick={() => setShowRejectInput(true)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Вернуть на доработку
                </button>
              )}

              {/* На доработке -> В работе (Исполнитель) */}
              {task.status === 'На доработке' && isAssignedExecutor && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleStatusChange('В работе')}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" /> Взять в работу повторно
                </button>
              )}

              {/* Если нет доступных действий для текущей роли */}
              {!(
                (task.status === 'Новая' && isAssignedExecutor) ||
                (task.status === 'В работе' && isAssignedExecutor) ||
                (task.status === 'На проверке' && isManager) ||
                (task.status === 'На доработке' && isAssignedExecutor)
              ) && (
                <p className="text-xs text-slate-500 italic">
                  {task.status === 'Принята' 
                    ? 'Задача принята. Цикл выполнения завершен.' 
                    : 'Нет доступных действий для вашей роли в текущем статусе.'}
                </p>
              )}
            </div>

            {/* Форма ввода обязательного комментария при возврате на доработку */}
            {showRejectInput && (
              <div className="mt-3 pt-3 border-t border-blue-100">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Причина возврата на доработку (комментарий обязателен):
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Опишите, что конкретно нужно исправить..."
                  rows={2}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={actionLoading || !comment.trim()}
                    onClick={() => handleStatusChange('На доработке', comment)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Подтвердить возврат
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectInput(false)
                      setComment('')
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ИСТОРИЯ ИЗМЕНЕНИЙ (Требование 2.4: видна в карточке обеим ролям) */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> История задачи
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-slate-400">История пуста</p>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 py-1">
                {history.map((h) => (
                  <div key={h.id} className="relative pl-5">
                    <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-100" />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-slate-800">
                        {h.old_status ? `${h.old_status} → ` : 'Создана: '}
                        <span className="text-blue-600">{h.new_status}</span>
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-400">
                        {new Date(h.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <User className="w-3 h-3" />
                      <span>{h.changer?.email || 'Система'}</span>
                    </div>

                    {h.comment && (
                      <div className="mt-1.5 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="font-medium text-slate-600">Комментарий: </span>
                        {h.comment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
