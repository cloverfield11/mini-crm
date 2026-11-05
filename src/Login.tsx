import React, { useState } from 'react'
import { supabase } from './supabase'
import { LogIn, AlertCircle } from 'lucide-react'

interface LoginProps {
  onSuccess: () => void
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })

    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' 
        ? 'Неверный логин или пароль' 
        : signInError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
  }

  // Быстрые кнопки для проверяющего тестовое
  const fillCredentials = (userEmail: string) => {
    setEmail(userEmail)
    setPassword('123456')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-xl mb-3">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Мини-CRM «Объекты и задачи»</h1>
          <p className="text-sm text-slate-500 mt-1">Вход в систему управления стройками</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="boss@test.com"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm cursor-pointer shadow-sm"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        {/* Быстрые подсказки для ревьюера */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Тестовые аккаунты (пароль 123456):
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fillCredentials('boss@test.com')}
              className="w-full text-left px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex justify-between items-center transition-colors"
            >
              <span className="font-medium text-slate-700">boss@test.com</span>
              <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium">Постановщик</span>
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('worker1@test.com')}
              className="w-full text-left px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex justify-between items-center transition-colors"
            >
              <span className="font-medium text-slate-700">worker1@test.com</span>
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-medium">Исполнитель 1</span>
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('worker2@test.com')}
              className="w-full text-left px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex justify-between items-center transition-colors"
            >
              <span className="font-medium text-slate-700">worker2@test.com</span>
              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-medium">Исполнитель 2</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
