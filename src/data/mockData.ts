import type {
  Province, City, StreetLamp, EnergyConsumption, WorkOrder, Alert,
  WeeklyReport, InspectionBatch, EnergyPlan, DimmingSchedule, LampType
} from '@/types'
import dayjs from 'dayjs'

const provinceNames = ['北京市', '上海市', '广东省', '江苏省', '浙江省', '山东省', '四川省', '湖北省', '湖南省', '河南省', '福建省', '陕西省']
const cityMap: Record<string, string[]> = {
  '北京市': ['东城区', '西城区', '朝阳区', '海淀区', '丰台区'],
  '上海市': ['黄浦区', '徐汇区', '长宁区', '静安区', '浦东新区'],
  '广东省': ['广州市', '深圳市', '东莞市', '佛山市', '珠海市'],
  '江苏省': ['南京市', '苏州市', '无锡市', '常州市', '南通市'],
  '浙江省': ['杭州市', '宁波市', '温州市', '绍兴市', '嘉兴市'],
  '山东省': ['济南市', '青岛市', '烟台市', '潍坊市', '淄博市'],
  '四川省': ['成都市', '绵阳市', '德阳市', '乐山市', '泸州市'],
  '湖北省': ['武汉市', '宜昌市', '襄阳市', '荆州市', '黄冈市'],
  '湖南省': ['长沙市', '株洲市', '湘潭市', '衡阳市', '岳阳市'],
  '河南省': ['郑州市', '洛阳市', '开封市', '新乡市', '许昌市'],
  '福建省': ['福州市', '厦门市', '泉州市', '漳州市', '莆田市'],
  '陕西省': ['西安市', '咸阳市', '宝鸡市', '渭南市', '汉中市']
}

const random = (min: number, max: number, decimals = 2) => {
  return Number((Math.random() * (max - min) + min).toFixed(decimals))
}

export const generateProvinces = (): Province[] => {
  return provinceNames.map((name, idx) => {
    const cities = cityMap[name].map((cityName, cIdx) => ({
      code: `C${idx}${cIdx}`,
      name: cityName,
      provinceCode: `P${idx}`,
      totalLamps: random(5000, 50000, 0),
      lightRate: random(92, 99.5),
      energySavingRate: random(15, 40),
      faultRate: random(0.5, 5),
      avgResponseTime: random(1, 8, 1)
    }))
    return {
      code: `P${idx}`,
      name,
      cities
    }
  })
}

export const provinces = generateProvinces()

const lampTypes: LampType[] = ['LED', '高压钠灯', '金卤灯', '无极灯']
const statuses: StreetLamp['status'][] = ['normal', 'normal', 'normal', 'normal', 'fault', 'offline', 'maintenance']
const faultTypes = ['光源损坏', '电源故障', '控制板故障', '线路故障', '传感器故障', '灯杆倾斜']

export const generateLamps = (count = 500): StreetLamp[] => {
  const lamps: StreetLamp[] = []
  const roads = ['中山路', '人民路', '建设路', '解放路', '文化路', '科技路', '滨江路', '和平路', '光明路', '迎宾路']
  const districts = ['南山区', '福田区', '罗湖区', '宝安区', '龙岗区', '龙华区']
  
  for (let i = 0; i < count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const type = lampTypes[Math.floor(Math.random() * lampTypes.length)]
    lamps.push({
      id: `LAMP${String(i + 1).padStart(6, '0')}`,
      code: `LD${String(i + 1).padStart(6, '0')}`,
      province: '广东省',
      city: '深圳市',
      district: districts[i % districts.length],
      road: roads[i % roads.length] + (Math.floor(i / 10) + 1) + '段',
      type,
      power: type === 'LED' ? random(30, 150, 0) : type === '高压钠灯' ? random(100, 400, 0) : random(70, 250, 0),
      status,
      brightness: status === 'normal' ? random(70, 100, 0) : status === 'fault' ? 0 : random(0, 50, 0),
      lastUpdateTime: dayjs().subtract(random(0, 30, 0), 'minute').format('YYYY-MM-DD HH:mm:ss'),
      faultType: status === 'fault' ? faultTypes[Math.floor(Math.random() * faultTypes.length)] : undefined,
      faultTime: status === 'fault' ? dayjs().subtract(random(1, 72, 0), 'hour').format('YYYY-MM-DD HH:mm:ss') : undefined
    })
  }
  return lamps
}

