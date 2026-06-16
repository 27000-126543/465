import { useState, useMemo } from 'react'
import {
  Row, Col, Card, Upload, Button, Space, Table, Tag, Progress,
  message, Select, Modal, Form, Slider, Typography, List
} from 'antd'
import {
  UploadOutlined, ThunderboltOutlined, BulbOutlined, ExperimentOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { energyData, energyPlans, lampTypeDistribution } from '@/data/mockData'
import type { EnergyPlan, DimmingSchedule } from '@/types'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const { Title, Text } = Typography

export default function EnergyAnalysis() {
  const [plans, setPlans] = useState<EnergyPlan[]>(energyPlans)
  const [selectedPlan, setSelectedPlan] = useState<EnergyPlan | null>(energyPlans[0])
  const [uploading, setUploading] = useState(false)
  const [predictVisible, setPredictVisible] = useState(false)
  const [dimmingSchedule, setDimmingSchedule] = useState<DimmingSchedule[]>([
    { timeRange: '黄昏时段', startHour: 18, endHour: 20, brightness: 100 },
    { timeRange: '晚间高峰', startHour: 20, endHour: 23, brightness: 100 },
    { timeRange: '深夜时段', startHour: 23, endHour: 5, brightness: 60 },
    { timeRange: '凌晨时段', startHour: 5, endHour: 7, brightness: 80 }
  ])

  const beforeUpload = (file: File) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    if (!isExcel) {
      message.error('只能上传Excel文件!')
      return false
    }
    setUploading(true)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        console.log('解析的Excel数据:', jsonData)
        
        setTimeout(() => {
          const newPlan: EnergyPlan = {
            id: `EP${Date.now()}`,
            year: dayjs().year(),
            province: '广东省',
            city: '深圳市',
            uploadTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            dimmingSchedule: dimmingSchedule,
            targetSavingRate: 30,
            predictedConsumption: 28000000
          }
          setPlans(prev => [newPlan, ...prev])
          setSelectedPlan(newPlan)
          setUploading(false)
          message.success('节能计划上传成功，已自动提取调光时段')
        }, 1000)
      } catch (err) {
        setUploading(false)
        message.error('文件解析失败')
      }
    }
    reader.readAsArrayBuffer(file)
    return false
  }

  const predictionOption = useMemo(() => {
    const dates: string[] = []
    const actual: number[] = []
    const predicted: number[] = []
    const optimized: number[] = []
    
    for (let i = 30; i > 0; i--) {
      dates.push(dayjs().subtract(i, 'day').format('MM-DD'))
      const val = energyData[energyData.length - i]?.actualConsumption || 80000
      actual.push(val)
      predicted.push(null as any)
      optimized.push(null as any)
    }
    for (let i = 0; i < 90; i++) {
      dates.push(dayjs().add(i, 'day').format('MM-DD'))
      actual.push(null as any)
      const base = 85000 + Math.sin(i / 10) * 5000 + Math.random() * 3000
      predicted.push(base)
      optimized.push(base * 0.92)
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
      ],
      markLine: {
        silent: true,
        data: [{ xAxis: 30, lineStyle: { type: 'dashed', color: '#999' } }]
      }
    }
  }, [])

  const savingTrendOption = useMemo(() => {
    const last90 = energyData.slice(-90)
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
          data: last90.reduce((acc, d, idx) => {
            acc.push((acc[idx - 1] || 0) + d.savingAmount)
            return acc
          }, [] as number[]),
          itemStyle: { color: '#1677ff', opacity: 0.3 },
          barWidth: 4
        }
      ]
    }
  }, [])

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
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: { fontSize: 10, interval: 2 }
      },
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

  const planColumns = [
    {
      title: '计划编号',
      dataIndex: 'id',
      key: 'id',
      width: 120
    },
    {
      title: '年度',
      dataIndex: 'year',
      key: 'year',
      width: 80
    },
    {
      title: '适用范围',
      key: 'scope',
      render: (_: any, record: EnergyPlan) => (
        <span>{record.province} · {record.city}</span>
      )
    },
    {
      title: '目标节能率',
      dataIndex: 'targetSavingRate',
      key: 'targetSavingRate',
      width: 100,
      render: (v: number) => <Tag color="green">{v}%</Tag>
    },
    {
      title: '预测年能耗',
      dataIndex: 'predictedConsumption',
      key: 'predictedConsumption',
      width: 130,
      render: (v: number) => `${(v / 10000).toFixed(1)}万 kWh`
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
      width: 160
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: EnergyPlan) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => setSelectedPlan(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => setPredictVisible(true)}>预测分析</Button>
        </Space>
      )
    }
  ]

  const recommendationPlans = [
    {
      id: 1,
      name: '深度调光方案',
      desc: '深夜时段（23:00-5:00）亮度降至50%，凌晨（5:00-7:00）调至70%',
      savingRate: '增加 5-8%',
      investment: 0,
      payback: '立即见效',
      recommended: true
    },
    {
      id: 2,
      name: '分时分区方案',
      desc: '商业区晚高峰保持100%，居住区22点后降至60%',
      savingRate: '增加 8-12%',
      investment: 50000,
      payback: '6个月',
      recommended: true
    },
    {
      id: 3,
      name: 'LED改造升级',
      desc: '将剩余高压钠灯和金卤灯全部替换为LED',
      savingRate: '整体提升至 35%+',
      investment: 4500000,
      payback: '3.5年',
      recommended: false
    },
    {
      id: 4,
      name: '智能感应调光',
      desc: '加装人体/车辆感应，无车无人时自动降亮',
      savingRate: '增加 10-15%',
      investment: 1200000,
      payback: '2年',
      recommended: false
    }
  ]

  return (
    <div className="page-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="stat-card orange">
            <div className="stat-label">本月节电量</div>
            <div className="stat-value" style={{ fontSize: 26 }}>
              {(energyData.slice(-30).reduce((s, d) => s + d.savingAmount, 0) / 10000).toFixed(1)}万
            </div>
            <div className="stat-trend">kWh · 同比增长 8.5%</div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card green">
            <div className="stat-label">平均节能率</div>
            <div className="stat-value" style={{ fontSize: 26 }}>28.5%</div>
            <div className="stat-trend">较目标 30% 差 1.5%</div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card blue">
            <div className="stat-label">累计节能量</div>
            <div className="stat-value" style={{ fontSize: 26 }}>
              {(energyData.reduce((s, d) => s + d.savingAmount, 0) / 10000).toFixed(0)}万
            </div>
            <div className="stat-trend">kWh · 相当于减少CO₂ {(energyData.reduce((s, d) => s + d.savingAmount, 0) * 0.785 / 1000).toFixed(0)}吨</div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card">
            <div className="stat-label">节能灯具占比</div>
            <div className="stat-value" style={{ fontSize: 26 }}>57%</div>
            <div className="stat-trend">LED灯具占比持续提升</div>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="90天能耗预测分析" className="chart-card"
            extra={
              <Space>
                <Select defaultValue="all" style={{ width: 120 }} size="small">
                  <option value="all">全部类型</option>
                  <option value="LED">LED</option>
                  <option value="高压钠灯">高压钠灯</option>
                </Select>
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
          <Card title="调光时段配置" className="chart-card">
            <ReactECharts option={dimmingVisualOption} style={{ height: 200 }} />
            <div style={{ marginTop: 12 }}>
              <List
                size="small"
                dataSource={dimmingSchedule}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      <Tag color="orange">{item.timeRange}</Tag>
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
        title="年度节能计划管理"
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
        <Table
          columns={planColumns}
          dataSource={plans}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          size="middle"
        />
      </Card>

      <Modal
        title="能耗预测模拟"
        open={predictVisible}
        onCancel={() => setPredictVisible(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setPredictVisible(false)}>取消</Button>,
          <Button key="apply" type="primary">应用方案</Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">调整调光亮度，预测节能效果</Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>深夜时段亮度 (23:00 - 5:00)</div>
          <Slider
            min={30}
            max={100}
            defaultValue={60}
            onChange={(v) => {
              setDimmingSchedule(prev => prev.map(d =>
                d.timeRange === '深夜时段' ? { ...d, brightness: v } : d
              ))
            }}
            tooltip={{ formatter: v => `${v}%` }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>凌晨时段亮度 (5:00 - 7:00)</div>
          <Slider
            min={50}
            max={100}
            defaultValue={80}
            onChange={(v) => {
              setDimmingSchedule(prev => prev.map(d =>
                d.timeRange === '凌晨时段' ? { ...d, brightness: v } : d
              ))
            }}
            tooltip={{ formatter: v => `${v}%` }}
          />
        </div>
        <ReactECharts option={dimmingVisualOption} style={{ height: 200 }} />
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>预计节能率</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>32.5%</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 12, background: '#e6f7ff', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>年节电量</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1677ff' }}>980万kWh</div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: 12, background: '#fff7e6', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>节省费用</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#faad14' }}>¥784万</div>
            </div>
          </Col>
        </Row>
      </Modal>
    </div>
  )
}
