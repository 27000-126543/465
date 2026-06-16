import { create } from 'zustand'
import {
  provinces, generateLamps, generateEnergyData, generateAlerts,
  generateWorkOrders, generateInspectionBatches, generateEnergyPlans,
  generateWeeklyReport, lampTypeDistribution, faultTypeDistribution
} from '@/data/mockData'
import type {
  User, StreetLamp, EnergyConsumption, Alert, WorkOrder,
  InspectionBatch, EnergyPlan, WeeklyReport, LampType, AlertType
} from '@/types'
import dayjs from 'dayjs'

interface DataState {
  // 原始数据
  allLamps: StreetLamp[]
  allEnergyData: EnergyConsumption[]
  allAlerts: Alert[]
  allWorkOrders: WorkOrder[]
  allInspectionBatches: InspectionBatch[]
  allEnergyPlans: EnergyPlan[]
  allWeeklyReports: WeeklyReport[]

  // 筛选条件
  currentUser: User | null
  selectedLampType: LampType | 'all'
  alertFilters: {
    level: string
    type: AlertType | 'all'
    handled: 'all' | 'yes' | 'no'
  }
  workOrderFilters: {
    status: string
    type: string
  }

  // 根据权限过滤后的数据
  filteredLamps: StreetLamp[]
  filteredEnergyData: EnergyConsumption[]
  filteredAlerts: Alert[]
  filteredWorkOrders: WorkOrder[]
  filteredInspectionBatches: InspectionBatch[]
  filteredEnergyPlans: EnergyPlan[]
  filteredWeeklyReports: WeeklyReport[]
  filteredProvinces: typeof provinces

  // 筛选后统计
  getFilteredStats: () => {
    totalLamps: number
    avgLightRate: number
    avgSavingRate: number
    avgFaultRate: number
    avgResponseTime: number
    unhandledAlertCount: number
    pendingWorkOrderCount: number
    completedWorkOrderCount: number
  }

  // Actions
  setUser: (user: User | null) => void
  setSelectedLampType: (type: LampType | 'all') => void
  setAlertFilters: (filters: Partial<DataState['alertFilters']>) => void
  setWorkOrderFilters: (filters: Partial<DataState['workOrderFilters']>) => void

  // 增删改操作
  addWorkOrder: (order: Omit<WorkOrder, 'id' | 'orderNo' | 'createTime' | 'status' | 'approvalLog'>) => WorkOrder
  addInspectionBatch: (batch: Omit<InspectionBatch, 'id' | 'batchNo'>) => InspectionBatch
  addEnergyPlan: (plan: Omit<EnergyPlan, 'id' | 'uploadTime'>) => EnergyPlan
  handleAlert: (alertId: string, handler: string, workOrderId?: string) => void
  generateAlert: (alert: Omit<Alert, 'id' | 'createTime' | 'isHandled'>) => Alert
  updateWorkOrderStatus: (orderId: string, action: 'approve' | 'reject', level: number, approver: string, comment: string) => boolean

  // 自动预警检查
  runAutoAlertCheck: () => Alert[]
}

const filterByPermission = <T extends { province?: string; city?: string }>(
  data: T[],
  user: User | null
): T[] => {
  if (!user) return []
  if (user.level === 'national') return data
  if (user.level === 'provincial') {
    return data.filter(d => d.province === user.province)
  }
  if (user.level === 'municipal') {
    return data.filter(d => d.province === user.province && d.city === user.city)
  }
  return []
}

const filterProvinces = (user: User | null) => {
  if (!user) return []
  if (user.level === 'national') return provinces
  if (user.level === 'provincial') {
    return provinces.filter(p => p.name === user.province)
  }
  if (user.level === 'municipal') {
    return provinces.filter(p => p.name === user.province).map(p => ({
      ...p,
      cities: p.cities.filter(c => c.name === user.city)
    }))
  }
  return []
}

let lampSeed = 1000
let alertSeed = 1000
let orderSeed = 10000
let batchSeed = 1000
let planSeed = 1000

