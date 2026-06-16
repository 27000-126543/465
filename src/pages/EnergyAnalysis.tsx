import { useState, useMemo } from 'react'
import {
  Row, Col, Card, Upload, Button, Space, Table, Tag, Progress,
  message, Select, Modal, Form, Slider, Typography, List, Alert,
  Tabs, Breadcrumb
} from 'antd'
import {
  UploadOutlined, ThunderboltOutlined, BulbOutlined,
  ExperimentOutlined, FileExcelOutlined, CheckCircleOutlined,
  CloseCircleOutlined, InfoCircleOutlined, HomeOutlined,
  EnvironmentOutlined, DashboardOutlined, AlertOutlined,
  CloudOutlined, RiseOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '@/store/dataStore'
import { faultTypeDistribution, lampTypeDistribution, provinces } from '@/data/mockData'
import type { EnergyPlan, DimmingSchedule } from '@/types'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const { Title, Text, Paragraph } = Typography

type DrillLevel = 'province' | 'city' | 'road'

interface DrillState {
  level: DrillLevel
  province: string
  city: string
  district: string
  road: string
}

interface AnomalyRecord {
  date: string
  actualConsumption: number
  baselineConsumption: number
  deviationRate: number
  road: string
  possibleCause: string
}

const possibleCauses = ['灯具老化', '调光异常', '气温骤降', '故障增加', '其他']

export default function EnergyAnalysis() {
  const {
    currentUser,
    filteredEnergyData,
    filteredEnergyPlans,
    filteredLamps,
    filteredAlerts,
    addEnergyPlan
  } = useDataStore()

  const [selectedPlan, setSelectedPlan] = useState<EnergyPlan | null>(null)
  const [uploading, setUploading] = useState(false)
  const [predictVisible, setPredictVisible] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [parsedSchedule, setParsedSchedule] = useState<DimmingSchedule[]>([])
  const [dimmingSchedule, setDimmingSchedule] = useState<DimmingSchedule[]>([
    { timeRange: '黄昏时段', startHour: 18, endHour: 20, brightness: 100 },
    { timeRange: '晚间高峰', startHour: 20, endHour: 23, brightness: 100 },
    { timeRange: '深夜时段', startHour: 23, endHour: 5, brightness: 60 },
    { timeRange: '凌晨时段', startHour: 5, endHour: 7, brightness: 80 }
  ])

  const [drillState, setDrillState] = useState<DrillState>({
    level: 'province',
    province: currentUser?.province || '广东省',
    city: currentUser?.city || '深圳市',
    district: '南山区',
    road: '科技路1段'
  })

  const [selectedAnomalyDate, setSelectedAnomalyDate] = useState<string | null>(null)

  const energyStats = useMemo(() => {
    const last30 = filteredEnergyData.slice(-30)
    const totalSaving = last30.reduce((s, d) => s + d.savingAmount, 0)
    const avgSavingRate = last30.length > 0
      ? last30.reduce((s, d) => s + d.savingRate, 0) / last30.length
      : 0
    const totalActual = last30.reduce((s, d) => s + d.actualConsumption, 0)
    const lampTypeStats = lampTypeDistribution.map((t: any) => {
      const count = filteredLamps.filter(l => l.type === t.type).length
      return { ...t, count }
    })
    return {
      totalSaving,
      avgSavingRate: Number(avgSavingRate.toFixed(1)),
      totalActual,
      lampTypeStats,
      co2Reduction: Number((totalSaving * 0.785 / 1000).toFixed(0))
    }
  }, [filteredEnergyData, filteredLamps])

  const predictionOption = useMemo(() => {
    const dates: string[] = []
    const actual: number[] = []
    const predicted: number[] = []
    const optimized: number[] = []

    for (let i = 30; i > 0; i--) {
      dates.push(dayjs().subtract(i, 'day').format('MM-DD'))
      const val = filteredEnergyData[filteredEnergyData.length - i]?.actualConsumption || 80000
      actual.push(val)
      predicted.push(null as any)
      optimized.push(null as any)
    }
    for (let i = 0; i < 90; i++) {
      dates.push(dayjs().add(i, 'day').format('MM-DD'))
      actual.push(null as any)
      const brightnessFactor = dimmingSchedule.reduce((acc, s) => {
        const hours = s.startHour < s.endHour
          ? s.endHour - s.startHour
          : (24 - s.startHour) + s.endHour
        return acc + (s.brightness / 100) * (hours / 24)
      }, 0)
      const base = 85000 + Math.sin(i / 10) * 5000 + Math.random() * 3000
      predicted.push(base)
      optimized.push(base * brightnessFactor)
    }

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['历史实际', '预测能耗', '优化后预测'], top: 0 },
      grid: { left: 60, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 10, interval: 5 }
      },
      yAxis: { type: 'value', name: 'kWh' },
      series: [
        {
          name: '历史实际',
          type: 'line',
          data: actual,
          smooth: true,
          itemStyle: { color: '#1677ff' },
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.1 }
        },
        {
          name: '预测能耗',
          type: 'line',
          data: predicted,
          smooth: true,
          lineStyle: { type: 'dashed', color: '#faad14' },
          itemStyle: { color: '#faad14' }
        },
        {
          name: '优化后预测',
          type: 'line',
          data: optimized,
          smooth: true,
          lineStyle: { type: 'dashed', color: '#52c41a' },
          itemStyle: { color: '#52c41a' },
          areaStyle: { opacity: 0.08 }
        }
      ]
    }
  }, [filteredEnergyData, dimmingSchedule])

  const savingTrendOption = useMemo(() => {
    const last90 = filteredEnergyData.slice(-90)
    if (last90.length === 0) return {
      title: { text: '暂无能耗数据', left: 'center', top: 'center' }
    }
    let cumulative = 0
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['节能率', '累计节能量'], top: 0 },
      grid: { left: 50, right: 50, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: last90.map(d => dayjs(d.date).format('MM-DD')),
        axisLabel: { fontSize: 10, interval: 10 }
      },
      yAxis: [
        { type: 'value', name: '节能率(%)', min: 0, max: 50 },
        { type: 'value', name: '累计节能(kWh)', min: 0 }
      ],
      series: [
        {
          name: '节能率',
          type: 'line',
          data: last90.map(d => d.savingRate),
          smooth: true,
          itemStyle: { color: '#52c41a' },
          lineStyle: { width: 2 }
        },
        {
          name: '累计节能量',
          type: 'bar',
          yAxisIndex: 1,
          data: last90.map(d => { cumulative += d.savingAmount; return cumulative }),
          itemStyle: { color: '#1677ff', opacity: 0.3 },
          barWidth: 4
        }
      ]
    }
  }, [filteredEnergyData])

  const dimmingVisualOption = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
    const data = hours.map((_, i) => {
      for (const sched of dimmingSchedule) {
        if (sched.startHour < sched.endHour) {
          if (i >= sched.startHour && i < sched.endHour) return sched.brightness
        } else {
          if (i >= sched.startHour || i < sched.endHour) return sched.brightness
        }
      }
      return 0
    })

    return {
      tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].name}<br/>亮度: ${params[0].value}%` },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: hours, axisLabel: { fontSize: 10, interval: 2 } },
      yAxis: { type: 'value', name: '亮度(%)', min: 0, max: 100 },
      series: [{
        type: 'line',
        data,
        smooth: false,
        step: 'after',
        areaStyle: { opacity: 0.2, color: '#faad14' },
        itemStyle: { color: '#faad14' },
        lineStyle: { width: 2 }
      }]
    }
  }, [dimmingSchedule])

  const availableProvinces = useMemo(() => {
    const provSet = new Set<string>()
    filteredLamps.forEach(l => provSet.add(l.province))
    filteredEnergyData.forEach(d => provSet.add(d.province))
    if (provSet.size === 0) return provinces.map(p => p.name)
    return Array.from(provSet)
  }, [filteredLamps, filteredEnergyData])

  const availableCities = useMemo(() => {
    const citySet = new Set<string>()
    filteredLamps.filter(l => l.province === drillState.province).forEach(l => citySet.add(l.city))
    filteredEnergyData.filter(d => d.province === drillState.province).forEach(d => citySet.add(d.city))
    if (citySet.size === 0) {
      const prov = provinces.find(p => p.name === drillState.province)
      return prov ? prov.cities.map(c => c.name) : []
    }
    return Array.from(citySet)
  }, [filteredLamps, filteredEnergyData, drillState.province])

  const availableRoads = useMemo(() => {
    const roadSet = new Set<string>()
    filteredLamps
      .filter(l => l.province === drillState.province && l.city === drillState.city)
      .forEach(l => roadSet.add(l.road))
    if (roadSet.size === 0) {
      const roads = ['中山路1段', '人民路2段', '建设路3段', '解放路1段', '文化路2段', '科技路1段', '滨江路3段', '和平路2段']
      return roads
    }
    return Array.from(roadSet)
  }, [filteredLamps, drillState.province, drillState.city])

  const scopedEnergyData = useMemo(() => {
    let data = filteredEnergyData
    if (drillState.level === 'province') {
      data = data.filter(d => d.province === drillState.province)
    } else if (drillState.level === 'city' || drillState.level === 'road') {
      data = data.filter(d => d.province === drillState.province && d.city === drillState.city)
    }
    return data.slice(-30)
  }, [filteredEnergyData, drillState])

  const traceKPI = useMemo(() => {
    const last30 = scopedEnergyData
    const actualTotal = last30.reduce((s, d) => s + d.actualConsumption, 0)
    const baselineTotal = last30.reduce((s, d) => s + d.baselineConsumption, 0)
    const deviationRate = baselineTotal > 0
      ? Number((((actualTotal - baselineTotal) / baselineTotal) * 100).toFixed(2))
      : 0
    const anomalyCount = last30.filter(d => {
      const rate = d.baselineConsumption > 0
        ? Math.abs((d.actualConsumption - d.baselineConsumption) / d.baselineConsumption) * 100
        : 0
      return rate > 15
    }).length
    return { actualTotal, baselineTotal, deviationRate, anomalyCount }
  }, [scopedEnergyData])

  const compareChartOption = useMemo(() => {
    const dates = scopedEnergyData.map(d => dayjs(d.date).format('MM-DD'))
    const actualData = scopedEnergyData.map(d => d.actualConsumption)
    const baselineData = scopedEnergyData.map(d => d.baselineConsumption)
    const anomalyPoints = scopedEnergyData.map((d, idx) => {
      const rate = d.baselineConsumption > 0
        ? Math.abs((d.actualConsumption - d.baselineConsumption) / d.baselineConsumption) * 100
        : 0
      return rate > 15 ? { value: d.actualConsumption, itemStyle: { color: '#ff4d4f' }, symbolSize: 12 } : d.actualConsumption
    })

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const date = params[0].axisValue
          const actual = params[0]?.value || 0
          const baseline = params[1]?.value || 0
          const deviation = baseline > 0
            ? (((actual - baseline) / baseline) * 100).toFixed(2)
            : '0.00'
          return `${date}<br/>实际能耗: ${actual.toLocaleString()} kWh<br/>基准能耗: ${baseline.toLocaleString()} kWh<br/>偏差率: ${deviation}%`
        }
      },
      legend: { data: ['实际能耗', '基准能耗'], top: 0 },
      grid: { left: 70, right: 30, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 10, interval: 2 }
      },
      yAxis: {
        type: 'value',
        name: 'kWh',
        axisLabel: {
          formatter: (v: number) => (v / 10000).toFixed(0) + '万'
        }
      },
      series: [
        {
          name: '实际能耗',
          type: 'line',
          data: anomalyPoints,
          smooth: true,
          itemStyle: { color: '#1677ff' },
          lineStyle: { width: 2 },
          emphasis: { focus: 'series' }
        },
        {
          name: '基准能耗',
          type: 'line',
          data: baselineData,
          smooth: true,
          lineStyle: { type: 'dashed', color: '#faad14', width: 2 },
          itemStyle: { color: '#faad14' }
        }
      ]
    }
  }, [scopedEnergyData])

  const anomalyRecords: AnomalyRecord[] = useMemo(() => {
    const records: AnomalyRecord[] = []
    const roads = drillState.level === 'road' ? [drillState.road] : availableRoads.slice(0, 5)

    scopedEnergyData.forEach((d) => {
      const rate = d.baselineConsumption > 0
        ? (((d.actualConsumption - d.baselineConsumption) / d.baselineConsumption) * 100)
        : 0
      if (Math.abs(rate) > 15) {
        records.push({
          date: d.date,
          actualConsumption: d.actualConsumption,
          baselineConsumption: d.baselineConsumption,
          deviationRate: Number(rate.toFixed(2)),
          road: roads[Math.floor(Math.random() * roads.length)],
          possibleCause: possibleCauses[Math.floor(Math.random() * possibleCauses.length)]
        })
      }
    })

    if (drillState.level === 'road') {
      return records.map(r => ({ ...r, road: drillState.road }))
    }
    return records.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
  }, [scopedEnergyData, availableRoads, drillState])

  const filteredAnomalyRecords = useMemo(() => {
    if (!selectedAnomalyDate) return anomalyRecords
    return anomalyRecords.filter(r => dayjs(r.date).format('MM-DD') === selectedAnomalyDate)
  }, [anomalyRecords, selectedAnomalyDate])

  const weatherCardOption = useMemo(() => {
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    const monthlyData = monthNames.map(() => Math.floor(500000 + Math.random() * 300000))
    return {
      tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0].name}<br/>能耗: ${params[0].value.toLocaleString()} kWh` },
      grid: { left: 60, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: monthNames,
        axisLabel: { fontSize: 9 }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => (v / 10000).toFixed(0) + '万'
        }
      },
      series: [{
        type: 'bar',
        data: monthlyData,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#1677ff' },
              { offset: 1, color: '#69c0ff' }
            ]
          }
        },
        barWidth: '50%'
      }]
    }
  }, [])

  const lampTypePieOption = useMemo(() => {
    const typeCounts = filteredLamps.length > 0
      ? (() => {
          const counts: Record<string, number> = { LED: 0, '高压钠灯': 0, '金卤灯': 0, '无极灯': 0 }
          filteredLamps.forEach(l => {
            if (counts[l.type] !== undefined) counts[l.type]++
          })
          const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
          return Object.entries(counts).map(([name, value]) => ({
            name,
            value,
            percent: Number(((value / total) * 100).toFixed(1))
          }))
        })()
      : lampTypeDistribution.map((t: any) => ({ name: t.type, value: t.count, percent: t.percent }))

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: typeCounts
      }]
    }
  }, [filteredLamps])

  const faultBarOption = useMemo(() => {
    const typeAlerts = filteredAlerts.length > 0
      ? (() => {
          const typeMap: Record<string, number> = {
            '光源损坏': 0, '电源故障': 0, '控制板故障': 0,
            '线路故障': 0, '传感器故障': 0, '灯杆倾斜': 0
          }
          const alertTypeMap: Record<string, string> = {
            light_rate: '控制板故障',
            fault_timeout: '光源损坏',
            energy_abnormal: '电源故障',
            offline: '线路故障'
          }
          filteredAlerts.forEach(a => {
            const mapped = alertTypeMap[a.type] || '传感器故障'
            typeMap[mapped] = (typeMap[mapped] || 0) + 1
          })
          return Object.entries(typeMap).map(([name, count]) => ({ name, count }))
        })()
      : faultTypeDistribution.map((t: any) => ({ name: t.type, count: t.count }))

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 90, right: 20, top: 10, bottom: 20 },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: typeAlerts.map(t => t.name).reverse(),
        axisLabel: { fontSize: 10 }
      },
      series: [{
        type: 'bar',
        data: typeAlerts.map(t => t.count).reverse(),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#ff7a45' },
              { offset: 1, color: '#ffa940' }
            ]
          },
          borderRadius: [0, 4, 4, 0]
        },
        barWidth: '55%',
        label: { show: true, position: 'right', fontSize: 10 }
      }]
    }
  }, [filteredAlerts])

  const dimmingChangeTimeline = useMemo(() => {
    const changes = [
      {
        time: dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm'),
        name: '深夜时段亮度调整',
        desc: '深夜时段（23:00-5:00）亮度从65%降至55%',
        operator: '张工'
      },
      {
        time: dayjs().subtract(8, 'day').format('YYYY-MM-DD HH:mm'),
        name: '黄昏时段延长',
        desc: '黄昏时段调整为 18:30-20:30，亮度保持100%',
        operator: '李工'
      },
      {
        time: dayjs().subtract(15, 'day').format('YYYY-MM-DD HH:mm'),
        name: '夏季调光方案切换',
        desc: '切换至夏季模式，凌晨时段延长至7:30',
        operator: '王工'
      },
      {
        time: dayjs().subtract(22, 'day').format('YYYY-MM-DD HH:mm'),
        name: '商业区亮度提升',
        desc: '晚间高峰（20:00-23:00）亮度提升至100%',
        operator: '陈工'
      },
      {
        time: dayjs().subtract(30, 'day').format('YYYY-MM-DD HH:mm'),
        name: '月初方案复核',
        desc: '复核上月节能方案，微调凌晨时段亮度至75%',
        operator: '刘工'
      }
    ]
    return changes
  }, [])

  const currentSeason = useMemo(() => {
    const month = dayjs().month() + 1
    if (month >= 3 && month <= 5) return { name: '春季', temp: 22, rain: 8 }
    if (month >= 6 && month <= 8) return { name: '夏季', temp: 30, rain: 15 }
    if (month >= 9 && month <= 11) return { name: '秋季', temp: 24, rain: 6 }
    return { name: '冬季', temp: 12, rain: 4 }
  }, [])

  const handleCompareChartClick = (params: any) => {
    if (params.componentType === 'series' && params.seriesName === '实际能耗') {
      const date = params.name
      const data = scopedEnergyData[params.dataIndex]
      const rate = data && data.baselineConsumption > 0
        ? Math.abs(((data.actualConsumption - data.baselineConsumption) / data.baselineConsumption) * 100)
        : 0
      if (rate > 15) {
        setSelectedAnomalyDate(date)
        message.info(`已筛选 ${date} 的异常记录`)
      }
    }
  }

  const onBreadcrumbClick = (level: DrillLevel) => {
    setSelectedAnomalyDate(null)
    if (level === 'province') {
      setDrillState(prev => ({ ...prev, level: 'province' }))
    } else if (level === 'city') {
      setDrillState(prev => ({ ...prev, level: 'city' }))
    }
  }

  const anomalyTableColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      sorter: (a: AnomalyRecord, b: AnomalyRecord) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
    },
    {
      title: '实际能耗(kWh)',
      dataIndex: 'actualConsumption',
      key: 'actualConsumption',
      width: 140,
      render: (v: number) => v.toLocaleString(),
      sorter: (a: AnomalyRecord, b: AnomalyRecord) => a.actualConsumption - b.actualConsumption
    },
    {
      title: '基准能耗(kWh)',
      dataIndex: 'baselineConsumption',
      key: 'baselineConsumption',
      width: 140,
      render: (v: number) => v.toLocaleString(),
      sorter: (a: AnomalyRecord, b: AnomalyRecord) => a.baselineConsumption - b.baselineConsumption
    },
    {
      title: '偏差率',
      dataIndex: 'deviationRate',
      key: 'deviationRate',
      width: 120,
      render: (v: number) => (
        <Tag color={v > 0 ? 'red' : 'green'}>
          {v > 0 ? '+' : ''}{v.toFixed(2)}%
        </Tag>
      ),
      sorter: (a: AnomalyRecord, b: AnomalyRecord) => a.deviationRate - b.deviationRate
    },
    {
      title: '关联路段',
      dataIndex: 'road',
      key: 'road',
      width: 140,
      render: (v: string) => (
        <span style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => {
          setDrillState(prev => ({ ...prev, level: 'road', road: v }))
          setSelectedAnomalyDate(null)
        }}>
          <EnvironmentOutlined /> {v}
        </span>
      )
    },
    {
      title: '疑似原因',
      dataIndex: 'possibleCause',
      key: 'possibleCause',
      width: 130,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          '灯具老化': 'purple',
          '调光异常': 'orange',
          '气温骤降': 'blue',
          '故障增加': 'red',
          '其他': 'default'
        }
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>
      }
    }
  ]

  const headerMapping: Record<string, string[]> = {
    startHour: ['开始时间', '开始时段', 'start', '起始时间', 'startHour', '开始'],
    endHour: ['结束时间', '结束时段', 'end', '截止时间', 'endHour', '结束'],
    brightness: ['亮度', '调光亮度', '亮度值', 'brightness', '调光值', '亮度(%)'],
    timeRange: ['时段', '时间段', '时间范围', 'timeRange', '时段名称', '备注'],
    season: ['季节', 'season', '适用季节', '季度'],
    targetSavingRate: ['目标节能率', '节能率目标', 'target', '节能目标', '预期节能率']
  }

  const parseExcelData = (data: any[]): { schedule: DimmingSchedule[]; targetRate: number; errors: string[] } => {
    const errors: string[] = []
    const schedule: DimmingSchedule[] = []
    let targetRate = 30

    if (data.length === 0) {
      errors.push('Excel文件为空，没有找到任何数据')
      return { schedule, targetRate, errors }
    }

    const headers = Object.keys(data[0] || {})
    const mappedHeaders: Record<string, string> = {}

    for (const header of headers) {
      const headerLower = String(header).toLowerCase().trim()
      for (const [key, patterns] of Object.entries(headerMapping)) {
        if (patterns.some(p => headerLower.includes(p.toLowerCase()))) {
          mappedHeaders[key] = header
          break
        }
      }
    }

    const requiredFields = ['startHour', 'endHour', 'brightness']
    const missingFields = requiredFields.filter(f => !mappedHeaders[f])
    if (missingFields.length > 0) {
      errors.push(`缺少必填列：${missingFields.map(f => {
        const map: Record<string, string> = {
          startHour: '开始时间',
          endHour: '结束时间',
          brightness: '亮度'
        }
        return map[f]
      }).join('、')}`)
    }

    if (mappedHeaders.targetSavingRate && data[0][mappedHeaders.targetSavingRate]) {
      const rate = Number(data[0][mappedHeaders.targetSavingRate])
      if (!isNaN(rate)) targetRate = rate
    }

    if (errors.length > 0) {
      return { schedule, targetRate, errors }
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const startVal = row[mappedHeaders.startHour]
      const endVal = row[mappedHeaders.endHour]
      const brightVal = row[mappedHeaders.brightness]
      const rangeVal = mappedHeaders.timeRange ? row[mappedHeaders.timeRange] : null
      const seasonVal = mappedHeaders.season ? row[mappedHeaders.season] : null

      let startHour = Number(startVal)
      let endHour = Number(endVal)
      let brightness = Number(brightVal)

      if (isNaN(startHour) && String(startVal).includes(':')) {
        startHour = parseInt(String(startVal).split(':')[0])
      }
      if (isNaN(endHour) && String(endVal).includes(':')) {
        endHour = parseInt(String(endVal).split(':')[0])
      }
      if (isNaN(brightness) && String(brightVal).includes('%')) {
        brightness = parseInt(String(brightVal).replace('%', ''))
      }

      if (isNaN(startHour) || startHour < 0 || startHour > 23) {
        errors.push(`第${i + 1}行：开始时间"${startVal}"格式不正确，应为0-23的整数或HH:MM格式`)
        continue
      }
      if (isNaN(endHour) || endHour < 0 || endHour > 23) {
        errors.push(`第${i + 1}行：结束时间"${endVal}"格式不正确，应为0-23的整数或HH:MM格式`)
        continue
      }
      if (isNaN(brightness) || brightness < 0 || brightness > 100) {
        errors.push(`第${i + 1}行：亮度"${brightVal}"格式不正确，应为0-100的数字`)
        continue
      }

      schedule.push({
        timeRange: String(rangeVal || `时段${i + 1}`),
        startHour,
        endHour,
        brightness,
        season: seasonVal ? String(seasonVal) : '全年'
      })
    }

    return { schedule, targetRate, errors }
  }

  const beforeUpload = (file: File) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    if (!isExcel) {
      setUploadError('只能上传Excel文件（.xlsx 或 .xls 格式）')
      return false
    }

    setUploading(true)
    setUploadError(null)
    setParsedSchedule([])

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        console.log('解析的Excel数据:', jsonData)

        const { schedule, targetRate, errors } = parseExcelData(jsonData)

        if (errors.length > 0) {
          setUploadError(errors.join('\n'))
          setUploading(false)
          return
        }

        if (schedule.length === 0) {
          setUploadError('未能从Excel中识别有效的调光时段数据')
          setUploading(false)
          return
        }

        if (!currentUser) {
          setUploadError('用户未登录')
          setUploading(false)
          return
        }

        setParsedSchedule(schedule)

        const newPlan = addEnergyPlan({
          year: dayjs().year(),
          province: currentUser.province || '广东省',
          city: currentUser.city || '深圳市',
          dimmingSchedule: schedule,
          targetSavingRate: targetRate,
          predictedConsumption: 28000000
        })

        setSelectedPlan(newPlan)
        setDimmingSchedule(schedule)
        setUploading(false)
        message.success(`节能计划上传成功，已识别 ${schedule.length} 个调光时段，目标节能率 ${targetRate}%`)

      } catch (err) {
        console.error(err)
        setUploadError('文件解析失败，请检查文件格式是否正确')
        setUploading(false)
      }
    }
    reader.readAsArrayBuffer(file)
    return false
  }

  const recommendationPlans = [
    { id: 1, name: '深度调光方案', desc: '深夜时段（23:00-5:00）亮度降至50%，凌晨（5:00-7:00）调至70%', savingRate: '增加 5-8%', investment: 0, payback: '立即见效', recommended: true },
    { id: 2, name: '分时分区方案', desc: '商业区晚高峰保持100%，居住区22点后降至60%', savingRate: '增加 8-12%', investment: 50000, payback: '6个月', recommended: true },
    { id: 3, name: 'LED改造升级', desc: '将剩余高压钠灯和金卤灯全部替换为LED', savingRate: '整体提升至 35%+', investment: 4500000, payback: '3.5年', recommended: false },
    { id: 4, name: '智能感应调光', desc: '加装人体/车辆感应，无车无人时自动降亮', savingRate: '增加 10-15%', investment: 1200000, payback: '2年', recommended: false }
  ]

  const planColumns = [
    { title: '计划编号', dataIndex: 'id', key: 'id', width: 120 },
    { title: '年度', dataIndex: 'year', key: 'year', width: 80 },
    {
      title: '适用范围', key: 'scope',
      render: (_: any, record: EnergyPlan) => <span>{record.province} · {record.city}</span>
    },
    {
      title: '目标节能率', dataIndex: 'targetSavingRate', key: 'targetSavingRate', width: 100,
      render: (v: number) => <Tag color="green">{v}%</Tag>
    },
    {
      title: '调光时段', dataIndex: 'dimmingSchedule', key: 'dimmingSchedule',
      render: (sched: DimmingSchedule[]) => (
        <Space wrap>
          {sched.map((s, i) => (
            <Tag key={i}>
              {s.timeRange}
              {s.season && ` (${s.season})`}
              : {s.brightness}%
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: '预测年能耗', dataIndex: 'predictedConsumption', key: 'predictedConsumption', width: 120,
      render: (v: number) => `${(v / 10000).toFixed(1)}万 kWh`
    },
    { title: '上传时间', dataIndex: 'uploadTime', key: 'uploadTime', width: 160 },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, record: EnergyPlan) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => {
            setSelectedPlan(record)
            setDimmingSchedule(record.dimmingSchedule)
            message.info('已应用此调光方案')
          }}>应用方案</Button>
          <Button type="link" size="small" onClick={() => setPredictVisible(true)}>预测分析</Button>
        </Space>
      )
    }
  ]

  const levelText = currentUser?.level === 'national' ? '全国' :
    currentUser?.level === 'provincial' ? currentUser.province :
    currentUser?.level === 'municipal' ? currentUser.city : ''

  const renderOverviewTab = () => (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="stat-card orange">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">本月节电量</div>
                <div className="stat-value" style={{ fontSize: 26 }}>
                  {(energyStats.totalSaving / 10000).toFixed(1)}万
                </div>
                <div className="stat-trend">kWh · {levelText}范围</div>
              </div>
              <ThunderboltOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card green">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">平均节能率</div>
                <div className="stat-value" style={{ fontSize: 26 }}>{energyStats.avgSavingRate}%</div>
                <div className="stat-trend">较目标 30% 差 {(30 - energyStats.avgSavingRate).toFixed(1)}%</div>
              </div>
              <ThunderboltOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card blue">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">累计节能量</div>
                <div className="stat-value" style={{ fontSize: 26 }}>
                  {Math.floor(energyStats.totalActual * 0.285 / 10000)}万
                </div>
                <div className="stat-trend">
                  kWh · 减碳 {energyStats.co2Reduction}吨
                </div>
              </div>
              <ThunderboltOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">节能灯具占比</div>
                <div className="stat-value" style={{ fontSize: 26 }}>
                  {energyStats.lampTypeStats.find(t => t.type === 'LED')?.percent || 0}%
                </div>
                <div className="stat-trend">LED灯具占比持续提升</div>
              </div>
              <BulbOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
      </Row>

      {uploadError && (
        <Alert
          message="Excel解析错误"
          description={uploadError}
          type="error"
          showIcon
          closable
          onClose={() => setUploadError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {parsedSchedule.length > 0 && (
        <Alert
          message="识别成功"
          description={
            <div>
              <p>已从Excel中识别以下调光时段：</p>
              <Space wrap>
                {parsedSchedule.map((s, i) => (
                  <Tag key={i} color="green">
                    {s.timeRange}
                    {s.season && ` (${s.season})`}
                    : {String(s.startHour).padStart(2, '0')}:00-{String(s.endHour).padStart(2, '0')}:00 @ {s.brightness}%
                  </Tag>
                ))}
              </Space>
            </div>
          }
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title={`${levelText}90天能耗预测分析`}
            className="chart-card"
            extra={
              <Space>
                <Button type="primary" size="small" onClick={() => setPredictVisible(true)}>
                  <ExperimentOutlined /> 预测模拟
                </Button>
              </Space>
            }
          >
            <ReactECharts option={predictionOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="调光时段配置"
            className="chart-card"
            extra={<Tag color="blue">共 {dimmingSchedule.length} 个时段</Tag>}
          >
            <ReactECharts option={dimmingVisualOption} style={{ height: 200 }} />
            <div style={{ marginTop: 12 }}>
              <List
                size="small"
                dataSource={dimmingSchedule}
                renderItem={(item) => (
                  <List.Item>
                    <Space wrap>
                      <Tag color="orange">{item.timeRange}</Tag>
                      {item.season && <Tag color="purple">{item.season}</Tag>}
                      <span style={{ fontSize: 12, color: '#666' }}>
                        {String(item.startHour).padStart(2, '0')}:00 - {String(item.endHour).padStart(2, '0')}:00
                      </span>
                      <span style={{ fontSize: 12 }}>亮度 <b>{item.brightness}%</b></span>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="节能率趋势" className="chart-card">
            <ReactECharts option={savingTrendOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="推荐节能方案" className="chart-card">
            <List
              dataSource={recommendationPlans}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: item.recommended ? '#e6f7ff' : '#f5f5f5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: item.recommended ? '#1677ff' : '#999',
                      fontSize: 20
                    }}>
                      <BulbOutlined />
                    </div>}
                    title={
                      <Space>
                        <span>{item.name}</span>
                        {item.recommended && <Tag color="blue">推荐</Tag>}
                      </Space>
                    }
                    description={
                      <div>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{item.desc}</div>
                        <Space size={16}>
                          <span style={{ fontSize: 11, color: '#52c41a' }}>
                            <ThunderboltOutlined /> 预计节能 {item.savingRate}
                          </span>
                          <span style={{ fontSize: 11, color: '#999' }}>
                            投资: ¥{item.investment.toLocaleString()}
                          </span>
                          <span style={{ fontSize: 11, color: '#faad14' }}>
                            回收期: {item.payback}
                          </span>
                        </Space>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={`${levelText}年度节能计划管理`}
        className="chart-card"
        extra={
          <Upload
            accept=".xlsx,.xls"
            beforeUpload={beforeUpload}
            showUploadList={false}
          >
            <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
              上传年度节能计划Excel
            </Button>
          </Upload>
        }
      >
        <div style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 8, fontSize: 12 }}>
          <InfoCircleOutlined style={{ color: '#1677ff', marginRight: 4 }} />
          <b>Excel格式要求：</b>包含「开始时间/结束时间/亮度」等列，支持HH:MM或0-23小时格式。
          可选列：「时段/季节/目标节能率」。
        </div>
        <Table
          columns={planColumns}
          dataSource={filteredEnergyPlans}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          size="middle"
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="能耗预测模拟"
        open={predictVisible}
        onCancel={() => setPredictVisible(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setPredictVisible(false)}>取消</Button>,
          <Button key="apply" type="primary" onClick={() => {
            message.success('调光方案已应用')
            setPredictVisible(false)
          }}>应用方案</Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">调整调光亮度，预测节能效果</Text>
        </div>
        {dimmingSchedule.map((sched, idx) => (
          <div key={idx} style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 4 }} wrap>
              <Tag color="orange">{sched.timeRange}</Tag>
              {sched.season && <Tag color="purple">{sched.season}</Tag>}
              <span style={{ fontSize: 12, color: '#666' }}>
                {String(sched.startHour).padStart(2, '0')}:00 - {String(sched.endHour).padStart(2, '0')}:00
              </span>
            </Space>
            <Slider
              min={30}
              max={100}
              value={sched.brightness}
              onChange={(v) => {
                setDimmingSchedule(prev => prev.map((d, i) =>
                  i === idx ? { ...d, brightness: v } : d
                ))
              }}
              tooltip={{ formatter: v => `${v}%` }}
            />
          </div>
        ))}
        <ReactECharts option={dimmingVisualOption} style={{ height: 200 }} />
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>预计节能率</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>
                {dimmingSchedule.reduce((acc, s) => {
                  const hours = s.startHour < s.endHour
                    ? s.endHour - s.startHour
                    : (24 - s.startHour) + s.endHour
                  return acc + (s.brightness / 100) * (hours / 24)
                }, 0) * 30 + 5}%
              </div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 12, background: '#e6f7ff', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>年节电量</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1677ff' }}>
                {Math.floor(980 * (dimmingSchedule.reduce((acc, s) => {
                  const hours = s.startHour < s.endHour
                    ? s.endHour - s.startHour
                    : (24 - s.startHour) + s.endHour
                  return acc + (s.brightness / 100) * (hours / 24)
                }, 0)))}万kWh
              </div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 12, background: '#fff7e6', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>节省费用</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#faad14' }}>
                ¥{Math.floor(784 * (dimmingSchedule.reduce((acc, s) => {
                  const hours = s.startHour < s.endHour
                    ? s.endHour - s.startHour
                    : (24 - s.startHour) + s.endHour
                  return acc + (s.brightness / 100) * (hours / 24)
                }, 0)))}万
              </div>
            </div>
          </Col>
        </Row>
      </Modal>
    </>
  )

  const renderTraceTab = () => (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Breadcrumb
            items={[
              {
                title: (
                  <span onClick={() => onBreadcrumbClick('province')} style={{ cursor: drillState.level !== 'province' ? 'pointer' : 'default', color: drillState.level === 'province' ? '#1677ff' : undefined }}>
                    <HomeOutlined /> {drillState.province}
                  </span>
                )
              },
              ...(drillState.level !== 'province' ? [{
                title: (
                  <span onClick={() => onBreadcrumbClick('city')} style={{ cursor: drillState.level !== 'city' ? 'pointer' : 'default', color: drillState.level === 'city' ? '#1677ff' : undefined }}>
                    <EnvironmentOutlined /> {drillState.city}
                  </span>
                )
              }] : []),
              ...(drillState.level === 'road' ? [{
                title: <span style={{ color: '#1677ff' }}><DashboardOutlined /> {drillState.road}</span>
              }] : [])
            ]}
          />
          <Space wrap>
            <Select
              style={{ width: 140 }}
              value={drillState.province}
              onChange={(v) => {
                setSelectedAnomalyDate(null)
                const cities = provinces.find(p => p.name === v)?.cities || []
                setDrillState({
                  level: 'province',
                  province: v,
                  city: cities[0]?.name || drillState.city,
                  district: drillState.district,
                  road: drillState.road
                })
              }}
            >
              {availableProvinces.map(p => (
                <Select.Option key={p} value={p}>{p}</Select.Option>
              ))}
            </Select>
            {drillState.level !== 'province' && (
              <Select
                style={{ width: 140 }}
                value={drillState.city}
                onChange={(v) => {
                  setSelectedAnomalyDate(null)
                  setDrillState(prev => ({ ...prev, level: 'city', city: v }))
                }}
              >
                {availableCities.map(c => (
                  <Select.Option key={c} value={c}>{c}</Select.Option>
                ))}
              </Select>
            )}
            {drillState.level === 'road' && (
              <Select
                style={{ width: 160 }}
                value={drillState.road}
                onChange={(v) => {
                  setSelectedAnomalyDate(null)
                  setDrillState(prev => ({ ...prev, road: v }))
                }}
              >
                {availableRoads.map(r => (
                  <Select.Option key={r} value={r}>{r}</Select.Option>
                ))}
              </Select>
            )}
          </Space>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {drillState.level === 'province' && availableCities.slice(0, 8).map(c => (
            <Tag
              key={c}
              color="blue"
              style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
              onClick={() => {
                setSelectedAnomalyDate(null)
                setDrillState(prev => ({ ...prev, level: 'city', city: c }))
              }}
            >
              <EnvironmentOutlined /> {c} →
            </Tag>
          ))}
          {drillState.level === 'city' && availableRoads.slice(0, 8).map(r => (
            <Tag
              key={r}
              color="geekblue"
              style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
              onClick={() => {
                setSelectedAnomalyDate(null)
                setDrillState(prev => ({ ...prev, level: 'road', road: r }))
              }}
            >
              <DashboardOutlined /> {r} →
            </Tag>
          ))}
        </div>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="stat-card blue">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">实际能耗总量</div>
                <div className="stat-value" style={{ fontSize: 24 }}>
                  {(traceKPI.actualTotal / 10000).toFixed(1)}万
                </div>
                <div className="stat-trend">kWh · 近30天</div>
              </div>
              <ThunderboltOutlined style={{ fontSize: 36, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card orange">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">基准能耗总量</div>
                <div className="stat-value" style={{ fontSize: 24 }}>
                  {(traceKPI.baselineTotal / 10000).toFixed(1)}万
                </div>
                <div className="stat-trend">kWh · 近30天</div>
              </div>
              <DashboardOutlined style={{ fontSize: 36, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card" style={{ background: traceKPI.deviationRate > 5 ? '#fff2f0' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">异常偏差率</div>
                <div className="stat-value" style={{ fontSize: 24, color: traceKPI.deviationRate > 5 ? '#ff4d4f' : undefined }}>
                  {traceKPI.deviationRate > 0 ? '+' : ''}{traceKPI.deviationRate}%
                </div>
                <div className="stat-trend">
                  {traceKPI.deviationRate > 15 ? <Tag color="red">严重</Tag> : traceKPI.deviationRate > 5 ? <Tag color="orange">偏高</Tag> : <Tag color="green">正常</Tag>}
                </div>
              </div>
              <RiseOutlined style={{ fontSize: 36, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card green">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">异常点位数量</div>
                <div className="stat-value" style={{ fontSize: 24 }}>
                  {traceKPI.anomalyCount}
                </div>
                <div className="stat-trend">个 · 偏差＞15%的点</div>
              </div>
              <AlertOutlined style={{ fontSize: 36, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
      </Row>

      <Card
        title="实际 vs 基准能耗对比（近30天）"
        className="chart-card"
        extra={
          <Space>
            {selectedAnomalyDate && (
              <Button size="small" onClick={() => setSelectedAnomalyDate(null)}>
                清除筛选 ({selectedAnomalyDate})
              </Button>
            )}
            <Tag color="red">红色圆点 = 偏差＞15% 异常点，可点击筛选</Tag>
          </Space>
        }
      >
        <ReactECharts
          option={compareChartOption}
          style={{ height: 340 }}
          onEvents={{ click: handleCompareChartClick }}
        />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16, marginBottom: 16 }}>
        <Col xs={24} md={12} lg={6}>
          <Card title="天气/季节影响" className="chart-card" size="small">
            <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#666' }}><CloudOutlined /> 当前季节</span>
                <Tag color="cyan">{currentSeason.name}</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#666' }}>平均气温</span>
                <b>{currentSeason.temp}°C</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#666' }}>月降雨天数</span>
                <b>{currentSeason.rain}天</b>
              </div>
            </Space>
            <ReactECharts option={weatherCardOption} style={{ height: 160 }} />
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card title="灯具类型占比" className="chart-card" size="small">
            <ReactECharts option={lampTypePieOption} style={{ height: 240 }} />
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card title="近期故障统计" className="chart-card" size="small">
            <ReactECharts option={faultBarOption} style={{ height: 240 }} />
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card title="调光方案变更" className="chart-card" size="small" extra={<Tag color="purple">最近5次</Tag>}>
            <List
              size="small"
              dataSource={dimmingChangeTimeline}
              renderItem={(item) => (
                <List.Item style={{ padding: '8px 0', borderBottom: '1px dashed #f0f0f0' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <b style={{ fontSize: 12 }}>{item.name}</b>
                      <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>{item.operator}</Tag>
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>{item.desc}</div>
                    <div style={{ fontSize: 10, color: '#999' }}>{item.time}</div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <span>异常点明细表格</span>
            {selectedAnomalyDate && (
              <Tag color="blue">已筛选: {selectedAnomalyDate}</Tag>
            )}
            <Tag color="red">共 {filteredAnomalyRecords.length} 条异常</Tag>
          </Space>
        }
        className="chart-card"
        extra={
          <Space>
            {selectedAnomalyDate && (
              <Button size="small" onClick={() => setSelectedAnomalyDate(null)}>
                清除筛选
              </Button>
            )}
            <Button size="small" icon={<FileExcelOutlined />}>
              导出异常明细
            </Button>
          </Space>
        }
      >
        <Table
          columns={anomalyTableColumns}
          dataSource={filteredAnomalyRecords}
          rowKey={(record: AnomalyRecord) => `${record.date}-${record.road}`}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          size="middle"
          scroll={{ x: 900 }}
          locale={{ emptyText: '当前范围暂无异常数据' }}
        />
      </Card>
    </>
  )

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <DashboardOutlined /> 节能概览
        </span>
      ),
      children: renderOverviewTab()
    },
    {
      key: 'trace',
      label: (
        <span>
          <AlertOutlined /> 能耗异常溯源
        </span>
      ),
      children: renderTraceTab()
    }
  ]

  return (
    <div className="page-container">
      <Tabs
        defaultActiveKey="overview"
        items={tabItems}
        size="large"
        style={{ marginBottom: 0 }}
      />
    </div>
  )
}