export const streetLamps = generateLamps(500)

export const generateEnergyData = (days = 90, city = '深圳市', province = '广东省'): EnergyConsumption[] => {
  const data: EnergyConsumption[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
    const baseline = random(80000, 120000, 0)
    const savingRate = random(20, 35)
    const actual = baseline * (1 - savingRate / 100)
    data.push({
      date,
      province,
      city,
      actualConsumption: Number(actual.toFixed(0)),
      baselineConsumption: baseline,
      savingAmount: Number((baseline - actual).toFixed(0)),
      savingRate,
      peakConsumption: Number((actual * 0.6).toFixed(0)),
      valleyConsumption: Number((actual * 0.4).toFixed(0))
    })
  }
  return data
}

export const energyData = generateEnergyData(90)

const workOrderTypes: WorkOrder['type'][] = ['fault', 'inspection', 'emergency', 'adjustment']
const priorities: WorkOrder['priority'][] = ['low', 'medium', 'high', 'urgent']
const orderStatuses: WorkOrder['status'][] = ['pending', 'processing', 'approved1', 'approved2', 'completed', 'rejected']

export const generateWorkOrders = (count = 100): WorkOrder[] => {
  const orders: WorkOrder[] = []
  const roads = ['中山路1段', '人民路2段', '建设路3段', '解放路4段', '文化路5段', '科技路6段', '滨江路7段', '和平路8段']
  const districts = ['南山区', '福田区', '罗湖区', '宝安区', '龙岗区']
  const titles = {
    fault: ['路灯不亮维修', '路灯闪烁检修', '路灯漏电处理', '灯杆倾斜修复'],
    inspection: ['常规巡检任务', '季度专项巡检', '节前安全巡检', '雨天特巡'],
    emergency: ['大面积熄灯紧急处理', '交通事故灯杆损坏', '暴雨应急响应', '台风前加固检查'],
    adjustment: ['调光方案调整', '亮灯时间变更', '巡检批次优化', '节能策略更新']
  }
  
  for (let i = 0; i < count; i++) {
    const type = workOrderTypes[i % 4]
    const titleList = titles[type]
    const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)]
    orders.push({
      id: `WO${String(i + 1).padStart(6, '0')}`,
      orderNo: `GZ${dayjs().format('YYYYMMDD')}${String(i + 1).padStart(4, '0')}`,
      type,
      title: titleList[Math.floor(Math.random() * titleList.length)],
      description: '工单详细描述内容，包含具体的问题说明和处理要求。',
      province: '广东省',
      city: '深圳市',
      district: districts[i % districts.length],
      road: roads[i % roads.length],
      lampId: type === 'fault' ? `LAMP${String(Math.floor(Math.random() * 500) + 1).padStart(6, '0')}` : undefined,
      status,
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      createTime: dayjs().subtract(random(0, 720, 0), 'hour').format('YYYY-MM-DD HH:mm:ss'),
      responseTime: status !== 'pending' ? random(0.5, 12, 1) : undefined,
      repairTime: status === 'completed' ? random(1, 48, 1) : undefined,
      cost: status === 'completed' ? random(50, 5000, 0) : undefined,
      reporter: ['系统自动', '张工', '李工', '王工'][i % 4],
      assignee: ['运维一组', '运维二组', '运维三组', '运维四组'][i % 4],
      approvalLog: (status !== 'pending' && status !== 'processing' ? [
        { level: 1, approver: '陈组长', action: 'approve' as const, comment: '情况属实，同意处理', time: dayjs().subtract(random(1, 72, 0), 'hour').format('YYYY-MM-DD HH:mm:ss') }
      ] : []).concat((status === 'approved2' || status === 'completed') ? [
        { level: 2, approver: '刘主任', action: 'approve' as const, comment: '同意，按方案执行', time: dayjs().subtract(random(1, 48, 0), 'hour').format('YYYY-MM-DD HH:mm:ss') }
      ] : []).concat(status === 'completed' ? [
        { level: 3, approver: '王局长', action: 'approve' as const, comment: '批准归档', time: dayjs().subtract(random(1, 24, 0), 'hour').format('YYYY-MM-DD HH:mm:ss') }
      ] : [])
    })
  }
  return orders
}

