import { useState, useEffect, useMemo } from 'react'
import { Row, Col, Card, Table, Tag, Space, Select, Progress, Badge, List, Avatar, Typography, Statistic } from 'antd'
import { BulbOutlined, ThunderboltOutlined, AlertOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { streetLamps, alerts, energyData } from '@/data/mockData'
import type { StreetLamp } from '@/types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

const { Title, Text } = Typography

export default function RealtimeMonitor() {
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [currentTime, setCurrentTime] = useState(dayjs().format('YYYY-MM-DD HH:mm:ss'))

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs().format('YYYY-MM-DD HH:mm:ss'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const districts = useMemo(() => {
    const set = new Set(streetLamps.map(l => l.district))
    return Array.from(set)
  }, [])

  const filteredLamps = useMemo(() => {
    let result = streetLamps
    if (selectedDistrict !== 'all') {
      result = result.filter(l => l.district === selectedDistrict)
    }
    if (selectedStatus !== 'all') {
      result = result.filter(l => l.status === selectedStatus)
    }
    return result
  }, [selectedDistrict, selectedStatus])

  const realtimeStats = useMemo(() => {
    const total = streetLamps.length
    const normal = streetLamps.filter(l => l.status === 'normal').length
    const fault = streetLamps.filter(l => l.status === 'fault').length
    const offline = streetLamps.filter(l => l.status === 'offline').length
    const maintenance = streetLamps.filter(l => l.status === 'maintenance').length
    const lightRate = Number(((normal / total) * 100).toFixed(2))
    const avgBrightness = normal > 0
      ? Number((streetLamps.filter(l => l.status === 'normal').reduce((s, l) => s + l.brightness, 0) / normal).toFixed(1))
      : 0
    return {
      total,
      normal,
      fault,
      offline,
      maintenance,
      lightRate,
      faultRate: Number(((fault / total) * 100).toFixed(2)),
      avgBrightness
    }
  }, [])

  const statusGaugeOption = useMemo(() => {
    return {
      series: [{
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        progress: { show: true, width: 18 },
        pointer: { show: false },
        axisLine: { lineStyle: { width: 18, color: [[0.8, '#52c41a'], [0.95, '#faad14'], [1, '#ff4d4f']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 32,
          fontWeight: 'bold',
          offsetCenter: [0, '0%'],
          formatter: '{value}%',
          color: '#1677ff'
        },
        data: [{ value: realtimeStats.lightRate }]
      }]
    }
  }, [realtimeStats])

  const realtimeEnergyOption = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
    const data = hours.map((_, i) => {
      if (i >= 6 && i < 18) return Math.floor(Math.random() * 2000 + 1000)
      if (i >= 18 && i < 22) return Math.floor(Math.random() * 5000 + 8000)
      if (i >= 22 || i < 5) return Math.floor(Math.random() * 2000 + 4000)
      return Math.floor(Math.random() * 3000 + 2000)
    })
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: { fontSize: 10 }
      },
      yAxis: { type: 'value', name: 'kW' },
      series: [{
        type: 'line',
        data,
        smooth: true,
        areaStyle: { opacity: 0.2, color: '#1677ff' },
        itemStyle: { color: '#1677ff' },
        lineStyle: { width: 2 }
      }]
    }
  }, [])

  const recentAlerts = useMemo(() => {
    return alerts.filter(a => !a.isHandled).slice(0, 8)
  }, [])

  const statusMap: Record<string, { text: string; color: string; icon: JSX.Element }> = {
    normal: { text: '正常', color: 'success', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
    fault: { text: '故障', color: 'error', icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> },
    offline: { text: '离线', color: 'default', icon: <WarningOutlined style={{ color: '#faad14' }} /> },
    maintenance: { text: '维护中', color: 'processing', icon: <ClockCircleOutlined style={{ color: '#1677ff' }} /> }
  }

  const columns = [
    {
      title: '路灯编号',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code: string) => <Text code>{code}</Text>
    },
    {
      title: '所在区域',
      key: 'location',
      render: (_: any, record: StreetLamp) => (
        <span>{record.district} · {record.road}</span>
      )
    },
    {
      title: '灯具类型',
      dataIndex: 'type',
      key: 'type',
      width: 100
    },
    {
      title: '功率',
      dataIndex: 'power',
      key: 'power',
      width: 80,
      render: (p: number) => `${p}W`
    },
    {
      title: '亮度',
      dataIndex: 'brightness',
      key: 'brightness',
      width: 120,
      render: (b: number, record: StreetLamp) => (
        <Progress
          percent={b}
          size="small"
          status={record.status === 'fault' ? 'exception' : 'active'}
          strokeColor={record.status === 'fault' ? '#ff4d4f' : '#52c41a'}
        />
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const s = statusMap[status]
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>
      }
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdateTime',
      key: 'lastUpdateTime',
      width: 160,
      render: (t: string) => <span style={{ color: '#888', fontSize: 12 }}>{t}</span>
    }
  ]

  return (
    <div className="page-container">
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ fontWeight: 500 }}>区域筛选：</span>
          <Select
            value={selectedDistrict}
            onChange={setSelectedDistrict}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部区域' },
              ...districts.map(d => ({ value: d, label: d }))
            ]}
          />
          <span style={{ fontWeight: 500, marginLeft: 16 }}>状态筛选：</span>
          <Select
            value={selectedStatus}
            onChange={setSelectedStatus}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'normal', label: '正常' },
              { value: 'fault', label: '故障' },
              { value: 'offline', label: '离线' },
              { value: 'maintenance', label: '维护中' }
            ]}
          />
          <div style={{ marginLeft: 'auto', color: '#8c8c8c' }}>
            <ClockCircleOutlined /> 实时数据 · {currentTime}
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">路灯总数</div>
                <div className="stat-value" style={{ fontSize: 28 }}>{realtimeStats.total}</div>
              </div>
              <BulbOutlined style={{ fontSize: 36, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card green">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">正常运行</div>
                <div className="stat-value" style={{ fontSize: 28 }}>{realtimeStats.normal}</div>
              </div>
              <CheckCircleOutlined style={{ fontSize: 36, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card orange">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">故障数量</div>
                <div className="stat-value" style={{ fontSize: 28 }}>{realtimeStats.fault}</div>
              </div>
              <AlertOutlined style={{ fontSize: 36, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card blue">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">离线数量</div>
                <div className="stat-value" style={{ fontSize: 28 }}>{realtimeStats.offline}</div>
              </div>
              <WarningOutlined style={{ fontSize: 36, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={8}>
          <Card title="实时亮灯率" className="chart-card">
            <ReactECharts option={statusGaugeOption} style={{ height: 220 }} />
            <div style={{ textAlign: 'center', marginTop: -10 }}>
              <Space size={24}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>平均亮度</Text>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#1677ff' }}>{realtimeStats.avgBrightness}%</div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>故障率</Text>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#ff4d4f' }}>{realtimeStats.faultRate}%</div>
                </div>
              </Space>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={10}>
          <Card title="24小时实时功率曲线" className="chart-card">
            <ReactECharts option={realtimeEnergyOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card 
            title="最新预警" 
            className="chart-card"
            extra={<Tag color="red" style={{ margin: 0 }}>{recentAlerts.length}条</Tag>}
          >
            <List
              dataSource={recentAlerts}
              size="small"
              renderItem={(item) => (
                <List.Item style={{ padding: '8px 0' }}>
                  <List.Item.Meta
                    avatar={
                      <Badge status="error" />
                    }
                    title={<span style={{ fontSize: 13 }}>{item.title}</span>}
                    description={<span style={{ fontSize: 11, color: '#999' }}>{item.district} · {dayjs(item.createTime).fromNow()}</span>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="路灯实时状态" className="chart-card">
        <Table
          columns={columns}
          dataSource={filteredLamps}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          scroll={{ x: 800 }}
          size="middle"
        />
      </Card>
    </div>
  )
}
