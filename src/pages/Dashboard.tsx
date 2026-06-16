import { useState, useMemo, useEffect } from 'react'
import { Row, Col, Select, Space, Card, Tag, Modal, Tabs, Progress, Tooltip } from 'antd'
import { ArrowUpOutlined, FallOutlined, RiseOutlined, BulbOutlined, ThunderboltOutlined, AlertOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { faultTypeDistribution, lampTypeDistribution } from '@/data/mockData'
import type { LampType, City, Province } from '@/types'
import dayjs from 'dayjs'

export default function Dashboard() {
  const { currentUser } = useAuthStore()
  const {
    filteredProvinces,
    filteredLamps,
    filteredEnergyData,
    selectedLampType,
    setSelectedLampType,
    getFilteredStats
  } = useDataStore()

  const [selectedDrillDown, setSelectedDrillDown] = useState<{
    type: 'province' | 'city'
    data: Province | City
    provinceName?: string
  } | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

  const stats = useMemo(() => getFilteredStats(), [getFilteredStats])

  const provinceStats = useMemo(() => {
    return filteredProvinces.map(p => {
      const avgLight = p.cities.reduce((s, c) => s + c.lightRate, 0) / p.cities.length
      const avgSaving = p.cities.reduce((s, c) => s + c.energySavingRate, 0) / p.cities.length
      const avgFault = p.cities.reduce((s, c) => s + c.faultRate, 0) / p.cities.length
      const totalLamps = p.cities.reduce((s, c) => s + c.totalLamps, 0)
      return {
        name: p.name,
        code: p.code,
        lightRate: Number(avgLight.toFixed(2)),
        savingRate: Number(avgSaving.toFixed(2)),
        faultRate: Number(avgFault.toFixed(2)),
        totalLamps,
        cities: p.cities
      }
    }).sort((a, b) => b.savingRate - a.savingRate)
  }, [filteredProvinces])

  const heatmapData = useMemo(() => {
    return provinceStats.map(p => ({
      name: p.name,
      value: p.savingRate,
      lightRate: p.lightRate,
      faultRate: p.faultRate,
      totalLamps: p.totalLamps
    }))
  }, [provinceStats])

  // 全国热力图 - 用省份网格（颜色深浅表示节能率）
  const heatmapOption = useMemo(() => {
    const data = heatmapData
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

  const barChartOption = useMemo(() => {
    const data = provinceStats.slice(0, 12)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['亮灯率(%)', '节能率(%)', '故障率(%)'], top: 0 },
      grid: { left: 50, right: 30, top: 40, bottom: 60 },
      xAxis: {
        type: 'category',
        data: data.map(d => d.name.replace(/省|市/g, '')),
        axisLabel: { rotate: 30, fontSize: 11 }
      },
      yAxis: { type: 'value', name: '百分比(%)', max: 100 },
      series: [
        { name: '亮灯率(%)', type: 'bar', data: data.map(d => d.lightRate), itemStyle: { color: '#52c41a' }, barWidth: 12 },
        { name: '节能率(%)', type: 'bar', data: data.map(d => d.savingRate), itemStyle: { color: '#1677ff' }, barWidth: 12 },
        { name: '故障率(%)', type: 'bar', data: data.map(d => d.faultRate), itemStyle: { color: '#ff4d4f' }, barWidth: 12 }
      ]
    }
  }, [provinceStats])

  const rankingOption = useMemo(() => {
    const allCities = filteredProvinces.flatMap(p =>
      p.cities.map(c => ({
        name: `${p.name}-${c.name}`,
        faultRate: c.faultRate,
        totalLamps: c.totalLamps,
        lightRate: c.lightRate
      }))
    ).sort((a, b) => b.faultRate - a.faultRate).slice(0, 10)

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 120, right: 40, top: 20, bottom: 20 },
      xAxis: { type: 'value', name: '故障率(%)' },
      yAxis: {
        type: 'category',
        data: allCities.map(c => c.name).reverse(),
        axisLabel: { fontSize: 11 }
      },
      series: [{
        type: 'bar',
        data: allCities.map(c => c.faultRate).reverse(),
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
  }, [filteredProvinces])

  const energyTrendOption = useMemo(() => {
    const last30 = filteredEnergyData.slice(-30)
    if (last30.length === 0) return {
      tooltip: { trigger: 'axis' },
      title: { text: '暂无能耗数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }
    }
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['实际能耗', '基准能耗', '节能量'], right: 10, top: 0 },
      grid: { left: 60, right: 40, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: last30.map(d => dayjs(d.date).format('MM-DD')),
        axisLabel: { fontSize: 10 }
      },
      yAxis: { type: 'value', name: 'kWh' },
      series: [
        {
          name: '实际能耗',
          type: 'line',
          data: last30.map(d => d.actualConsumption),
          smooth: true,
          itemStyle: { color: '#1677ff' },
          areaStyle: { opacity: 0.1 }
        },
        {
          name: '基准能耗',
          type: 'line',
          data: last30.map(d => d.baselineConsumption),
          smooth: true,
          lineStyle: { type: 'dashed' },
          itemStyle: { color: '#999' }
        },
        {
          name: '节能量',
          type: 'bar',
          data: last30.map(d => d.savingAmount),
          itemStyle: { color: '#52c41a', opacity: 0.6 },
          barWidth: 6
        }
      ]
    }
  }, [filteredEnergyData])

  const pieOption = useMemo(() => {
    const filteredTypes = selectedLampType === 'all'
      ? lampTypeDistribution
      : lampTypeDistribution.filter(d => d.type === selectedLampType)
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
  }, [selectedLampType])

  const faultPieOption = useMemo(() => {
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c}起 ({d}%)' },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        data: faultTypeDistribution.map(d => ({ name: d.type, value: d.count })),
        color: ['#ff4d4f', '#faad14', '#1677ff', '#52c41a', '#722ed1', '#13c2c2']
      }]
    }
  }, [])

  const roadEnergyOption = useMemo(() => {
    if (!selectedDrillDown) return {}
    const roads = ['中山路1段', '人民路2段', '建设路3段', '解放路4段', '文化路5段', '科技路6段']
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: roads.slice(0, 4), top: 0, type: 'scroll' },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 7 }, (_, i) => dayjs().subtract(6 - i, 'day').format('MM-DD'))
      },
      yAxis: { type: 'value', name: 'kWh' },
      series: roads.slice(0, 4).map((road, idx) => ({
        name: road,
        type: 'line',
        smooth: true,
        data: Array.from({ length: 7 }, () => Math.floor(Math.random() * 4000 + 3000))
      }))
    }
  }, [selectedDrillDown])

  const handleHeatmapClick = (params: any) => {
    if (params.componentType === 'series') {
      const provinceName = heatmapData[params.data[0]]?.name
      const province = filteredProvinces.find(p => p.name === provinceName)
      if (province) {
        setSelectedDrillDown({ type: 'province', data: province })
        setModalVisible(true)
      }
    }
  }

  const handleCityClick = (city: City, provinceName: string) => {
    setSelectedDrillDown({ type: 'city', data: city, provinceName })
    setModalVisible(true)
  }

  const cityTableData = useMemo(() => {
    return filteredProvinces.flatMap(p =>
      p.cities.map(c => ({ ...c, provinceName: p.name }))
    ).sort((a, b) => b.energySavingRate - a.energySavingRate)
  }, [filteredProvinces])

  const levelText = currentUser?.level === 'national' ? '全国' :
    currentUser?.level === 'provincial' ? currentUser.province :
    currentUser?.level === 'municipal' ? currentUser.city : ''

  return (
    <div className="page-container">
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ fontWeight: 500 }}>
            当前范围：<Tag color="blue">{levelText}</Tag>
          </span>
          <span style={{ fontWeight: 500, marginLeft: 16 }}>路灯类型：</span>
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
            <Tag color="orange">已按 {selectedLampType} 筛选，所有数据已同步更新</Tag>
          )}
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">路灯总数</div>
                <div className="stat-value">{(stats.totalLamps / 10000).toFixed(1)}万</div>
                <div className="stat-trend">
                  <ArrowUpOutlined /> {levelText}范围
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
                <div className="stat-label">平均亮灯率</div>
                <div className="stat-value">{stats.avgLightRate}%</div>
                <div className="stat-trend">
                  <RiseOutlined /> {selectedLampType !== 'all' ? `按${selectedLampType}统计` : '较上月 0.8%'}
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
                <div className="stat-value">{stats.avgSavingRate}%</div>
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
                <div className="stat-label">平均故障率</div>
                <div className="stat-value">{stats.avgFaultRate}%</div>
                <div className="stat-trend">
                  <FallOutlined /> 较上月下降
                </div>
              </div>
              <AlertOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
      </Row>

      <Card
        title={`${levelText}照明节能热力图（颜色越深节能率越高）`}
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

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card title={`${levelText}各省份照明节能指标对比`} className="chart-card">
            <ReactECharts option={barChartOption} style={{ height: 360 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={`故障率TOP10城市（${levelText}）`} className="chart-card">
            <ReactECharts option={rankingOption} style={{ height: 360 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card title={`${levelText}近30天能耗趋势`} className="chart-card">
            <ReactECharts option={energyTrendOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="路灯类型分布" className="chart-card">
            <ReactECharts option={pieOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={`${levelText}城市明细数据`}
            className="chart-card"
            extra={<span style={{ color: '#999', fontSize: 12 }}>点击城市可下钻查看详情</span>}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {currentUser?.level === 'national' && (
                      <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>省份</th>
                    )}
                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>城市</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>路灯数</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>亮灯率</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>节能率</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>故障率</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>响应时长</th>
                  </tr>
                </thead>
                <tbody>
                  {cityTableData.map((city, idx) => (
                    <tr
                      key={idx}
                      style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                      onClick={() => handleCityClick(city as any, city.provinceName)}
                    >
                      {currentUser?.level === 'national' && (
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>{city.provinceName}</td>
                      )}
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                        <a>{city.name}</a>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{city.totalLamps.toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                        <Tag color={city.lightRate >= 97 ? 'green' : city.lightRate >= 95 ? 'orange' : 'red'}>
                          {city.lightRate}%
                        </Tag>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                        <span style={{ color: '#52c41a', fontWeight: 500 }}>{city.energySavingRate}%</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                        <span style={{ color: city.faultRate > 3 ? '#ff4d4f' : '#666' }}>{city.faultRate}%</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                        {city.avgResponseTime}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="故障类型分布" className="chart-card">
            <ReactECharts option={faultPieOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Modal
        title={
          selectedDrillDown?.type === 'province'
            ? `${selectedDrillDown.data.name} - 全省详情`
            : `${selectedDrillDown?.provinceName} - ${(selectedDrillDown?.data as City)?.name} - 城市详情`
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedDrillDown && (
          <Tabs defaultActiveKey="energy">
            <Tabs.TabPane tab="近7天能耗趋势" key="energy">
              <ReactECharts option={roadEnergyOption} style={{ height: 320 }} />
            </Tabs.TabPane>
            <Tabs.TabPane tab="故障类型分布" key="fault">
              <ReactECharts option={faultPieOption} style={{ height: 320 }} />
            </Tabs.TabPane>
            <Tabs.TabPane tab="各路段/城市明细" key="detail">
              {selectedDrillDown.type === 'province' ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>城市</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>路灯数</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>亮灯率</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>节能率</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>故障率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedDrillDown.data as Province).cities.map((city, i) => (
                        <tr
                          key={i}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleCityClick(city, selectedDrillDown.data.name)}
                        >
                          <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}><a>{city.name}</a></td>
                          <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{city.totalLamps.toLocaleString()}</td>
                          <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{city.lightRate}%</td>
                          <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{city.energySavingRate}%</td>
                          <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{city.faultRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>路段</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>路灯数</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>亮灯率</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>今日能耗(kWh)</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>节能率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['中山路1段', '人民路2段', '建设路3段', '解放路4段', '文化路5段', '科技路6段', '滨江路7段', '和平路8段'].map((road, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{road}</td>
                          <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{Math.floor(Math.random() * 200 + 50)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                            {(Math.random() * 6 + 93).toFixed(1)}%
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                            {Math.floor(Math.random() * 2000 + 1000).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>
                            <span style={{ color: '#52c41a' }}>{(Math.random() * 15 + 20).toFixed(1)}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Tabs.TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  )
}