export const workOrders = generateWorkOrders(100)

const alertTypes = ['light_rate', 'fault_timeout', 'energy_abnormal', 'offline'] as const

export const generateAlerts = (count = 50): Alert[] => {
  const alerts: Alert[] = []
  const roads = ['中山路1段', '人民路2段', '建设路3段', '解放路4段', '文化路5段']
  const districts = ['南山区', '福田区', '罗湖区', '宝安区']
  const titlesMap: Record<string, string[]> = {
    light_rate: ['路段亮灯率持续偏低预警', '连续多日亮灯率不达标'],
    fault_timeout: ['单灯故障超时未修复', '故障超过24小时未处理'],
    energy_abnormal: ['能耗异常波动预警', '路段用电超阈值'],
    offline: ['路灯控制器离线告警', '批量设备离线告警']
  }
  
  for (let i = 0; i < count; i++) {
    const type = alertTypes[i % 4]
    const level: Alert['level'] = type === 'light_rate' || type === 'fault_timeout' ? 1 : type === 'energy_abnormal' ? 2 : 3
    const titleList = titlesMap[type]
    alerts.push({
      id: `ALT${String(i + 1).padStart(6, '0')}`,
      type,
      level,
      title: titleList[Math.floor(Math.random() * titleList.length)],
      content: type === 'light_rate'
        ? `该路段连续3天亮灯率低于95%，请及时处理。当前亮灯率：${random(85, 94)}%`
        : type === 'fault_timeout'
        ? `路灯故障已超过24小时未修复，请加快处理进度。`
        : type === 'energy_abnormal'
        ? `该路段今日能耗较基准值高出${random(10, 40)}%，请检查是否存在异常。`
        : `检测到${random(3, 20, 0)}盏路灯控制器离线，请排查网络或设备故障。`,
      province: '广东省',
      city: '深圳市',
      district: districts[i % districts.length],
      road: roads[i % roads.length],
      lampId: type === 'fault_timeout' ? `LAMP${String(Math.floor(Math.random() * 500) + 1).padStart(6, '0')}` : undefined,
      value: type === 'light_rate' ? random(85, 94) : type === 'energy_abnormal' ? random(110, 150) : undefined,
      threshold: type === 'light_rate' ? 95 : type === 'energy_abnormal' ? 100 : undefined,
      createTime: dayjs().subtract(random(0.5, 48, 1), 'hour').format('YYYY-MM-DD HH:mm:ss'),
      isHandled: Math.random() > 0.5,
      handledTime: Math.random() > 0.5 ? dayjs().subtract(random(0.1, 24, 1), 'hour').format('YYYY-MM-DD HH:mm:ss') : undefined,
      handler: Math.random() > 0.5 ? ['陈组长', '刘工', '张工'][Math.floor(Math.random() * 3)] : undefined,
      workOrderId: Math.random() > 0.5 ? `WO${String(Math.floor(Math.random() * 100) + 1).padStart(6, '0')}` : undefined
    })
  }
  return alerts
}

export const alerts = generateAlerts(50)

export const generateWeeklyReport = (): WeeklyReport => {
  return {
    id: 'WR2026W24',
    weekStart: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    weekEnd: dayjs().format('YYYY-MM-DD'),
    lightRate: 97.8,
    lightRateYoY: 1.2,
    lightRateWoW: 0.3,
    energySavingRate: 28.5,
    energySavingRateYoY: 3.8,
    energySavingRateWoW: 0.9,
    faultRate: 1.8,
    faultRateYoY: -0.5,
    faultRateWoW: -0.2,
    avgResponseTime: 2.8,
    avgResponseTimeYoY: -0.6,
    avgResponseTimeWoW: -0.3,
    totalRepairCost: 186500,
    repairCostWoW: -5.2,
    optimizationSuggestions: [
      '建议增加南山区科技路片区夜间巡检频次，该区域本周故障上报较上周增长15%',
      '建议对使用超过5年的高压钠灯进行LED改造评估，该类灯具故障率是LED的3.2倍',
      '优化1:00-5:00时段调光策略，可在不影响照明质量的前提下再节省5-8%能耗',
      '建立片区运维小组竞赛机制，提升工单响应速度和一次修复率'
    ],
    retrofitPlan: [
      '福田区中心区5000盏高压钠灯LED改造项目，预计投资450万元，年节电约120万度',
      '罗湖区旧城区3200套控制系统升级改造，支持远程精准调光和故障预警',
      '南山区科技园新增智慧路灯200套，集成5G微基站、环境监测、充电桩等多功能'
    ]
  }
}