export const useDataStore = create<DataState>((set, get) => ({
  allLamps: generateLamps(800),
  allEnergyData: generateEnergyData(120),
  allAlerts: generateAlerts(60),
  allWorkOrders: generateWorkOrders(120),
  allInspectionBatches: generateInspectionBatches(),
  allEnergyPlans: generateEnergyPlans(),
  allWeeklyReports: [generateWeeklyReport()],

  currentUser: null,
  selectedLampType: 'all',
  alertFilters: { level: 'all', type: 'all', handled: 'all' },
  workOrderFilters: { status: 'all', type: 'all' },

  filteredLamps: [],
  filteredEnergyData: [],
  filteredAlerts: [],
  filteredWorkOrders: [],
  filteredInspectionBatches: [],
  filteredEnergyPlans: [],
  filteredWeeklyReports: [],
  filteredProvinces: [],

  getFilteredStats: () => {
    const state = get()
    const lamps = state.filteredLamps
    const orders = state.filteredWorkOrders
    const alerts = state.filteredAlerts
    const provs = state.filteredProvinces

    let totalLamps = 0
    let totalLightRate = 0
    let totalSaving = 0
    let totalFaultRate = 0
    let count = 0

    provs.forEach(p => {
      p.cities.forEach(c => {
        totalLamps += c.totalLamps
        totalLightRate += c.lightRate
        totalSaving += c.energySavingRate
        totalFaultRate += c.faultRate
        count++
      })
    })

    if (lamps.length > 0 && count === 0) {
      count = 1
      totalLamps = lamps.length
      totalLightRate = (lamps.filter(l => l.status === 'normal').length / lamps.length) * 100
      totalFaultRate = (lamps.filter(l => l.status === 'fault').length / lamps.length) * 100
      totalSaving = 28
    }

    const completed = orders.filter(o => o.status === 'completed')
    const avgResponseTime = completed.length > 0
      ? completed.reduce((s, o) => s + (o.responseTime || 0), 0) / completed.length
      : 3.5

    return {
      totalLamps,
      avgLightRate: count > 0 ? Number((totalLightRate / count).toFixed(2)) : 0,
      avgSavingRate: count > 0 ? Number((totalSaving / count).toFixed(2)) : 28,
      avgFaultRate: count > 0 ? Number((totalFaultRate / count).toFixed(2)) : 0,
      avgResponseTime: Number(avgResponseTime.toFixed(1)),
      unhandledAlertCount: alerts.filter(a => !a.isHandled).length,
      pendingWorkOrderCount: orders.filter(o => o.status === 'pending' || o.status === 'processing').length,
      completedWorkOrderCount: completed.length
    }
  },

  setUser: (user) => {
    set({ currentUser: user })
    get().recalculateFiltered()
  },

  setSelectedLampType: (type) => {
    set({ selectedLampType: type })
    get().recalculateFiltered()
  },

  setAlertFilters: (filters) => {
    set(state => ({ alertFilters: { ...state.alertFilters, ...filters } }))
    get().recalculateFiltered()
  },

  setWorkOrderFilters: (filters) => {
    set(state => ({ workOrderFilters: { ...state.workOrderFilters, ...filters } }))
    get().recalculateFiltered()
  },

  recalculateFiltered: () => {
    const state = get()
    const { currentUser, selectedLampType, alertFilters, workOrderFilters } = state

    // 基础权限过滤
    let lamps = filterByPermission(state.allLamps, currentUser)
    let energyData = filterByPermission(state.allEnergyData, currentUser)
    let alerts = filterByPermission(state.allAlerts, currentUser)
    let workOrders = filterByPermission(state.allWorkOrders, currentUser)
    let batches = filterByPermission(state.allInspectionBatches, currentUser)
    let plans = filterByPermission(state.allEnergyPlans, currentUser)
    let reports = filterByPermission(state.allWeeklyReports, currentUser)
    let provs = filterProvinces(currentUser)

    // 路灯类型过滤
    if (selectedLampType !== 'all') {
      lamps = lamps.filter(l => l.type === selectedLampType)
      // 按路灯类型过滤后，重新计算城市统计数据
      provs = provs.map(p => ({
        ...p,
        cities: p.cities.map(c => {
          const cityLamps = lamps.filter(l => l.province === p.name && l.city === c.name)
          if (cityLamps.length === 0) return c
          const total = cityLamps.length
          const normal = cityLamps.filter(l => l.status === 'normal').length
          const fault = cityLamps.filter(l => l.status === 'fault').length
          return {
            ...c,
            totalLamps: total,
            lightRate: Number(((normal / total) * 100).toFixed(2)),
            faultRate: Number(((fault / total) * 100).toFixed(2))
          }
        })
      }))
    }

    // 预警过滤
    if (alertFilters.level !== 'all') {
      alerts = alerts.filter(a => a.level === Number(alertFilters.level))
    }
    if (alertFilters.type !== 'all') {
      alerts = alerts.filter(a => a.type === alertFilters.type)
    }
    if (alertFilters.handled !== 'all') {
      alerts = alerts.filter(a => alertFilters.handled === 'yes' ? a.isHandled : !a.isHandled)
    }

    // 工单过滤
    if (workOrderFilters.status !== 'all') {
      workOrders = workOrders.filter(o => o.status === workOrderFilters.status)
    }
    if (workOrderFilters.type !== 'all') {
      workOrders = workOrders.filter(o => o.type === workOrderFilters.type)
    }

    set({
      filteredLamps: lamps,
      filteredEnergyData: energyData,
      filteredAlerts: alerts,
      filteredWorkOrders: workOrders,
      filteredInspectionBatches: batches,
      filteredEnergyPlans: plans,
      filteredWeeklyReports: reports,
      filteredProvinces: provs
    })
  },

  addWorkOrder: (order) => {
    const state = get()
    const user = state.currentUser
    if (!user) throw new Error('用户未登录')

    orderSeed++
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const newOrder: WorkOrder = {
      ...order,
      id: `WO${String(orderSeed).padStart(6, '0')}`,
      orderNo: `GZ${dayjs().format('YYYYMMDD')}${String(orderSeed).padStart(4, '0')}`,
      status: 'pending',
      createTime: now,
      approvalLog: [],
      province: user.province || order.province,
      city: user.city || order.city
    }

    set(state => ({
      allWorkOrders: [newOrder, ...state.allWorkOrders]
    }))
    get().recalculateFiltered()
    return newOrder
  },

  addInspectionBatch: (batch) => {
    const state = get()
    const user = state.currentUser
    if (!user) throw new Error('用户未登录')

    batchSeed++
    const newBatch: InspectionBatch = {
      ...batch,
      id: `IB${String(batchSeed).padStart(6, '0')}`,
      batchNo: `XJ${dayjs().format('YYYYMMDD')}${String(batchSeed).padStart(3, '0')}`,
      province: user.province || batch.province,
      city: user.city || batch.city
    }

    set(state => ({
      allInspectionBatches: [newBatch, ...state.allInspectionBatches]
    }))
    get().recalculateFiltered()
    return newBatch
  },

  addEnergyPlan: (plan) => {
    const state = get()
    const user = state.currentUser
    if (!user) throw new Error('用户未登录')

    planSeed++
    const newPlan: EnergyPlan = {
      ...plan,
      id: `EP${String(planSeed).padStart(6, '0')}`,
      uploadTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      province: user.province || plan.province,
      city: user.city || plan.city
    }

    set(state => ({
      allEnergyPlans: [newPlan, ...state.allEnergyPlans]
    }))
    get().recalculateFiltered()
    return newPlan
  },

  handleAlert: (alertId, handler, workOrderId) => {
    set(state => ({
      allAlerts: state.allAlerts.map(a =>
        a.id === alertId
          ? { ...a, isHandled: true, handledTime: dayjs().format('YYYY-MM-DD HH:mm:ss'), handler, workOrderId }
          : a
      )
    }))
    get().recalculateFiltered()
  },

  generateAlert: (alert) => {
    const state = get()
    alertSeed++
    const newAlert: Alert = {
      ...alert,
      id: `ALT${String(alertSeed).padStart(6, '0')}`,
      createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      isHandled: false
    }
    set(state => ({
      allAlerts: [newAlert, ...state.allAlerts]
    }))
    get().recalculateFiltered()
    return newAlert
  },

  updateWorkOrderStatus: (orderId, action, level, approver, comment) => {
    const state = get()
    const order = state.allWorkOrders.find(o => o.id === orderId)
    if (!order) return false

    // 检查当前审批级别是否匹配
    let canProceed = false
    if (level === 1 && (order.status === 'pending' || order.status === 'processing')) canProceed = true
    if (level === 2 && order.status === 'approved1') canProceed = true
    if (level === 3 && order.status === 'approved2') canProceed = true

    if (!canProceed) return false

    const newLog = {
      level,
      approver,
      action,
      comment,
      time: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    let newStatus: WorkOrder['status'] = order.status
    if (action === 'reject') {
      newStatus = 'rejected'
    } else {
      if (level === 1) newStatus = 'approved1'
      else if (level === 2) newStatus = 'approved2'
      else if (level === 3) newStatus = 'completed'
    }

    set(state => ({
      allWorkOrders: state.allWorkOrders.map(o =>
        o.id === orderId
          ? { ...o, status: newStatus, approvalLog: [...o.approvalLog, newLog] }
          : o
      )
    }))
    get().recalculateFiltered()
    return true
  },

  runAutoAlertCheck: () => {
    const state = get()
    const lamps = state.filteredLamps
    const alerts: Alert[] = []
    const now = dayjs()

    // 按路段聚合
    const roadGroups = new Map<string, StreetLamp[]>()
    lamps.forEach(lamp => {
      const key = `${lamp.province}-${lamp.city}-${lamp.district}-${lamp.road}`
      if (!roadGroups.has(key)) roadGroups.set(key, [])
      roadGroups.get(key)!.push(lamp)
    })

    // 规则1：路段连续3天亮灯率低于95% (模拟：随机抽查几个路段生成)
    roadGroups.forEach((roadLamps, key) => {
      const [province, city, district, road] = key.split('-')
      const normalCount = roadLamps.filter(l => l.status === 'normal').length
      const lightRate = (normalCount / roadLamps.length) * 100
      
      if (lightRate < 95 && Math.random() > 0.7) {
        // 检查是否已存在同类型预警
        const existing = state.allAlerts.find(a => 
          a.type === 'light_rate' && a.road === road && !a.isHandled
        )
        if (!existing) {
          alerts.push(state.generateAlert({
            type: 'light_rate',
            level: 1,
            title: '路段亮灯率持续偏低预警',
            content: `该路段连续3天亮灯率低于95%，请及时处理。当前亮灯率：${lightRate.toFixed(1)}%`,
            province,
            city,
            district,
            road,
            value: Number(lightRate.toFixed(1)),
            threshold: 95
          }))
        }
      }
    })

    // 规则2：单灯故障超过24小时未修复
    lamps.forEach(lamp => {
      if (lamp.status === 'fault' && lamp.faultTime) {
        const faultHours = now.diff(dayjs(lamp.faultTime), 'hour')
        if (faultHours > 24) {
          const existing = state.allAlerts.find(a => 
            a.type === 'fault_timeout' && a.lampId === lamp.id && !a.isHandled
          )
          if (!existing) {
            alerts.push(state.generateAlert({
              type: 'fault_timeout',
              level: 1,
              title: '单灯故障超时未修复',
              content: `路灯故障已超过${faultHours}小时未修复，请加快处理进度。`,
              province: lamp.province,
              city: lamp.city,
              district: lamp.district,
              road: lamp.road,
              lampId: lamp.id,
              value: faultHours,
              threshold: 24
            }))
          }
        }
      }
    })

    return alerts
  }
}))

// 初始化时同步用户状态
export const syncUserToDataStore = () => {
  const saved = localStorage.getItem('lighting_user')
  if (saved) {
    const user = JSON.parse(saved)
    useDataStore.getState().setUser(user)
  }
}
