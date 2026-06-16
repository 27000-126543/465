import { useState, useMemo, useCallback } from 'react'
import { Row, Col, Select, Space, Card, Tag, Modal, Tabs, Progress, Tooltip, Button, Table, Descriptions } from 'antd'
import { ArrowUpOutlined, FallOutlined, RiseOutlined, BulbOutlined, ThunderboltOutlined, AlertOutlined, LeftOutlined, HomeOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '@/store/dataStore'
import { faultTypeDistribution, lampTypeDistribution } from '@/data/mockData'
import type { LampType, City, Province, StreetLamp, EnergyConsumption } from '@/types'
import dayjs from 'dayjs'

interface DrillDownState {
  level: 'national' | 'province' | 'city' | 'road'
  provinceName?: string
  cityName?: string
  roadName?: string
  districtName?: string
}

interface RoadStats {
  name: string
  district: string
  totalLamps: number
  lightRate: number
  faultRate: number
  energyConsumption: number
  savingRate: number
  lampTypeBreakdown: Record<LampType, number>
}

export default function Dashboard() {
  const {
    currentUser,
    filteredProvinces,
    filteredLamps,
    filteredEnergyData,
    selectedLampType,
    setSelectedLampType,
    getFilteredStats
  } = useDataStore()

  const [drillDown, setDrillDown] = useState<DrillDownState>({ level: 'national' })
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  // 根据下钻级别过滤数据
  const scopeData = useMemo(() => {
    let lamps = filteredLamps
    let energy = filteredEnergyData
    let provinces = filteredProvinces
    let scopeName = ''

    // 先处理权限过滤后的基础范围
    if (currentUser?.level === 'provincial') {
      scopeName = currentUser.province || ''
      if (drillDown.level === 'national') {
        drillDown.level = 'province'
        drillDown.provinceName = currentUser.province
      }
    } else if (currentUser?.level === 'municipal') {
      scopeName = `${currentUser.province} ${currentUser.city}`
      if (drillDown.level === 'national' || drillDown.level === 'province') {
        drillDown.level = 'city'
        drillDown.provinceName = currentUser.province
        drillDown.cityName = currentUser.city
      }
    }

    // 再处理下钻过滤
    if (drillDown.level === 'province' && drillDown.provinceName) {
      lamps = lamps.filter(l => l.province === drillDown.provinceName)
      energy = energy.filter(e => e.province === drillDown.provinceName)
      provinces = provinces.filter(p => p.name === drillDown.provinceName)
      scopeName = drillDown.provinceName
    } else if (drillDown.level === 'city' && drillDown.provinceName && drillDown.cityName) {
      lamps = lamps.filter(l => l.province === drillDown.provinceName && l.city === drillDown.cityName)
      energy = energy.filter(e => e.province === drillDown.provinceName && e.city === drillDown.cityName)
      provinces = provinces.filter(p => p.name === drillDown.provinceName).map(p => ({
        ...p,
        cities: p.cities.filter(c => c.name === drillDown.cityName)
      }))
      scopeName = `${drillDown.provinceName} ${drillDown.cityName}`
    } else if (drillDown.level === 'road' && drillDown.provinceName && drillDown.cityName && drillDown.roadName) {
      lamps = lamps.filter(l => 
        l.province === drillDown.provinceName && 
        l.city === drillDown.cityName && 
        l.road === drillDown.roadName
      )
      energy = energy.filter(e => 
        e.province === drillDown.provinceName && 
        e.city === drillDown.cityName
      )
      provinces = provinces.filter(p => p.name === drillDown.provinceName).map(p => ({
        ...p,
        cities: p.cities.filter(c => c.name === drillDown.cityName)
      }))
      scopeName = `${drillDown.provinceName} ${drillDown.cityName} ${drillDown.roadName}`
    } else if (drillDown.level === 'national') {
      scopeName = '全国'
    }

    return { lamps, energy, provinces, scopeName }
  }, [filteredLamps, filteredEnergyData, filteredProvinces, drillDown, currentUser])

  // 计算当前范围的统计数据（考虑灯具类型筛选）
  const scopeStats = useMemo(() => {
    const { lamps, energy, provinces } = scopeData
    
    // 如果有灯具类型筛选，先过滤
    const filteredLampsByType = selectedLampType === 'all' 
      ? lamps 
      : lamps.filter(l => l.type === selectedLampType)

    let totalLamps = 0
    let avgLightRate = 0
    let avgFaultRate = 0
    let avgSavingRate = 0
    let totalEnergy = 0

    if (provinces.length > 0 && selectedLampType === 'all') {
      // 用省份城市的统计数据
      let cityCount = 0
      let totalLampCount = 0
      let totalLight = 0
      let totalFault = 0
      let totalSaving = 0

      provinces.forEach(p => {
        p.cities.forEach(c => {
          totalLampCount += c.totalLamps
          totalLight += c.lightRate
          totalFault += c.faultRate
          totalSaving += c.energySavingRate
          cityCount++
        })
      })

      if (cityCount > 0) {
        totalLamps = totalLampCount
        avgLightRate = Number((totalLight / cityCount).toFixed(2))
        avgFaultRate = Number((totalFault / cityCount).toFixed(2))
        avgSavingRate = Number((totalSaving / cityCount).toFixed(2))
      }
    } 
    
    // 如果有灯具类型筛选，或者没有省份数据，用路灯明细计算
    if (selectedLampType !== 'all' || provinces.length === 0) {
      totalLamps = filteredLampsByType.length
      if (totalLamps > 0) {
        const normalCount = filteredLampsByType.filter(l => l.status === 'normal').length
        const faultCount = filteredLampsByType.filter(l => l.status === 'fault').length
        avgLightRate = Number(((normalCount / totalLamps) * 100).toFixed(2))
        avgFaultRate = Number(((faultCount / totalLamps) * 100).toFixed(2))
      }
      // 节能率用能耗数据计算
      if (energy.length > 0) {
        const last30 = energy.slice(-30)
        const totalBaseline = last30.reduce((s, e) => s + e.baselineConsumption, 0)
        const totalActual = last30.reduce((s, e) => s + e.actualConsumption, 0)
        if (totalBaseline > 0) {
          avgSavingRate = Number((((totalBaseline - totalActual) / totalBaseline) * 100).toFixed(2))
        }
      }
    }

    // 总能耗
    if (energy.length > 0) {
      totalEnergy = energy.slice(-30).reduce((s, e) => s + e.actualConsumption, 0)
    }

    return {
      totalLamps,
      avgLightRate,
      avgFaultRate,
      avgSavingRate,
      totalEnergy,
      lampCount: filteredLampsByType.length
    }
  }, [scopeData, selectedLampType])

  // 省份统计（用于热力图和柱状图）
  const provinceStats = useMemo(() => {
    const { provinces } = scopeData
    return provinces.map(p => {
      // 如果有灯具类型筛选，需要重新计算
      let avgLight = 0
      let avgSaving = 0
      let avgFault = 0
      let totalLamps = 0

      if (selectedLampType === 'all') {
        avgLight = p.cities.reduce((s, c) => s + c.lightRate, 0) / p.cities.length
        avgSaving = p.cities.reduce((s, c) => s + c.energySavingRate, 0) / p.cities.length
        avgFault = p.cities.reduce((s, c) => s + c.faultRate, 0) / p.cities.length
        totalLamps = p.cities.reduce((s, c) => s + c.totalLamps, 0)
      } else {
        // 按类型筛选后重新计算
        const typeLamps = scopeData.lamps.filter(l => l.province === p.name && l.type === selectedLampType)
        totalLamps = typeLamps.length
        if (totalLamps > 0) {
          const normal = typeLamps.filter(l => l.status === 'normal').length
          const fault = typeLamps.filter(l => l.status === 'fault').length
          avgLight = (normal / totalLamps) * 100
          avgFault = (fault / totalLamps) * 100
          avgSaving = 25 // 默认值
        }
      }

      return {
        name: p.name,
        code: p.code,
        lightRate: Number(avgLight.toFixed(2)),
        savingRate: Number(avgSaving.toFixed(2)),
        faultRate: Number(avgFault.toFixed(2)),
        totalLamps,
        cities: p.cities.filter(c => {
          if (selectedLampType === 'all') return true
          const cityLamps = scopeData.lamps.filter(l => l.province === p.name && l.city === c.name && l.type === selectedLampType)
          return cityLamps.length > 0
        })
      }
    }).filter(p => p.totalLamps > 0).sort((a, b) => b.savingRate - a.savingRate)
  }, [scopeData, selectedLampType])

  const cityStats = useMemo(() => {
    if (drillDown.level !== 'province' && drillDown.level !== 'city' && drillDown.level !== 'road') return []
    const currentProvince = provinceStats.find(p => p.name === drillDown.provinceName)
    if (!currentProvince) return []
    return currentProvince.cities.map(c => {
      let totalLamps = c.totalLamps
      let lightRate = c.lightRate
      let savingRate = c.energySavingRate
      let faultRate = c.faultRate
      if (selectedLampType !== 'all') {
        const cityLamps = scopeData.lamps.filter(l => l.province === drillDown.provinceName && l.city === c.name && l.type === selectedLampType)
        totalLamps = cityLamps.length
        if (totalLamps > 0) {
          lightRate = Number(((cityLamps.filter(l => l.status === 'normal').length / totalLamps) * 100).toFixed(2))
          faultRate = Number(((cityLamps.filter(l => l.status === 'fault').length / totalLamps) * 100).toFixed(2))
          savingRate = 25
        }
      }
      return { name: c.name, totalLamps, lightRate, savingRate, faultRate }
    }).filter(c => c.totalLamps > 0).sort((a, b) => b.savingRate - a.savingRate)
  }, [provinceStats, drillDown.provinceName, drillDown.level, selectedLampType, scopeData.lamps])

  // 路段级统计数据
  const roadStats = useMemo((): RoadStats[] => {
    const { lamps, energy } = scopeData
    if (drillDown.level !== 'city' && drillDown.level !== 'road') return []

    const roadGroups = new Map<string, StreetLamp[]>()
    lamps.forEach(lamp => {
      const key = `${lamp.district}-${lamp.road}`
      if (!roadGroups.has(key)) roadGroups.set(key, [])
      roadGroups.get(key)!.push(lamp)
    })

    const roads: RoadStats[] = []
    roadGroups.forEach((roadLamps, key) => {
      const [district, road] = key.split('-')
      const total = roadLamps.length
      const normal = roadLamps.filter(l => l.status === 'normal').length
      const fault = roadLamps.filter(l => l.status === 'fault').length

      const typeBreakdown: Record<LampType, number> = {
        'LED': 0,
        '高压钠灯': 0,
        '金卤灯': 0,
        '无极灯': 0
      }
      roadLamps.forEach(l => {
        typeBreakdown[l.type]++
      })

      // 找这个路段的能耗数据
      const roadEnergy = energy.filter(e => e.road === road || e.district === district)
      let totalConsumption = 0
      let savingRate = 25
      if (roadEnergy.length > 0) {
        const last7 = roadEnergy.slice(-7)
        totalConsumption = last7.reduce((s, e) => s + e.actualConsumption, 0)
        const totalBaseline = last7.reduce((s, e) => s + e.baselineConsumption, 0)
        if (totalBaseline > 0) {
          savingRate = Number((((totalBaseline - totalConsumption) / totalBaseline) * 100).toFixed(1))
        }
      }

      roads.push({
        name: road,
        district,
        totalLamps: total,
        lightRate: Number(((normal / total) * 100).toFixed(1)),
        faultRate: Number(((fault / total) * 100).toFixed(1)),
        energyConsumption: totalConsumption,
        savingRate,
        lampTypeBreakdown: typeBreakdown
      })
    })

    return roads.sort((a, b) => b.totalLamps - a.totalLamps)
  }, [scopeData, drillDown.level])

  // 灯具类型分布（根据当前范围动态计算）
  const currentLampTypeDist = useMemo(() => {
    const { lamps } = scopeData
    const typeCounts: Record<string, number> = {
      'LED': 0,
      '高压钠灯': 0,
      '金卤灯': 0,
      '无极灯': 0
    }
    lamps.forEach(l => typeCounts[l.type]++)
    const total = lamps.length
    return Object.entries(typeCounts)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        count,
        percent: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
      }))
  }, [scopeData])

  // 热力图数据
  const heatmapData = useMemo(() => {
    return provinceStats.map(p => ({
      name: p.name,
      value: p.savingRate,
      lightRate: p.lightRate,
      faultRate: p.faultRate,
      totalLamps: p.totalLamps
    }))
  }, [provinceStats])

  // 热力图配置
  const heatmapOption = useMemo(() => {
    const data = heatmapData
    if (data.length === 0) {
      return {
        title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
      }
    }
    const maxVal = Math.max(...data.map(d => d.value))
    const minVal = Math.min(...data.map(d => d.value))
    
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const d = data.find(x => x.name === params.name) || params.data
          return `
            <div style="padding: 8px">
              <div style="font-weight: 600; margin-bottom: 4px">${params.name}</div>
              <div>💡 节能率: <b style="color:#1677ff">${d?.value || params.value}%</b></div>
              <div>🔆 亮灯率: <b>${d?.lightRate || '-'}%</b></div>
              <div>⚠️ 故障率: <b style="color:#ff4d4f">${d?.faultRate || '-'}%</b></div>
              <div>🏙️ 路灯总数: <b>${(d?.totalLamps || 0).toLocaleString()}</b>盏</div>
              <div style="margin-top: 6px; color:#1677ff; font-size:12px">点击查看详情 →</div>
            </div>
          `
        }
      },
      grid: { left: 40, right: 40, top: 60, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.map((_, i) => i),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false }
      },
      yAxis: {
        type: 'category',
        data: [''],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false }
      },
      visualMap: {
        min: minVal - 2,
        max: maxVal + 2,
        orient: 'horizontal',
        left: 'center',
        bottom: 5,
        text: ['节能率高', '节能率低'],
        textStyle: { fontSize: 11 },
        inRange: {
          color: ['#fff2e8', '#ffd591', '#ffa940', '#52c41a', '#389e0d']
        },
        calculable: true
      },
      series: [{
        type: 'heatmap',
        data: data.map((d, i) => [i, 0, d.value]),
        label: {
          show: true,
          formatter: (params: any) => {
            const d = data[params.data[0]]
            return `${d.name.replace(/省|市/g, '')}\n${d.value}%`
          },
          fontSize: 10,
          color: '#000',
          fontWeight: 500,
          lineHeight: 14
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 3,
          borderRadius: 6
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.3)',
            borderColor: '#1677ff',
            borderWidth: 2
          }
        }
      }]
    }
  }, [heatmapData])

  // 柱状图配置 - 根据下钻级别显示不同层级
  const barChartOption = useMemo(() => {
    let data: { name: string; lightRate: number; savingRate: number; faultRate: number }[] = []
    
    if (drillDown.level === 'national') {
      data = provinceStats.slice(0, 12)
    } else if (drillDown.level === 'province') {
      data = cityStats.slice(0, 12)
    } else if (drillDown.level === 'city' || drillDown.level === 'road') {
      data = roadStats.slice(0, 12).map(r => ({
        name: r.name,
        lightRate: r.lightRate,
        savingRate: r.savingRate,
        faultRate: r.faultRate
      }))
    }
    
    if (data.length === 0) {
      return {
        title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
      }
    }
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['亮灯率(%)', '节能率(%)', '故障率(%)'], top: 0 },
      grid: { left: 50, right: 30, top: 40, bottom: 60 },
      xAxis: {
        type: 'category',
        data: data.map(d => d.name.length > 6 ? d.name.slice(0, 6) + '...' : d.name),
        axisLabel: { rotate: 30, fontSize: 11 }
      },
      yAxis: { type: 'value', name: '百分比(%)', max: 100 },
      series: [
        { name: '亮灯率(%)', type: 'bar', data: data.map(d => d.lightRate), itemStyle: { color: '#52c41a' }, barWidth: 12 },
        { name: '节能率(%)', type: 'bar', data: data.map(d => d.savingRate), itemStyle: { color: '#1677ff' }, barWidth: 12 },
        { name: '故障率(%)', type: 'bar', data: data.map(d => d.faultRate), itemStyle: { color: '#ff4d4f' }, barWidth: 12 }
      ]
    }
  }, [provinceStats, cityStats, roadStats, drillDown.level])

  // 故障率排名
  const rankingOption = useMemo(() => {
    const { provinces } = scopeData
    let items: { name: string; faultRate: number; totalLamps: number; lightRate: number }[] = []

    if (drillDown.level === 'national' || drillDown.level === 'province') {
      // 城市排名
      items = provinces.flatMap(p =>
        p.cities.map(c => ({
          name: `${p.name}-${c.name}`,
          faultRate: c.faultRate,
          totalLamps: c.totalLamps,
          lightRate: c.lightRate
        }))
      )
    } else if (drillDown.level === 'city') {
      // 路段排名
      items = roadStats.map(r => ({
        name: r.name,
        faultRate: r.faultRate,
        totalLamps: r.totalLamps,
        lightRate: r.lightRate
      }))
    }

    const sorted = items.sort((a, b) => b.faultRate - a.faultRate).slice(0, 10)
    if (sorted.length === 0) {
      return {
        title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
      }
    }

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 120, right: 40, top: 20, bottom: 20 },
      xAxis: { type: 'value', name: '故障率(%)' },
      yAxis: {
        type: 'category',
        data: sorted.map(c => c.name).reverse(),
        axisLabel: { fontSize: 11 }
      },
      series: [{
        type: 'bar',
        data: sorted.map(c => c.faultRate).reverse(),
        itemStyle: {
          color: (params: any) => {
            const rate = params.data
            if (rate > 4) return '#ef5350'
            if (rate > 2.5) return '#ff9800'
            return '#66bb6a'
          },
          borderRadius: [0, 4, 4, 0]
        },
        label: { show: true, position: 'right', formatter: '{c}%' },
        barWidth: 16
      }]
    }
  }, [scopeData, drillDown.level, roadStats])

  // 能耗趋势
  const energyTrendOption = useMemo(() => {
    const { energy } = scopeData
    const last30 = energy.slice(-30)
    if (last30.length === 0) {
      return {
        tooltip: { trigger: 'axis' },
        title: { text: '暂无能耗数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
      }
    }

    // 按日期聚合
    const dateMap = new Map<string, { actual: number; baseline: number; saving: number }>()
    last30.forEach(e => {
      const existing = dateMap.get(e.date) || { actual: 0, baseline: 0, saving: 0 }
      existing.actual += e.actualConsumption
      existing.baseline += e.baselineConsumption
      existing.saving += e.savingAmount
      dateMap.set(e.date, existing)
    })

    const sortedDates = Array.from(dateMap.keys()).sort()
    const actualData = sortedDates.map(d => dateMap.get(d)!.actual)
    const baselineData = sortedDates.map(d => dateMap.get(d)!.baseline)
    const savingData = sortedDates.map(d => dateMap.get(d)!.saving)

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['实际能耗', '基准能耗', '节能量'], right: 10, top: 0 },
      grid: { left: 60, right: 40, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: sortedDates.map(d => dayjs(d).format('MM-DD')),
        axisLabel: { fontSize: 10 }
      },
      yAxis: { type: 'value', name: 'kWh' },
      series: [
        {
          name: '实际能耗',
          type: 'line',
          data: actualData,
          smooth: true,
          itemStyle: { color: '#1677ff' },
          areaStyle: { opacity: 0.1 }
        },
        {
          name: '基准能耗',
          type: 'line',
          data: baselineData,
          smooth: true,
          lineStyle: { type: 'dashed' },
          itemStyle: { color: '#999' }
        },
        {
          name: '节能量',
          type: 'bar',
          data: savingData,
          itemStyle: { color: '#52c41a', opacity: 0.6 },
          barWidth: 6
        }
      ]
    }
  }, [scopeData])

  // 路灯类型饼图
  const pieOption = useMemo(() => {
    const filteredTypes = currentLampTypeDist
    if (filteredTypes.length === 0) {
      return {
        title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
      }
    }
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c}盏 ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        data: filteredTypes.map(d => ({ name: d.type, value: d.count })),
        color: ['#1677ff', '#52c41a', '#faad14', '#722ed1']
      }]
    }
  }, [currentLampTypeDist])

  // 故障类型饼图
  const faultPieOption = useMemo(() => {
    const { lamps } = scopeData
    const faultLamps = lamps.filter(l => l.status === 'fault')
    if (faultLamps.length === 0) {
      return {
        title: { text: '暂无故障数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
      }
    }

    const typeCounts: Record<string, number> = {}
    faultLamps.forEach(l => {
      const type = l.faultType || '未知'
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })

    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c}起 ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        data: Object.entries(typeCounts).map(([name, value]) => ({ name, value })),
        color: ['#ff4d4f', '#faad14', '#1677ff', '#52c41a', '#722ed1', '#13c2c2']
      }]
    }
  }, [scopeData])

  // 路段能耗趋势
  const roadEnergyOption = useMemo(() => {
    if (roadStats.length === 0) return {}
    const topRoads = roadStats.slice(0, 4)
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: topRoads.map(r => r.name), top: 0, type: 'scroll' },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 7 }, (_, i) => dayjs().subtract(6 - i, 'day').format('MM-DD'))
      },
      yAxis: { type: 'value', name: 'kWh' },
      series: topRoads.map((road, idx) => ({
        name: road.name,
        type: 'line',
        smooth: true,
        data: Array.from({ length: 7 }, () => Math.floor(road.energyConsumption / 7 * (0.8 + Math.random() * 0.4)))
      }))
    }
  }, [roadStats])

  // 面包屑导航
  const breadcrumbs = useMemo(() => {
    const items: { label: string; onClick?: () => void }[] = []
    if (currentUser?.level !== 'provincial' && currentUser?.level !== 'municipal') {
      items.push({ label: '全国', onClick: () => setDrillDown({ level: 'national' }) })
    }
    if (drillDown.provinceName) {
      items.push({ 
        label: drillDown.provinceName, 
        onClick: () => currentUser?.level !== 'provincial' && currentUser?.level !== 'municipal' 
          ? setDrillDown({ level: 'province', provinceName: drillDown.provinceName }) 
          : undefined 
      })
    }
    if (drillDown.cityName) {
      items.push({ 
        label: drillDown.cityName, 
        onClick: () => currentUser?.level !== 'municipal'
          ? setDrillDown({ level: 'city', provinceName: drillDown.provinceName, cityName: drillDown.cityName })
          : undefined
      })
    }
    if (drillDown.roadName) {
      items.push({ label: drillDown.roadName })
    }
    return items
  }, [drillDown, currentUser])

  // 点击热力图省份
  const handleHeatmapClick = (params: any) => {
    if (params.componentType === 'series') {
      const provinceName = heatmapData[params.data[0]]?.name
      if (provinceName) {
        setDrillDown({ level: 'province', provinceName })
      }
    }
  }

  // 点击城市
  const handleCityClick = useCallback((city: City, provinceName: string) => {
    setDrillDown({ level: 'city', provinceName, cityName: city.name })
  }, [])

  // 点击路段
  const handleRoadClick = useCallback((road: RoadStats) => {
    setDrillDown({ 
      level: 'road', 
      provinceName: drillDown.provinceName, 
      cityName: drillDown.cityName,
      roadName: road.name,
      districtName: road.district
    })
    setDetailModalVisible(true)
  }, [drillDown.provinceName, drillDown.cityName])

  // 路段明细表头
  const roadColumns = [
    {
      title: '路段',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: RoadStats) => (
        <a onClick={() => handleRoadClick(record)}>{text}</a>
      )
    },
    { title: '所在区域', dataIndex: 'district', key: 'district' },
    { 
      title: '路灯总数', 
      dataIndex: 'totalLamps', 
      key: 'totalLamps', 
      render: (v: number) => v.toLocaleString() 
    },
    {
      title: '灯具类型分布',
      key: 'typeBreakdown',
      render: (_: any, record: RoadStats) => (
        <Space size={4} wrap>
          {Object.entries(record.lampTypeBreakdown)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => (
              <Tag key={type}>{type}: {count}</Tag>
            ))}
        </Space>
      )
    },
    {
      title: '亮灯率',
      dataIndex: 'lightRate',
      key: 'lightRate',
      render: (v: number) => (
        <Tag color={v >= 97 ? 'green' : v >= 95 ? 'orange' : 'red'}>{v}%</Tag>
      )
    },
    {
      title: '故障率',
      dataIndex: 'faultRate',
      key: 'faultRate',
      render: (v: number) => (
        <span style={{ color: v > 3 ? '#ff4d4f' : '#666' }}>{v}%</span>
      )
    },
    {
      title: '近7天能耗',
      dataIndex: 'energyConsumption',
      key: 'energyConsumption',
      render: (v: number) => `${(v / 1000).toFixed(1)}k kWh`
    },
    {
      title: '节能率',
      dataIndex: 'savingRate',
      key: 'savingRate',
      render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 500 }}>{v}%</span>
    }
  ]

  // 城市明细表头（下钻到省时显示）
  const cityColumns = [
    { title: '城市', dataIndex: 'name', key: 'name', render: (text: string, record: City) => <a onClick={() => handleCityClick(record, drillDown.provinceName!)}>{text}</a> },
    { title: '路灯数', dataIndex: 'totalLamps', key: 'totalLamps', render: (v: number) => v.toLocaleString() },
    {
      title: '亮灯率',
      dataIndex: 'lightRate',
      key: 'lightRate',
      render: (v: number) => <Tag color={v >= 97 ? 'green' : v >= 95 ? 'orange' : 'red'}>{v}%</Tag>
    },
    {
      title: '节能率',
      dataIndex: 'energySavingRate',
      key: 'energySavingRate',
      render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 500 }}>{v}%</span>
    },
    {
      title: '故障率',
      dataIndex: 'faultRate',
      key: 'faultRate',
      render: (v: number) => <span style={{ color: v > 3 ? '#ff4d4f' : '#666' }}>{v}%</span>
    },
    { title: '平均响应时长', dataIndex: 'avgResponseTime', key: 'avgResponseTime', render: (v: number) => `${v}h` }
  ]

  // 城市明细表头（全国视图显示）
  const nationalCityColumns = [
    { title: '省份', dataIndex: 'provinceName', key: 'provinceName' },
    ...cityColumns.filter(c => c.key !== 'name').map(c => 
      c.key === 'name' ? c : { ...c, key: c.key }
    ),
    { ...cityColumns.find(c => c.key === 'name')!, dataIndex: 'name', key: 'cityName' }
  ].filter((c, i, arr) => arr.findIndex(x => x.key === c.key) === i)

  const cityTableData = useMemo(() => {
    if (drillDown.level === 'province' && drillDown.provinceName) {
      const prov = scopeData.provinces.find(p => p.name === drillDown.provinceName)
      return prov?.cities || []
    }
    return filteredProvinces.flatMap(p =>
      p.cities.map(c => ({ ...c, provinceName: p.name }))
    ).sort((a, b) => b.energySavingRate - a.energySavingRate)
  }, [drillDown, scopeData.provinces, filteredProvinces])

  return (
    <div className="page-container">
      {/* 导航栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={16}>
          <Space>
            <span style={{ fontWeight: 500 }}>当前范围：</span>
            {breadcrumbs.map((item, idx) => (
              <span key={idx}>
                {idx > 0 && <span style={{ color: '#999', margin: '0 4px' }}>/</span>}
                {item.onClick ? (
                  <a onClick={item.onClick} style={{ fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400 }}>
                    {item.label}
                  </a>
                ) : (
                  <span style={{ fontWeight: 600, color: '#1677ff' }}>{item.label}</span>
                )}
              </span>
            ))}
          </Space>

          {drillDown.level !== 'national' && (
            <Button 
              icon={<HomeOutlined />} 
              size="small"
              onClick={() => {
                if (currentUser?.level === 'provincial') {
                  setDrillDown({ level: 'province', provinceName: currentUser.province })
                } else if (currentUser?.level === 'municipal') {
                  setDrillDown({ level: 'city', provinceName: currentUser.province, cityName: currentUser.city })
                } else {
                  setDrillDown({ level: 'national' })
                }
              }}
            >
              返回总览
            </Button>
          )}

          <Space style={{ marginLeft: 'auto' }}>
            <span style={{ fontWeight: 500 }}>路灯类型：</span>
            <Select
              value={selectedLampType}
              onChange={(v) => setSelectedLampType(v as LampType | 'all')}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: '全部类型' },
                { value: 'LED', label: 'LED' },
                { value: '高压钠灯', label: '高压钠灯' },
                { value: '金卤灯', label: '金卤灯' },
                { value: '无极灯', label: '无极灯' }
              ]}
            />
            {selectedLampType !== 'all' && (
              <Tag color="orange">已按 {selectedLampType} 筛选</Tag>
            )}
          </Space>
        </Space>
      </Card>

      {/* KPI 卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">{selectedLampType !== 'all' ? `${selectedLampType}数量` : '路灯总数'}</div>
                <div className="stat-value">{(scopeStats.totalLamps / 10000).toFixed(2)}万</div>
                <div className="stat-trend">
                  <ArrowUpOutlined /> {scopeData.scopeName}范围
                </div>
              </div>
              <BulbOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} md={6}>
          <div className="stat-card green">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">{selectedLampType !== 'all' ? `${selectedLampType}亮灯率` : '平均亮灯率'}</div>
                <div className="stat-value">{scopeStats.avgLightRate}%</div>
                <div className="stat-trend">
                  <RiseOutlined /> {selectedLampType !== 'all' ? `仅${selectedLampType}` : '较上月 0.8%'}
                </div>
              </div>
              <BulbOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} md={6}>
          <div className="stat-card orange">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">平均节能率</div>
                <div className="stat-value">{scopeStats.avgSavingRate}%</div>
                <div className="stat-trend">
                  <ArrowUpOutlined /> 目标 30%
                </div>
              </div>
              <ThunderboltOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} md={6}>
          <div className="stat-card blue">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">{selectedLampType !== 'all' ? `${selectedLampType}故障率` : '平均故障率'}</div>
                <div className="stat-value">{scopeStats.avgFaultRate}%</div>
                <div className="stat-trend">
                  <FallOutlined /> 较上月下降
                </div>
              </div>
              <AlertOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
      </Row>

      {/* 热力图 - 仅全国和省级显示 */}
      {(drillDown.level === 'national' || (drillDown.level === 'province' && provinceStats.length > 1)) && (
        <Card
          title={`${scopeData.scopeName}照明节能热力图（颜色越深节能率越高）`}
          className="chart-card"
          style={{ marginBottom: 16 }}
          extra={<Tooltip title="点击省份查看该省详情">💡 点击省份可下钻</Tooltip>}
        >
          <ReactECharts
            option={heatmapOption}
            style={{ height: 280 }}
            onEvents={{ click: handleHeatmapClick }}
          />
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card 
            title={`${scopeData.scopeName}${drillDown.level === 'city' || drillDown.level === 'road' ? '各路段' : '各省份'}照明节能指标对比`} 
            className="chart-card"
          >
            <ReactECharts option={barChartOption} style={{ height: 360 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title={`故障率TOP10（${scopeData.scopeName}）`} 
            className="chart-card"
            extra={drillDown.level === 'city' ? <Tag color="blue">按路段排名</Tag> : <Tag color="blue">按城市排名</Tag>}
          >
            <ReactECharts option={rankingOption} style={{ height: 360 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card title={`${scopeData.scopeName}近30天能耗趋势`} className="chart-card">
            <ReactECharts option={energyTrendOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title={selectedLampType !== 'all' ? `${selectedLampType}占比` : '路灯类型分布'} 
            className="chart-card"
          >
            <ReactECharts option={pieOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      {/* 路段级明细 - 城市或路段视图显示 */}
      {(drillDown.level === 'city' || drillDown.level === 'road') && (
        <Card 
          title={`${scopeData.scopeName}路段级明细`} 
          className="chart-card" 
          style={{ marginBottom: 16 }}
          extra={<span style={{ color: '#999', fontSize: 12 }}>点击路段可查看详情</span>}
        >
          <Table
            dataSource={roadStats}
            columns={roadColumns}
            rowKey="name"
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: true, showTotal: t => `共 ${t} 条路段` }}
            scroll={{ x: 1200 }}
          />
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={`${scopeData.scopeName}${drillDown.level === 'province' ? '城市' : drillDown.level === 'city' ? '路段' : '城市'}明细数据`}
            className="chart-card"
            extra={<span style={{ color: '#999', fontSize: 12 }}>
              {drillDown.level === 'national' && '点击城市可下钻'}
              {drillDown.level === 'province' && '点击城市可下钻到路段'}
              {drillDown.level === 'city' && '点击路段可查看详情'}
            </span>}
          >
            <div style={{ overflowX: 'auto' }}>
              {drillDown.level === 'province' ? (
                <Table
                  dataSource={cityTableData as any}
                  columns={cityColumns}
                  rowKey="code"
                  size="small"
                  pagination={{ pageSize: 10 }}
                />
              ) : (
                <Table
                  dataSource={cityTableData as any}
                  columns={[
                    { title: '省份', dataIndex: 'provinceName', key: 'provinceName' },
                    { title: '城市', dataIndex: 'name', key: 'name', render: (text: string, record: any) => <a onClick={() => handleCityClick(record, record.provinceName)}>{text}</a> },
                    { title: '路灯数', dataIndex: 'totalLamps', key: 'totalLamps', render: (v: number) => v.toLocaleString() },
                    { title: '亮灯率', dataIndex: 'lightRate', key: 'lightRate', render: (v: number) => <Tag color={v >= 97 ? 'green' : v >= 95 ? 'orange' : 'red'}>{v}%</Tag> },
                    { title: '节能率', dataIndex: 'energySavingRate', key: 'energySavingRate', render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 500 }}>{v}%</span> },
                    { title: '故障率', dataIndex: 'faultRate', key: 'faultRate', render: (v: number) => <span style={{ color: v > 3 ? '#ff4d4f' : '#666' }}>{v}%</span> },
                    { title: '响应时长', dataIndex: 'avgResponseTime', key: 'avgResponseTime', render: (v: number) => `${v}h` }
                  ]}
                  rowKey="code"
                  size="small"
                  pagination={{ pageSize: 10 }}
                />
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="故障类型分布" className="chart-card">
            <ReactECharts option={faultPieOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      {/* 路段详情弹窗 */}
      <Modal
        title={`${drillDown.provinceName} - ${drillDown.cityName} - ${drillDown.roadName} - 路段详情`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={1000}
      >
        {drillDown.roadName && roadStats.find(r => r.name === drillDown.roadName) && (
          <>
            <Descriptions column={3} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="路段名称">{drillDown.roadName}</Descriptions.Item>
              <Descriptions.Item label="所属区域">{drillDown.districtName}</Descriptions.Item>
              <Descriptions.Item label="路灯总数">{roadStats.find(r => r.name === drillDown.roadName)!.totalLamps}盏</Descriptions.Item>
              <Descriptions.Item label="亮灯率">
                <Tag color={roadStats.find(r => r.name === drillDown.roadName)!.lightRate >= 97 ? 'green' : 'orange'}>
                  {roadStats.find(r => r.name === drillDown.roadName)!.lightRate}%
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="故障率">
                <Tag color={roadStats.find(r => r.name === drillDown.roadName)!.faultRate > 3 ? 'red' : 'blue'}>
                  {roadStats.find(r => r.name === drillDown.roadName)!.faultRate}%
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="节能率">
                <span style={{ color: '#52c41a', fontWeight: 500 }}>
                  {roadStats.find(r => r.name === drillDown.roadName)!.savingRate}%
                </span>
              </Descriptions.Item>
            </Descriptions>

            <Tabs defaultActiveKey="energy">
              <Tabs.TabPane tab="近7天能耗趋势" key="energy">
                <ReactECharts option={roadEnergyOption} style={{ height: 320 }} />
              </Tabs.TabPane>
              <Tabs.TabPane tab="灯具类型分布" key="lampType">
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  {Object.entries(roadStats.find(r => r.name === drillDown.roadName)!.lampTypeBreakdown)
                    .filter(([_, count]) => count > 0)
                    .map(([type, count], idx) => {
                      const total = roadStats.find(r => r.name === drillDown.roadName)!.totalLamps
                      const percent = total > 0 ? (count / total) * 100 : 0
                      return (
                        <Col xs={12} md={6} key={type}>
                          <Card style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 700, color: ['#1677ff', '#52c41a', '#faad14', '#722ed1'][idx] }}>
                              {count}
                            </div>
                            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{type}</div>
                            <Progress percent={Number(percent.toFixed(1))} showInfo={false} style={{ marginTop: 8 }} />
                            <div style={{ fontSize: 11, color: '#999' }}>{percent.toFixed(1)}%</div>
                          </Card>
                        </Col>
                      )
                    })}
                </Row>
              </Tabs.TabPane>
              <Tabs.TabPane tab="故障类型分布" key="fault">
                <ReactECharts option={faultPieOption} style={{ height: 320 }} />
              </Tabs.TabPane>
            </Tabs>
          </>
        )}
      </Modal>
    </div>
  )
}