export const weeklyReport = generateWeeklyReport()

export const generateInspectionBatches = (): InspectionBatch[] => {
  const batches: InspectionBatch[] = []
  const roads = ['中山路', '人民路', '建设路', '解放路', '文化路', '科技路']
  const districts = ['南山区', '福田区', '罗湖区', '宝安区']
  const statuses: InspectionBatch['status'][] = ['pending', 'in_progress', 'completed']
  
  for (let i = 0; i < 20; i++) {
    batches.push({
      id: `IB${String(i + 1).padStart(6, '0')}`,
      batchNo: `XJ${dayjs().format('YYYYMMDD')}${String(i + 1).padStart(3, '0')}`,
      province: '广东省',
      city: '深圳市',
      district: districts[i % districts.length],
      roads: [roads[i % roads.length] + '1段', roads[i % roads.length] + '2段'],
      lampCount: random(50, 300, 0),
      scheduleDate: dayjs().add(random(-3, 7, 0), 'day').format('YYYY-MM-DD'),
      inspector: ['张巡检', '李巡检', '王巡检', '赵巡检'][i % 4],
      status: statuses[i % 3]
    })
  }
  return batches
}

export const inspectionBatches = generateInspectionBatches()

const defaultDimmingSchedule: DimmingSchedule[] = [
  { timeRange: '黄昏时段', startHour: 18, endHour: 20, brightness: 100, season: '全年' },
  { timeRange: '晚间高峰', startHour: 20, endHour: 23, brightness: 100, season: '全年' },
  { timeRange: '深夜时段', startHour: 23, endHour: 5, brightness: 60, season: '全年' },
  { timeRange: '凌晨时段', startHour: 5, endHour: 7, brightness: 80, season: '全年' }
]

export const generateEnergyPlans = (): EnergyPlan[] => {
  return [
    {
      id: 'EP2026001',
      year: 2026,
      province: '广东省',
      city: '深圳市',
      uploadTime: '2026-01-15 10:30:00',
      dimmingSchedule: defaultDimmingSchedule,
      targetSavingRate: 30,
      predictedConsumption: 28500000
    }
  ]
}

export const energyPlans = generateEnergyPlans()

export const lampTypeDistribution = [
  { type: 'LED', count: 28500, percent: 57 },
  { type: '高压钠灯', count: 12500, percent: 25 },
  { type: '金卤灯', count: 5500, percent: 11 },
  { type: '无极灯', count: 3500, percent: 7 }
]

export const faultTypeDistribution = [
  { type: '光源损坏', count: 156, percent: 32 },
  { type: '电源故障', count: 128, percent: 26 },
  { type: '控制板故障', count: 89, percent: 18 },
  { type: '线路故障', count: 68, percent: 14 },
  { type: '传感器故障', count: 32, percent: 7 },
  { type: '灯杆倾斜', count: 15, percent: 3 }
]

export const predictedEnergyData = (): { dates: string[]; actual: number[]; predicted: number[]; optimized: number[] } => {
  const dates: string[] = []
  const actual: number[] = []
  const predicted: number[] = []
  const optimized: number[] = []
  
  for (let i = 0; i < 90; i++) {
    const date = dayjs().add(i, 'day').format('MM-DD')
    const base = random(75000, 95000, 0)
    dates.push(date)
    actual.push(i < 30 ? base : 0)
    predicted.push(base * (0.95 + Math.random() * 0.1))
    optimized.push(base * (0.85 + Math.random() * 0.08))
  }
  return { dates, actual, predicted, optimized }
}
