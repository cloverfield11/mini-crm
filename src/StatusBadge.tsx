import React from 'react'
import { TaskStatus } from './supabase'

interface StatusBadgeProps {
  status: TaskStatus
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const styles: Record<TaskStatus, { bg: string; text: string; dot: string }> = {
    'Новая': { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
    'В работе': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    'На проверке': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    'Принята': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'На доработке': { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  }

  const current = styles[status] || styles['Новая']

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${current.bg} ${current.text} border border-black/5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {status}
    </span>
  )
}
