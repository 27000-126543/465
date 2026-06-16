import { useState, useEffect, useMemo } from 'react'
import { Row, Col, Card, Table, Tag, Space, Select, Progress, Badge, List, Avatar, Typography, Statistic, message, Button } from 'antd'
import { BulbOutlined, ThunderboltOutlined, AlertOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, PlayCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '@/store/dataStore'
import type { StreetLamp } from '@/types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(relativeTime)
dayjs.extend(isoWeek)

const { Text } = Typography

export default function RealtimeMonitor() {
  const {
    currentUser,
    filteredLamps,
    filteredAlerts,
    runAutoAlertCheck
  } = useDataStore()

  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [currentTime, setCurrentTime] = useState(dayjs().format('YYYY-MM-DD HH:mm:ss'))
  const [autoAlertRunning, setAutoAlertRunning] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs().format('YYYY-MM-DD HH:mm:ss'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const districts = useMemo(() => {
    const set = new Set(filteredLamps.map(l => l.district))
    return Array.from(set)
  }, [filteredLamps])

  const filteredLampsFinal = useMemo(() => {
    let result = filteredLamps
    if (selectedDistrict !== 'all') {
      result = result.filter(l => l.district === selectedDistrict)
    }
    if (selectedStatus !== 'all') {
      result = result.filter(l => l.status === selectedStatus)
    }
    return result
  }, [filteredLamps, selectedDistrict, selectedStatus])

  const realtimeStats = useMemo(() => {
    const total = filteredLamps.length
    const normal = filteredLamps.filter(l => l.status === 'normal').length
    const fault = filteredLamps.filter(l => l.status === 'fault').length
    const offline = filteredLamps.filter(l => l.status === 'offline').length
    const maintenance = filteredLamps.filter(l => l.status === 'maintenance').length
    const lightRate = total > 0 ? Number(((normal / total) * 100).toFixed(2)) : 0
    const avgBrightness = normal > 0
      ? Number((filteredLamps.filter(l => l.status === 'normal').reduce((s, l) => s + l.brightness, 0) / normal).toFixed(1))
      : 0
    return { total, normal, fault, offline, maintenance, lightRate, avgBrightness }
  }, [filteredLamps])

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
        axisLine: {
          lineStyle: {
            width: 18,
            color: [[0.8, '#52c41a'], [0.95, '#faad14'], [1, '#ff4d4f']]
          }
        },
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
      xAxis: { type: 'category', data: hours, axisLabel: { fontSize: 10 } },
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
    return filteredAlerts.filter(a => !a.isHandled).slice(0, 8)
  }, [filteredAlerts])

  const handleRunAutoAlertCheck = () => {
    setAutoAlertRunning(true)
    setTimeout(() => {
      const newAlerts = runAutoAlertCheck()
      setAutoAlertRunning(false)
      if (newAlerts.length > 0) {
        message.success(`自动预警检查完成，新增 ${newAlerts.length} 条一级预警`)
      } else {
        message.info('自动预警检查完成，未发现新的异常')
      }
    }, 1500)
  }

  const statusMap: Record<string, { text: string; color: string; icon: JSX.Element }> = {
    normal: { text: '正常', color: 'success', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
    fault: { text: '故障', color: 'error', icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> },
    offline: { text: '离线', color: 'default', icon: <WarningOutlined style={{ color: '#faad14' }} /> },
    maintenance: { text: '维护中', color: 'processing', icon: <ClockCircleOutlined style={{ color: '#1677ff' }} /> }
  }

  const columns = [
    { title: '路灯编号', dataIndex: 'code', key: 'code', width: 120, render: (code: string) => <Text code>{code}</Text> },
    {
      title: '所在区域', key: 'location',
      render: (_: any, record: StreetLamp) => <span>{record.district} · {record.road}</span>
    },
    { title: '灯具类型', dataIndex: 'type', key: 'type', width: 100 },
    { title: '功率', dataIndex: 'power', key: 'power', width: 80, render: (p: number) => `${p}W` },
    {
      title: '亮度', dataIndex: 'brightness', key: 'brightness', width: 120,
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
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => {
        const s = statusMap[status]
        return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>
      }
    },
    {
      title: '故障时长', key: 'faultDuration', width: 100,
      render: (_: any, record: StreetLamp) => {
        if (record.status !== 'fault' || !record.faultTime) return '-'
        const hours = dayjs().diff(dayjs(record.faultTime), 'hour')
        return hours > 24
          ? <Tag color="red">超时 {hours}h</Tag>
          : <span style={{ color: '#faad14' }}>{hours}h</span>
      }
    },
    {
      title: '最后更新', dataIndex: 'lastUpdateTime', key: 'lastUpdateTime', width: 160,
      render: (t: string) => <span style={{ color: '#888', fontSize: 12 }}>{t}</span>
    }
  ]

  const levelText = currentUser?.level === 'national' ? '全国' :
    currentUser?.level === 'provincial' ? currentUser.province :
    currentUser?.level === 'municipal' ? currentUser.city : ''

  return (
    <div className="page-container">
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span style={{ fontWeight: 500 }}>当前范围：<Tag color="blue">{levelText}</Tag></span>
          <span style={{ fontWeight: 500 }}>区域筛选：</span>
          <Select
            value={selectedDistrict}
            onChange={setSelectedDistrict}
            style={{ width: 140 }}
            options={[{ value: 'all', label: '全部区域' }, ...districts.map(d => ({ value: d, label: d }))]}
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
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={autoAlertRunning}
            onClick={handleRunAutoAlertCheck}
            style={{ marginLeft: 16 }}
          >
            运行自动预警检查
          </Button>
          <div style={{ marginLeft: 'auto', color: '#8c8c8c' }}>
            <ClockCircleOutlined /> 实时数据 · {currentTime}
          </div>
        </Space>
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          <AlertOutlined style={{ color: '#faad14', marginRight: 4 }} />
          自动预警规则：路段连续3天亮灯率低于95% / 单灯故障超过24小时未修复 → 生成一级预警
        </div>
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
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#ff4d4f' }}>
                    {realtimeStats.total > 0 ? ((realtimeStats.fault / realtimeStats.total) * 100).toFixed(1) : 0}%
                  </div>
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
            {recentAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 40, opacity: 0.3 }} />
                <div style={{ marginTop: 8 }}>暂无待处理预警</div>
              </div>
            ) : (
              <List
                dataSource={recentAlerts}
                size="small"
                renderItem={(item) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <List.Item.Meta
                      avatar={<Badge status="error" />}
                      title={<span style={{ fontSize: 13 }}>{item.title}</span>}
                      description={
                        <span style={{ fontSize: 11, color: '#999' }}>
                          {item.district} · {dayjs(item.createTime).fromNow()}
                        </span>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title={`${levelText}路灯实时状态`} className="chart-card">
        <Table
          columns={columns}
          dataSource={filteredLampsFinal}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>
    </div>
  )
}
