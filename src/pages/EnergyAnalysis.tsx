import { useState, useMemo } from 'react'
import {
  Row, Col, Card, Upload, Button, Space, Table, Tag, Progress,
  message, Select, Modal, Form, Slider, Typography, List, Alert
} from 'antd'
import {
  UploadOutlined, ThunderboltOutlined, BulbOutlined,
  ExperimentOutlined, FileExcelOutlined, CheckCircleOutlined,
  CloseCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '@/store/dataStore'
import { faultTypeDistribution, lampTypeDistribution } from '@/data/mockData'
import type { EnergyPlan, DimmingSchedule } from '@/types'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const { Title, Text, Paragraph } = Typography

export default function EnergyAnalysis() {
  const {
    currentUser,
    filteredEnergyData,
    filteredEnergyPlans,
    filteredLamps,
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

  const energyStats = useMemo(() => {
    const last30 = filteredEnergyData.slice(-30)
    const totalSaving = last30.reduce((s, d) => s + d.savingAmount, 0)
    const avgSavingRate = last30.length > 0
      ? last30.reduce((s, d) => s + d.savingRate, 0) / last30.length
      : 0
    const totalActual = last30.reduce((s, d) => s + d.actualConsumption, 0)
    const lampTypeStats = lampTypeDistribution.map(t => {
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

  // Excel表头识别规则
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

    // 查找表头行
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

    // 检查必填字段
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

    // 查找目标节能率
    if (mappedHeaders.targetSavingRate && data[0][mappedHeaders.targetSavingRate]) {
      const rate = Number(data[0][mappedHeaders.targetSavingRate])
      if (!isNaN(rate)) targetRate = rate
    }

    if (errors.length > 0) {
      return { schedule, targetRate, errors }
    }

    // 解析每行数据
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const startVal = row[mappedHeaders.startHour]
      const endVal = row[mappedHeaders.endHour]
      const brightVal = row[mappedHeaders.brightness]
      const rangeVal = mappedHeaders.timeRange ? row[mappedHeaders.timeRange] : null
      const seasonVal = mappedHeaders.season ? row[mappedHeaders.season] : null

      // 解析小时
      let startHour = Number(startVal)
      let endHour = Number(endVal)
      let brightness = Number(brightVal)

      // 尝试解析时间格式如 "18:00"
      if (isNaN(startHour) && String(startVal).includes(':')) {
        startHour = parseInt(String(startVal).split(':')[0])
      }
      if (isNaN(endHour) && String(endVal).includes(':')) {
        endHour = parseInt(String(endVal).split(':')[0])
      }
      if (isNaN(brightness) && String(brightVal).includes('%')) {
        brightness = parseInt(String(brightVal).replace('%', ''))
      }

      // 验证
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
          setUploadError('未能从Excel中解析出有效的调光时段数据')
          setUploading(false)
          return
        }

        if (!currentUser) {
          setUploadError('用户未登录')
          setUploading(false)
          return
        }

        setParsedSchedule(schedule)

        // 创建节能计划
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
              {s.season && s.season !== '全年' && ` (${s.season})`}
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

  return (
    <div className="page-container">
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
                    {s.timeRange}: {String(s.startHour).padStart(2, '0')}:00-{String(s.endHour).padStart(2, '0')}:00 @ {s.brightness}%
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
                      {item.season && item.season !== '全年' && <Tag color="purple">{item.season}</Tag>}
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
              {sched.season && sched.season !== '全年' && <Tag color="purple">{sched.season}</Tag>}
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
    </div>
  )
}
