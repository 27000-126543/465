import { useState, useMemo } from 'react'
import {
  Row, Col, Card, Table, Tag, Space, Button, Progress,
  Select, DatePicker, Modal, Form, Input, message, List, Typography,
  Descriptions, Empty, Tabs, Tooltip
} from 'antd'
import {
  ToolOutlined, CheckCircleOutlined, ClockCircleOutlined,
  DollarOutlined, PlusOutlined, SearchOutlined, TeamOutlined,
  RiseOutlined, FallOutlined, FileTextOutlined, CalendarOutlined,
  BulbOutlined, AlertOutlined, SwapOutlined, SaveOutlined,
  ArrowUpOutlined, ArrowDownOutlined, EnvironmentOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '@/store/dataStore'
import { faultTypeDistribution } from '@/data/mockData'
import type { InspectionBatch, WorkOrder, StreetLamp, Alert, RouteStop } from '@/types'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Text } = Typography

interface BatchDetail {
  batch: InspectionBatch
  faultLamps: StreetLamp[]
  pendingAlerts: Alert[]
  pendingWorkOrders: WorkOrder[]
}

export default function OperationsManagement() {
  const {
    currentUser,
    filteredWorkOrders,
    filteredInspectionBatches,
    filteredLamps,
    filteredAlerts,
    addWorkOrder,
    addInspectionBatch,
    saveBatchRoute
  } = useDataStore()

  const [activeTab, setActiveTab] = useState('workorders')
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [orderModalVisible, setOrderModalVisible] = useState(false)
  const [batchDetailVisible, setBatchDetailVisible] = useState(false)
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<BatchDetail | null>(null)
  const [scheduleDate, setScheduleDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [scheduleTeam, setScheduleTeam] = useState<string>('all')
  const [orderForm] = Form.useForm()
  const [batchForm] = Form.useForm()
  const [routeSortBy, setRouteSortBy] = useState<'urgency' | 'faultCount' | 'lampCount'>('urgency')
  const [editedRoute, setEditedRoute] = useState<RouteStop[]>([])

  // 运维组列表（从巡检员推断）
  const teams = useMemo(() => {
    const teamSet = new Set<string>()
    teamSet.add('运维一组')
    teamSet.add('运维二组')
    teamSet.add('运维三组')
    teamSet.add('运维四组')
    return Array.from(teamSet)
  }, [])

  // 按日期和运维组分组的巡检排班数据
  const scheduleData = useMemo(() => {
    // 扩展批次数据，添加运维组、未完成工单数等信息
    const batchesWithInfo = filteredInspectionBatches
      .filter(batch => {
        if (scheduleDate) {
          return batch.scheduleDate === scheduleDate
        }
        return true
      })
      .map(batch => {
        const relatedOrders = filteredWorkOrders.filter(o => 
          o.district === batch.district && 
          batch.roads.some(r => o.road.includes(r) || r.includes(o.road))
        )
        const pendingOrders = relatedOrders.filter(o => 
          ['pending', 'processing', 'approved1', 'approved2'].includes(o.status)
        )

        // 根据巡检员分配运维组
        let team = '运维一组'
        if (batch.inspector.includes('李') || batch.inspector.includes('赵')) team = '运维二组'
        if (batch.inspector.includes('王')) team = '运维三组'
        if (batch.inspector.includes('钱') || batch.inspector.includes('孙')) team = '运维四组'

        return {
          ...batch,
          team,
          pendingOrderCount: pendingOrders.length,
          pendingOrders
        }
      })

    // 按日期分组
    const dateGroups = new Map<string, typeof batchesWithInfo>()
    batchesWithInfo.forEach(batch => {
      if (!dateGroups.has(batch.scheduleDate)) {
        dateGroups.set(batch.scheduleDate, [])
      }
      dateGroups.get(batch.scheduleDate)!.push(batch)
    })

    // 按运维组过滤
    if (scheduleTeam !== 'all') {
      dateGroups.forEach((batches, date) => {
        dateGroups.set(date, batches.filter(b => b.team === scheduleTeam))
      })
      // 清空空数组的日期
      Array.from(dateGroups.keys()).forEach(date => {
        if (dateGroups.get(date)!.length === 0) {
          dateGroups.delete(date)
        }
      })
    }

    // 按日期排序
    const sortedDates = Array.from(dateGroups.keys()).sort()
    return sortedDates.map(date => ({
      date,
      batches: dateGroups.get(date)!
    }))
  }, [filteredInspectionBatches, filteredWorkOrders, scheduleTeam, scheduleDate])

  // 获取巡检批次详情
  const getBatchDetail = (batch: InspectionBatch): BatchDetail => {
    const faultLamps = filteredLamps.filter(l => 
      l.province === batch.province &&
      l.city === batch.city &&
      l.district === batch.district &&
      batch.roads.some(r => l.road === r) &&
      l.status === 'fault'
    )

    const pendingAlerts = filteredAlerts.filter(a => 
      a.province === batch.province &&
      a.city === batch.city &&
      a.district === batch.district &&
      !a.isHandled &&
      batch.roads.some(r => a.road === r)
    )

    const pendingWorkOrders = filteredWorkOrders.filter(o => 
      o.province === batch.province &&
      o.city === batch.city &&
      o.district === batch.district &&
      batch.roads.some(r => o.road === r) &&
      ['pending', 'processing', 'approved1', 'approved2'].includes(o.status)
    )

    return { batch, faultLamps, pendingAlerts, pendingWorkOrders }
  }

  const generateRoute = (detail: BatchDetail): RouteStop[] => {
    const roadStatsMap = new Map<string, { faultCount: number; alertCount: number; pendingOrderCount: number; lampCount: number; district: string }>()
    
    detail.batch.roads.forEach(road => {
      const roadFaults = detail.faultLamps.filter(l => l.road === road).length
      const roadAlerts = detail.pendingAlerts.filter(a => a.road === road).length
      const roadOrders = detail.pendingWorkOrders.filter(o => o.road === road || o.road.includes(road)).length
      const roadLamps = filteredLamps.filter(l => l.road === road && l.province === detail.batch.province && l.city === detail.batch.city).length
      const district = detail.faultLamps.find(l => l.road === road)?.district || detail.batch.district
      
      roadStatsMap.set(road, { faultCount: roadFaults, alertCount: roadAlerts, pendingOrderCount: roadOrders, lampCount: roadLamps || Math.floor(Math.random() * 30 + 10), district })
    })

    let stops: RouteStop[] = []
    roadStatsMap.forEach((stats, road) => {
      const urgency: 'high' | 'medium' | 'low' = 
        stats.faultCount >= 3 || stats.alertCount >= 2 ? 'high' :
        stats.faultCount >= 1 || stats.alertCount >= 1 ? 'medium' : 'low'
      stops.push({ road, district: stats.district, order: 0, faultCount: stats.faultCount, alertCount: stats.alertCount, pendingOrderCount: stats.pendingOrderCount, urgency })
    })

    if (routeSortBy === 'urgency') {
      const urgencyOrder = { high: 0, medium: 1, low: 2 }
      stops.sort((a, b) => {
        const diff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
        if (diff !== 0) return diff
        return (b.faultCount + b.alertCount + b.pendingOrderCount) - (a.faultCount + a.alertCount + a.pendingOrderCount)
      })
    } else if (routeSortBy === 'faultCount') {
      stops.sort((a, b) => (b.faultCount + b.alertCount) - (a.faultCount + a.alertCount))
    } else {
      stops.sort((a, b) => (b.faultCount + b.alertCount + b.pendingOrderCount) - (a.faultCount + a.alertCount + a.pendingOrderCount))
    }

    return stops.map((s, i) => ({ ...s, order: i + 1 }))
  }

  const workOrderStats = useMemo(() => {
    const orders = filteredWorkOrders
    const completed = orders.filter(o => o.status === 'completed')
    const totalCost = completed.reduce((s, o) => s + (o.cost || 0), 0)
    const avgResponse = completed.filter(o => o.responseTime).reduce((s, o) => s + (o.responseTime || 0), 0) / (completed.length || 1)
    const avgRepair = completed.reduce((s, o) => s + (o.repairTime || 0), 0) / (completed.length || 1)

    const types = ['fault', 'inspection', 'emergency', 'adjustment'] as const
    const typeStats = types.map(t => ({
      type: t,
      count: orders.filter(o => o.type === t).length,
      completed: orders.filter(o => o.type === t && o.status === 'completed').length
    }))

    return {
      total: orders.length,
      completed: completed.length,
      completionRate: orders.length > 0 ? Number(((completed.length / orders.length) * 100).toFixed(1)) : 0,
      totalCost,
      avgResponseTime: Number(avgResponse.toFixed(1)),
      avgRepairTime: Number(avgRepair.toFixed(1)),
      typeStats
    }
  }, [filteredWorkOrders])

  const districtStats = useMemo(() => {
    const districts = new Set(filteredLamps.map(l => l.district))
    return Array.from(districts).map(d => {
      const lamps = filteredLamps.filter(l => l.district === d)
      const faults = lamps.filter(l => l.status === 'fault').length
      return {
        name: d,
        total: lamps.length,
        fault: faults,
        faultRate: Number(((faults / lamps.length) * 100).toFixed(2)),
        normal: lamps.filter(l => l.status === 'normal').length
      }
    }).sort((a, b) => b.faultRate - a.faultRate)
  }, [filteredLamps])

  const weeklyTrendOption = useMemo(() => {
    const weeks = Array.from({ length: 8 }, (_, i) => `第${i + 1}周`)
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['新建工单', '完成工单'], top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: weeks },
      yAxis: { type: 'value', name: '数量' },
      series: [
        {
          name: '新建工单',
          type: 'bar',
          data: [45, 52, 38, 61, 48, 55, 42, Math.floor(filteredWorkOrders.length / 2)],
          itemStyle: { color: '#1677ff' },
          barWidth: 18
        },
        {
          name: '完成工单',
          type: 'bar',
          data: [40, 48, 36, 55, 45, 52, 40, workOrderStats.completed],
          itemStyle: { color: '#52c41a' },
          barWidth: 18
        }
      ]
    }
  }, [filteredWorkOrders, workOrderStats])

  const costTrendOption = useMemo(() => {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月']
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['维修成本', '耗材成本', '人工成本'], top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: months },
      yAxis: { type: 'value', name: '万元' },
      series: [
        { name: '维修成本', type: 'line', stack: 'total', data: [8.5, 9.2, 7.8, 10.5, 9.8, workOrderStats.totalCost / 10000], areaStyle: { opacity: 0.3 }, smooth: true },
        { name: '耗材成本', type: 'line', stack: 'total', data: [4.2, 4.8, 4.0, 5.5, 5.0, workOrderStats.totalCost / 20000], areaStyle: { opacity: 0.3 }, smooth: true },
        { name: '人工成本', type: 'line', stack: 'total', data: [6.5, 7.0, 6.2, 8.0, 7.5, workOrderStats.totalCost / 15000], areaStyle: { opacity: 0.3 }, smooth: true }
      ]
    }
  }, [workOrderStats])

  const teamPerformanceOption = useMemo(() => {
    const teams = ['运维一组', '运维二组', '运维三组', '运维四组', '运维五组']
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['完成量', '一次修复率', '平均响应(h)'], top: 0 },
      grid: { left: 50, right: 50, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: teams },
      yAxis: [
        { type: 'value', name: '数量/百分比', min: 0, max: 120 },
        { type: 'value', name: '响应小时', min: 0, max: 8 }
      ],
      series: [
        { name: '完成量', type: 'bar', data: [42, 38, 45, 36, workOrderStats.completed], itemStyle: { color: '#1677ff' }, barWidth: 14 },
        { name: '一次修复率', type: 'line', data: [92, 88, 95, 86, 90], itemStyle: { color: '#52c41a' } },
        { name: '平均响应(h)', type: 'line', yAxisIndex: 1, data: [2.5, 3.2, 2.0, 3.8, workOrderStats.avgResponseTime], itemStyle: { color: '#faad14' } }
      ]
    }
  }, [workOrderStats])

  const typeTag = (type: string) => {
    const map: Record<string, { text: string; color: string; icon: JSX.Element }> = {
      fault: { text: '故障维修', color: 'red', icon: <FileTextOutlined /> },
      inspection: { text: '巡检', color: 'blue', icon: <SearchOutlined /> },
      emergency: { text: '紧急抢修', color: 'orange', icon: <ToolOutlined /> },
      adjustment: { text: '调整优化', color: 'purple', icon: <ToolOutlined /> }
    }
    const t = map[type] || { text: type, color: 'default', icon: null }
    return <Tag color={t.color} icon={t.icon}>{t.text}</Tag>
  }

  const statusTag = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      pending: { text: '待处理', color: 'warning' },
      processing: { text: '处理中', color: 'processing' },
      approved1: { text: '组长已确认', color: 'blue' },
      approved2: { text: '区市政复核', color: 'purple' },
      completed: { text: '已完成', color: 'success' },
      rejected: { text: '已驳回', color: 'error' }
    }
    const s = map[status] || { text: status, color: 'default' }
    return <Tag color={s.color}>{s.text}</Tag>
  }

  const priorityTag = (priority: string) => {
    const map: Record<string, { text: string; color: string }> = {
      low: { text: '低', color: 'default' },
      medium: { text: '中', color: 'blue' },
      high: { text: '高', color: 'orange' },
      urgent: { text: '紧急', color: 'red' }
    }
    const p = map[priority] || { text: priority, color: 'default' }
    return <Tag color={p.color}>{p.text}</Tag>
  }

  const batchStatusTag = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      pending: { text: '待执行', color: 'warning' },
      in_progress: { text: '进行中', color: 'processing' },
      completed: { text: '已完成', color: 'success' }
    }
    const s = map[status] || { text: status, color: 'default' }
    return <Tag color={s.color}>{s.text}</Tag>
  }

  const workOrderColumns = [
    { title: '工单号', dataIndex: 'orderNo', key: 'orderNo', width: 150, render: (no: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{no}</span> },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (t: string) => typeTag(t) },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 70, render: (p: string) => priorityTag(p) },
    { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: (s: string) => statusTag(s) },
    {
      title: '位置', key: 'location', width: 160,
      render: (_: any, r: WorkOrder) => <span style={{ fontSize: 12, color: '#666' }}>{r.district} · {r.road}</span>
    },
    { title: '负责人', dataIndex: 'assignee', key: 'assignee', width: 90 },
    { title: '响应时长', dataIndex: 'responseTime', key: 'responseTime', width: 90, render: (t?: number) => t ? `${t}h` : '-' },
    { title: '费用', dataIndex: 'cost', key: 'cost', width: 90, render: (c?: number) => c ? `¥${c}` : '-' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 140, render: (t: string) => dayjs(t).format('MM-DD HH:mm') }
  ]

  const batchColumns = [
    { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 140, render: (no: string) => <span style={{ fontFamily: 'monospace' }}>{no}</span> },
    { title: '区域', key: 'location', width: 140, render: (_: any, r: InspectionBatch) => <span>{r.district}</span> },
    {
      title: '覆盖路段', dataIndex: 'roads', key: 'roads',
      render: (roads: string[]) => (
        <Space size={4} wrap>
          {roads.map((r, i) => <Tag key={i}>{r}</Tag>)}
        </Space>
      )
    },
    { title: '路灯数', dataIndex: 'lampCount', key: 'lampCount', width: 80, render: (n: number) => `${n}盏` },
    { title: '计划日期', dataIndex: 'scheduleDate', key: 'scheduleDate', width: 110 },
    { title: '巡检员', dataIndex: 'inspector', key: 'inspector', width: 90 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => batchStatusTag(s) },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, record: InspectionBatch) => (
        <Button type="link" size="small" onClick={() => {
          setSelectedBatchDetail(getBatchDetail(record))
          setBatchDetailVisible(true)
        }}>
          查看详情
        </Button>
      )
    }
  ]

  const handleAddOrder = () => {
    orderForm.validateFields().then((values) => {
      if (!currentUser) return
      const newOrder = addWorkOrder({
        type: values.type,
        title: values.title,
        description: values.description,
        priority: values.priority,
        reporter: currentUser.name,
        assignee: values.assignee,
        district: values.district,
        road: values.road,
        province: currentUser.province || '',
        city: currentUser.city || ''
      })
      message.success(`工单 ${newOrder.orderNo} 创建成功`)
      setOrderModalVisible(false)
      orderForm.resetFields()
    })
  }

  const handleAddBatch = () => {
    batchForm.validateFields().then((values) => {
      if (!currentUser) return
      const newBatch = addInspectionBatch({
        district: values.district,
        roads: values.roads || [],
        scheduleDate: values.scheduleDate.format('YYYY-MM-DD'),
        inspector: values.inspector,
        status: 'pending',
        lampCount: Math.floor(Math.random() * 150 + 50),
        province: currentUser.province || '',
        city: currentUser.city || ''
      })
      message.success(`巡检批次 ${newBatch.batchNo} 创建成功`)
      setBatchModalVisible(false)
      batchForm.resetFields()
    })
  }

  const districts = Array.from(new Set(filteredLamps.map(l => l.district)))
  const roads = Array.from(new Set(filteredLamps.map(l => l.road)))

  const levelText = currentUser?.level === 'national' ? '全国' :
    currentUser?.level === 'provincial' ? currentUser.province :
    currentUser?.level === 'municipal' ? currentUser.city : ''

  return (
    <div className="page-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="stat-card">
            <div className="stat-label">本月工单总数</div>
            <div className="stat-value">{workOrderStats.total}</div>
            <div className="stat-trend">
              完成率 <b>{workOrderStats.completionRate}%</b>
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card green">
            <div className="stat-label">已完成工单</div>
            <div className="stat-value">{workOrderStats.completed}</div>
            <div className="stat-trend">
              <CheckCircleOutlined /> 一次修复率 91.2%
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card orange">
            <div className="stat-label">累计维修成本</div>
            <div className="stat-value">¥{(workOrderStats.totalCost / 10000).toFixed(1)}万</div>
            <div className="stat-trend">
              <DollarOutlined /> 环比下降 5.2%
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card blue">
            <div className="stat-label">平均响应时长</div>
            <div className="stat-value">{workOrderStats.avgResponseTime}h</div>
            <div className="stat-trend">
              <ClockCircleOutlined /> 平均维修 {workOrderStats.avgRepairTime}h
            </div>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={8}>
          <Card title="工单类型统计" className="chart-card">
            <List
              dataSource={workOrderStats.typeStats}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={typeTag(item.type)}
                    description={`共${item.count}单，完成${item.completed}单`}
                  />
                  <Progress
                    type="dashboard"
                    percent={item.count > 0 ? Math.round((item.completed / item.count) * 100) : 0}
                    width={50}
                    size="small"
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} lg={8}>
          <Card title={`${levelText}各区域故障率`} className="chart-card">
            <List
              dataSource={districtStats}
              size="small"
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<span style={{ fontSize: 13 }}>{item.name}</span>}
                    description={`${item.total}盏路灯 · 故障${item.fault}盏`}
                  />
                  <span style={{
                    color: item.faultRate > 4 ? '#ff4d4f' : item.faultRate > 2 ? '#faad14' : '#52c41a',
                    fontWeight: 600
                  }}>{item.faultRate}%</span>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="运维小组绩效" className="chart-card">
            <ReactECharts option={teamPerformanceOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card title="近8周工单趋势" className="chart-card">
            <ReactECharts option={weeklyTrendOption} style={{ height: 260 }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="近半年成本趋势" className="chart-card">
            <ReactECharts option={costTrendOption} style={{ height: 260 }} />
          </Card>
        </Col>
      </Row>

      <Card
        className="chart-card"
        tabList={[
          { key: 'workorders', tab: `工单管理 (${filteredWorkOrders.length})` },
          { key: 'inspection', tab: `巡检批次 (${filteredInspectionBatches.length})` },
          { key: 'schedule', tab: `巡检排班视图` }
        ]}
        activeTabKey={activeTab}
        onTabChange={setActiveTab}
        extra={
          <Space>
            {activeTab === 'workorders' ? (
              <>
                <RangePicker size="small" />
                <Select defaultValue="all" style={{ width: 110 }} size="small">
                  <option value="all">全部状态</option>
                  <option value="pending">待处理</option>
                  <option value="processing">处理中</option>
                  <option value="completed">已完成</option>
                </Select>
                <Button type="primary" size="small" icon={<SearchOutlined />}>查询</Button>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setOrderModalVisible(true)}>
                  新建工单
                </Button>
              </>
            ) : activeTab === 'inspection' ? (
              <>
                <Select defaultValue="all" style={{ width: 110 }} size="small">
                  <option value="all">全部状态</option>
                  <option value="pending">待执行</option>
                  <option value="in_progress">进行中</option>
                  <option value="completed">已完成</option>
                </Select>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setBatchModalVisible(true)}>
                  新建批次
                </Button>
              </>
            ) : (
              <>
                <DatePicker
                  size="small"
                  value={dayjs(scheduleDate)}
                  onChange={(date) => date && setScheduleDate(date.format('YYYY-MM-DD'))}
                  style={{ width: 140 }}
                />
                <Select
                  value={scheduleTeam}
                  onChange={setScheduleTeam}
                  style={{ width: 120 }}
                  size="small"
                >
                  <option value="all">全部运维组</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setBatchModalVisible(true)}>
                  新建批次
                </Button>
              </>
            )}
          </Space>
        }
      >
        {activeTab === 'workorders' ? (
          <Table
            columns={workOrderColumns}
            dataSource={filteredWorkOrders}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            size="middle"
            scroll={{ x: 1200 }}
          />
        ) : activeTab === 'inspection' ? (
          <Table
            columns={batchColumns}
            dataSource={filteredInspectionBatches}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            size="middle"
            scroll={{ x: 1000 }}
          />
        ) : (
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {scheduleData.length === 0 ? (
              <Empty description="暂无巡检排班数据" />
            ) : (
              scheduleData.map(({ date, batches }) => (
                <Card
                  key={date}
                  title={
                    <Space>
                      <CalendarOutlined style={{ color: '#1677ff' }} />
                      <span>{date}</span>
                      <Tag color="blue">共 {batches.length} 批次</Tag>
                    </Space>
                  }
                  size="small"
                  style={{ marginBottom: 12 }}
                >
                  <Row gutter={[12, 12]}>
                    {batches.map(batch => (
                      <Col xs={24} md={12} lg={8} key={batch.id}>
                        <Card
                          size="small"
                          title={
                            <Space>
                              <Tag color="blue" style={{ fontFamily: 'monospace' }}>{batch.batchNo}</Tag>
                              <TeamOutlined style={{ color: '#666' }} />
                              <span style={{ fontSize: 13 }}>{batch.team}</span>
                            </Space>
                          }
                          extra={batchStatusTag(batch.status)}
                          hoverable
                          onClick={() => {
                            setSelectedBatchDetail(getBatchDetail(batch))
                            setBatchDetailVisible(true)
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <Space direction="vertical" size={6} style={{ width: '100%' }}>
                            <div style={{ fontSize: 12, color: '#666' }}>
                              <span style={{ marginRight: 12 }}>
                                <SearchOutlined /> {batch.inspector}
                              </span>
                              <span>
                                <BulbOutlined /> {batch.lampCount}盏路灯
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: '#666' }}>
                              区域：{batch.district}
                            </div>
                            <div style={{ fontSize: 12 }}>
                              路段：
                              <Space size={4} wrap style={{ marginLeft: 4 }}>
                                {batch.roads.slice(0, 3).map((r, i) => <Tag key={i}>{r}</Tag>)}
                                {batch.roads.length > 3 && <Tag>+{batch.roads.length - 3}</Tag>}
                              </Space>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                              <span style={{ fontSize: 12, color: '#666' }}>
                                未完工单：
                                <span style={{ color: batch.pendingOrderCount > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600, marginLeft: 4 }}>
                                  {batch.pendingOrderCount}
                                </span>
                              </span>
                              <Button type="link" size="small" style={{ padding: 0 }}>
                                查看详情 →
                              </Button>
                            </div>
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Card>
              ))
            )}
          </div>
        )}
      </Card>

      {/* 巡检批次详情弹窗 */}
      <Modal
        title={
          selectedBatchDetail ? (
            <Space>
              <Tag color="blue" style={{ fontFamily: 'monospace' }}>{selectedBatchDetail.batch.batchNo}</Tag>
              <span>{selectedBatchDetail.batch.district} 巡检详情</span>
            </Space>
          ) : ''
        }
        open={batchDetailVisible}
        onCancel={() => { setBatchDetailVisible(false); setEditedRoute([]) }}
        footer={null}
        width={960}
      >
        {selectedBatchDetail && (
          <div>
            <Descriptions column={3} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="巡检批次">{selectedBatchDetail.batch.batchNo}</Descriptions.Item>
              <Descriptions.Item label="状态">{batchStatusTag(selectedBatchDetail.batch.status)}</Descriptions.Item>
              <Descriptions.Item label="计划日期">{selectedBatchDetail.batch.scheduleDate}</Descriptions.Item>
              <Descriptions.Item label="区域">{selectedBatchDetail.batch.district}</Descriptions.Item>
              <Descriptions.Item label="巡检员">{selectedBatchDetail.batch.inspector}</Descriptions.Item>
              <Descriptions.Item label="预计路灯数">{selectedBatchDetail.batch.lampCount}盏</Descriptions.Item>
              <Descriptions.Item label="覆盖路段" span={3}>
                <Space size={4} wrap>
                  {selectedBatchDetail.batch.roads.map((r, i) => <Tag key={i}>{r}</Tag>)}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Tabs defaultActiveKey="faults">
              <Tabs.TabPane 
                tab={<Space><EnvironmentOutlined style={{ color: '#1677ff' }} />路线安排</Space>} 
                key="route"
              >
                {(() => {
                  const savedRoute = selectedBatchDetail.batch.routeOrder
                  const autoRoute = generateRoute(selectedBatchDetail)
                  const displayRoute = editedRoute.length > 0 ? editedRoute : (savedRoute && savedRoute.length > 0 ? savedRoute : autoRoute)
                  
                  const moveUp = (idx: number) => {
                    if (idx === 0) return
                    const newRoute = [...displayRoute]
                    ;[newRoute[idx - 1], newRoute[idx]] = [newRoute[idx], newRoute[idx - 1]]
                    setEditedRoute(newRoute.map((s, i) => ({ ...s, order: i + 1 })))
                  }
                  const moveDown = (idx: number) => {
                    if (idx === displayRoute.length - 1) return
                    const newRoute = [...displayRoute]
                    ;[newRoute[idx], newRoute[idx + 1]] = [newRoute[idx + 1], newRoute[idx]]
                    setEditedRoute(newRoute.map((s, i) => ({ ...s, order: i + 1 })))
                  }
                  const handleSaveRoute = () => {
                    saveBatchRoute(selectedBatchDetail.batch.id, displayRoute)
                    message.success('巡检路线已保存')
                  }

                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Space>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>排序依据：</span>
                          <Select
                            value={routeSortBy}
                            onChange={(v) => {
                              setRouteSortBy(v)
                              setEditedRoute([])
                            }}
                            style={{ width: 140 }}
                            size="small"
                          >
                            <Select.Option value="urgency">紧急程度优先</Select.Option>
                            <Select.Option value="faultCount">故障数量优先</Select.Option>
                            <Select.Option value="lampCount">路灯数量优先</Select.Option>
                          </Select>
                          <Tag color="blue">共 {displayRoute.length} 个路段</Tag>
                          {savedRoute && savedRoute.length > 0 && <Tag color="green">已保存路线</Tag>}
                        </Space>
                        <Space>
                          {editedRoute.length > 0 && (
                            <Button size="small" onClick={() => setEditedRoute([])}>
                              撤销调整
                            </Button>
                          )}
                          <Button type="primary" size="small" icon={<SaveOutlined />} onClick={handleSaveRoute}>
                            保存路线
                          </Button>
                        </Space>
                      </div>
                      
                      <List
                        size="small"
                        dataSource={displayRoute}
                        renderItem={(stop, idx) => (
                          <List.Item
                            style={{ 
                              padding: '10px 12px',
                              background: stop.urgency === 'high' ? '#fff2f0' : stop.urgency === 'medium' ? '#fff7e6' : '#f6ffed',
                              borderRadius: 6,
                              marginBottom: 4,
                              border: `1px solid ${stop.urgency === 'high' ? '#ffccc7' : stop.urgency === 'medium' ? '#ffe58f' : '#b7eb8f'}`
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: '#1677ff', color: '#fff', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                fontWeight: 600, fontSize: 14, flexShrink: 0
                              }}>
                                {stop.order}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontWeight: 500, fontSize: 13 }}>{stop.road}</span>
                                  <Tag color={stop.urgency === 'high' ? 'red' : stop.urgency === 'medium' ? 'orange' : 'green'}>
                                    {stop.urgency === 'high' ? '紧急' : stop.urgency === 'medium' ? '一般' : '常规'}
                                  </Tag>
                                </div>
                                <Space size={12} style={{ fontSize: 12, color: '#666' }}>
                                  <span><BulbOutlined /> 故障 {stop.faultCount}</span>
                                  <span><AlertOutlined /> 预警 {stop.alertCount}</span>
                                  <span><FileTextOutlined /> 工单 {stop.pendingOrderCount}</span>
                                </Space>
                              </div>
                              <Space direction="vertical" size={2}>
                                <Button size="small" icon={<ArrowUpOutlined />} onClick={() => moveUp(idx)} disabled={idx === 0} style={{ padding: '0 6px' }} />
                                <Button size="small" icon={<ArrowDownOutlined />} onClick={() => moveDown(idx)} disabled={idx === displayRoute.length - 1} style={{ padding: '0 6px' }} />
                              </Space>
                            </div>
                          </List.Item>
                        )}
                      />
                    </div>
                  )
                })()}
              </Tabs.TabPane>
              <Tabs.TabPane 
                tab={<Space><BulbOutlined style={{ color: '#ff4d4f' }} />故障灯具 ({selectedBatchDetail.faultLamps.length})</Space>} 
                key="faults"
              >
                {selectedBatchDetail.faultLamps.length === 0 ? (
                  <Empty description="暂无故障灯具" />
                ) : (
                  <Table
                    dataSource={selectedBatchDetail.faultLamps}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 5 }}
                    columns={[
                      { title: '灯具编号', dataIndex: 'code', key: 'code', width: 140, render: c => <span style={{ fontFamily: 'monospace' }}>{c}</span> },
                      { title: '路段', dataIndex: 'road', key: 'road' },
                      { title: '类型', dataIndex: 'type', key: 'type', render: t => <Tag>{t}</Tag> },
                      { title: '功率', dataIndex: 'power', key: 'power', render: p => `${p}W` },
                      { title: '故障类型', dataIndex: 'faultType', key: 'faultType', render: t => t || '未知' },
                      { title: '故障时间', dataIndex: 'faultTime', key: 'faultTime', render: t => t ? dayjs(t).format('MM-DD HH:mm') : '-' }
                    ]}
                  />
                )}
              </Tabs.TabPane>
              <Tabs.TabPane 
                tab={<Space><AlertOutlined style={{ color: '#faad14' }} />待处理预警 ({selectedBatchDetail.pendingAlerts.length})</Space>} 
                key="alerts"
              >
                {selectedBatchDetail.pendingAlerts.length === 0 ? (
                  <Empty description="暂无待处理预警" />
                ) : (
                  <Table
                    dataSource={selectedBatchDetail.pendingAlerts}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 5 }}
                    columns={[
                      { title: '预警级别', dataIndex: 'level', key: 'level', width: 100, render: l => <Tag color={l === 1 ? 'red' : l === 2 ? 'orange' : 'blue'}>{l}级</Tag> },
                      { title: '预警类型', dataIndex: 'type', key: 'type', width: 120, render: t => {
                        const map: Record<string, string> = { light_rate: '亮灯率异常', fault_timeout: '故障超时', energy_abnormal: '能耗异常', offline: '设备离线' }
                        return map[t] || t
                      }},
                      { title: '预警标题', dataIndex: 'title', key: 'title' },
                      { title: '位置', key: 'location', render: (_: any, r: Alert) => `${r.district} · ${r.road}` },
                      { title: '生成时间', dataIndex: 'createTime', key: 'createTime', render: t => dayjs(t).format('MM-DD HH:mm') }
                    ]}
                  />
                )}
              </Tabs.TabPane>
              <Tabs.TabPane 
                tab={<Space><FileTextOutlined style={{ color: '#1677ff' }} />未完成工单 ({selectedBatchDetail.pendingWorkOrders.length})</Space>} 
                key="workorders"
              >
                {selectedBatchDetail.pendingWorkOrders.length === 0 ? (
                  <Empty description="暂无未完成工单" />
                ) : (
                  <Table
                    dataSource={selectedBatchDetail.pendingWorkOrders}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 5 }}
                    columns={[
                      { title: '工单号', dataIndex: 'orderNo', key: 'orderNo', width: 140, render: n => <span style={{ fontFamily: 'monospace' }}>{n}</span> },
                      { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: t => typeTag(t) },
                      { title: '标题', dataIndex: 'title', key: 'title' },
                      { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, render: p => priorityTag(p) },
                      { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: s => statusTag(s) },
                      { title: '负责人', dataIndex: 'assignee', key: 'assignee', width: 90 }
                    ]}
                  />
                )}
              </Tabs.TabPane>
            </Tabs>
          </div>
        )}
      </Modal>

      <Modal
        title="新建巡检批次"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleAddBatch}
        okText="创建"
        width={600}
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item
            label="所属区域"
            name="district"
            rules={[{ required: true, message: '请选择区域' }]}
          >
            <Select placeholder="请选择区域">
              {districts.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item
            label="覆盖路段"
            name="roads"
            rules={[{ required: true, message: '请选择路段' }]}
          >
            <Select mode="multiple" placeholder="请选择路段">
              {roads.map(r => <Select.Option key={r} value={r}>{r}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item
            label="巡检日期"
            name="scheduleDate"
            rules={[{ required: true, message: '请选择巡检日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="巡检员"
            name="inspector"
            rules={[{ required: true, message: '请选择巡检员' }]}
          >
            <Select placeholder="请选择巡检员">
              {['张巡检', '李巡检', '王巡检', '赵巡检', '钱巡检', '孙巡检'].map(n => (
                <Select.Option key={n} value={n}>{n}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建工单"
        open={orderModalVisible}
        onCancel={() => setOrderModalVisible(false)}
        onOk={handleAddOrder}
        okText="创建"
        width={600}
      >
        <Form form={orderForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="工单类型"
                name="type"
                rules={[{ required: true, message: '请选择工单类型' }]}
              >
                <Select placeholder="请选择">
                  <Select.Option value="fault">故障维修</Select.Option>
                  <Select.Option value="inspection">巡检</Select.Option>
                  <Select.Option value="emergency">紧急抢修</Select.Option>
                  <Select.Option value="adjustment">调整优化</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="优先级"
                name="priority"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select placeholder="请选择">
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="urgent">紧急</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="工单标题"
            name="title"
            rules={[{ required: true, message: '请输入工单标题' }]}
          >
            <Input placeholder="请输入工单标题" />
          </Form.Item>
          <Form.Item
            label="问题描述"
            name="description"
            rules={[{ required: true, message: '请输入问题描述' }]}
          >
            <TextArea rows={3} placeholder="请详细描述问题情况" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="区域"
                name="district"
                rules={[{ required: true, message: '请选择区域' }]}
              >
                <Select placeholder="请选择区域">
                  {districts.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="路段"
                name="road"
                rules={[{ required: true, message: '请选择路段' }]}
              >
                <Select placeholder="请选择路段">
                  {roads.map(r => <Select.Option key={r} value={r}>{r}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="负责人"
                name="assignee"
                rules={[{ required: true, message: '请选择负责人' }]}
              >
                <Select placeholder="请选择负责人">
                  {['运维一组', '运维二组', '运维三组', '运维四组'].map(n => (
                    <Select.Option key={n} value={n}>{n}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
