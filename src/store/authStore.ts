import { create } from 'zustand'
import type { User, PermissionLevel } from '@/types'
import { useDataStore } from './dataStore'

interface AuthState {
  user: User | null
  isLoggedIn: boolean
  login: (username: string, password: string, level: PermissionLevel) => Promise<boolean>
  logout: () => void
}

const mockUsers: Record<PermissionLevel, User> = {
  national: {
    id: '1',
    name: '国家管理员',
    role: '国家监管',
    level: 'national',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=national'
  },
  provincial: {
    id: '2',
    name: '张省长',
    role: '省级管理员',
    level: 'provincial',
    province: '广东省',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guangdong'
  },
  municipal: {
    id: '3',
    name: '李市长',
    role: '市级管理员',
    level: 'municipal',
    province: '广东省',
    city: '深圳市',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=shenzhen'
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  login: async (username, password, level) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    if (username && password) {
      const user = mockUsers[level]
      set({ user, isLoggedIn: true })
      localStorage.setItem('lighting_user', JSON.stringify(user))
      useDataStore.getState().setUser(user)
      useDataStore.getState().recalculateFiltered()
      return true
    }
    return false
  },
  logout: () => {
    set({ user: null, isLoggedIn: false })
    localStorage.removeItem('lighting_user')
    useDataStore.getState().setUser(null)
  }
}))

export const initAuth = () => {
  const saved = localStorage.getItem('lighting_user')
  if (saved) {
    const user = JSON.parse(saved) as User
    useAuthStore.setState({ user, isLoggedIn: true })
    useDataStore.getState().setUser(user)
    useDataStore.getState().recalculateFiltered()
  }
}
