import { useState, useMemo } from 'react'
import {
  Row, Col, Card, Table, Tag, Space, Button, Progress, Tabs,
  Select, DatePicker, Modal, Form, Input, message, Tooltip, Statistic, List
} from 'antd'
import {
  ToolOutlined, CheckCircleOutlined, ClockCircleOutlined,
  WarningOutlined, FileTextOutlined, TeamOutlined, DollarOutlined,
  SearchOutlined, PlusOutlined, ExclamationCircleOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { workOrders, inspectionBatches, streetLamps } from '@/data/mockData'
import type { WorkOrder, InspectionBatch } from '@/types'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { TextArea } = Input

export default function OperationsManagement() {
  const [activeTab, setActiveTab] = useState('workorders')
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [orderModalVisible, setOrderModalVisible] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null)
  const [form] = Form.useForm()

  const workOrderStats = useMemo(() => {
    const completed = workOrders.filter(o => o.status === 'completed')
    const totalCost = completed.reduce((s, o) => s + (o.cost || 0), 0)
    const avgResponse = workOrders.filter(o => o.responseTime).reduce((s, o) => s + (o.responseTime || 0), 0) / (completed.length || 1)
    const avgRepair = completed.reduce((s, o) => s + (o.repairTime || 0), 0) / (completed.length || 1)
    return {
      total: workOrders.length,
      completed: completed.length,
      completionRate: Number(((completed.length / workOrders.length) * 100).toFixed(1)),
      totalCost,
      avgResponseTime: Number(avgResponse.toFixed(1)),
      avgRepairTime: Number(avgRepair.toFixed(1))
    }
  }, [])

  const typeStats = useMemo(() => {
    const types = ['fault', 'inspection', 'emergency', 'adjustment']
    return types.map(t => ({
      type: t,
      count: workOrders.filter(o => o.type === t).length,
      completed: workOrders.filter(o => o.type === t && o.status === 'completed').length
    }))
  }, [])

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
          data: [45, 52, 38, 61, 48, 55, 42, 50],
          itemStyle: { color: '#1677ff' },
          barWidth: 18
        },
        {
          name: '完成工单',
          type: 'bar',
          data: [40, 48, 36, 55, 45, 52, 40, 46],
          itemStyle: { color: '#52c41a' },
          barWidth: 18
        }
      ]
    }
  }, [])

  const costTrendOption = useMemo(() => {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月']
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['维修成本', '耗材成本', '人工成本'], top: 0 },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: months },
      yAxis: { type: 'value', name: '万元' },
      series: [
        {
          name: '维修成本',
          type: 'line',
          stack: 'total',
          data: [8.5, 9.2, 7.8, 10.5, 9.8, 11.2],
          areaStyle: { opacity: 0.3 },
          smooth: true
        },
        {
          name: '耗材成本',
          type: 'line',
          stack: 'total',
          data: [4.2, 4.8, 4.0, 5.5, 5.0, 5.8],
          areaStyle: { opacity: 0.3 },
          smooth: true
        },
        {
          name: '人工成本',
          type: 'line',
          stack: 'total',
          data: [6.5, 7.0, 6.2, 8.0, 7.5, 8.5],
          areaStyle: { opacity: 0.3 },
          smooth: true
        }
      ]
    }
  }, [])

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
        {
          name: '完成量',
          type: 'bar',
          data: [42, 38, 45, 36, 40],
          itemStyle: { color: '#1677ff' },
          barWidth: 14
        },
        {
          name: '一次修复率',
          type: 'line',
          data: [92, 88, 95, 86, 90],
          itemStyle: { color: '#52c41a' }
        },
        {
          name: '平均响应(h)',
          type: 'line',
          yAxisIndex: 1,
          data: [2.5, 3.2, 2.0, 3.8, 2.8],
          itemStyle: { color: '#faad14' }
        }
      ]
    }
  }, [])

  const typeTag = (type: string) => {
    const map: Record<string, { text: string; color: string; icon: JSX.Element }> = {
      fault: { text: '故障维修', color: 'red', icon: <WarningOutlined /> },
      inspection: { text: '巡检', color: 'blue', icon: <FileTextOutlined /> },
      emergency: { text: '紧急抢修', color: 'orange', icon: <ExclamationCircleOutlined /> },
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
    {
      title: '工单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 150,
      render: (no: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{no}</span>
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (t: string) => typeTag(t) },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 70, render: (p: string) => priorityTag(p) },
    { title: '状态', dataIndex: 'status', key: 'status', width: 110, render: (s: string) => statusTag(s) },
    {
      title: '位置',
      key: 'location',
      width: 160,
      render: (_: any, r: WorkOrder) => (
        <span style={{ fontSize: 12, color: '#666' }}>{r.district} · {r.road}</span>
      )
    },
    { title: '负责人', dataIndex: 'assignee', key: 'assignee', width: 90 },
    {
      title: '响应时长',
      dataIndex: 'responseTime',
      key: 'responseTime',
      width: 90,
      render: (t?: number) => t ? `${t}h` : '-'
    },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      width: 90,
      render: (c?: number) => c ? `¥${c}` : '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 140,
      render: (t: string) => dayjs(t).format('MM-DD HH:mm')
    }
  ]

  const batchColumns = [
    {
      title: '批次号',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 140,
      render: (no: string) => <span style={{ fontFamily: 'monospace' }}>{no}</span>
    },
    {
      title: '区域',
      key: 'location',
      width: 140,
      render: (_: any, r: InspectionBatch) => (
        <span>{r.district}</span>
      )
    },
    {
      title: '覆盖路段',
      dataIndex: 'roads',
      key: 'roads',
      render: (roads: string[]) => (
        <Space size={4} wrap>
          {roads.map((r, i) => <Tag key={i}>{r}</Tag>)}
        </Space>
      )
    },
    { title: '路灯数', dataIndex: 'lampCount', key: 'lampCount', width: 80, render: (n: number) => `${n}盏` },
    { title: '计划日期', dataIndex: 'scheduleDate', key: 'scheduleDate', width: 110 },
    { title: '巡检员', dataIndex: 'inspector', key: 'inspector', width: 90 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => batchStatusTag(s) }
  ]

  const districtStats = useMemo(() => {
    const districts = new Set(streetLamps.map(l => l.district))
    return Array.from(districts).map(d => {
      const lamps = streetLamps.filter(l => l.district === d)
      const faults = lamps.filter(l => l.status === 'fault').length
      return {
        name: d,
        total: lamps.length,
        fault: faults,
        faultRate: Number(((faults / lamps.length) * 100).toFixed(2)),
        normal: lamps.filter(l => l.status === 'normal').length
      }
    }).sort((a, b) => b.faultRate - a.faultRate)
  }, [])

  return (
    <div className="page-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="stat-card">
            <div className="stat-label">本月工单总数</div>
            <div className="stat-value">{workOrderStats.total}</div>
            <div className="stat-trend">
              完成率 {workOrderStats.completionRate}%
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
              dataSource={typeStats}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={typeTag(item.type)}
                    description={`共${item.count}单，完成${item.completed}单`}
                  />
                  <Progress
                    type="dashboard"
                    percent={Math.round((item.completed / item.count) * 100)}
                    width={50}
                    size="small"
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} lg={8}>
          <Card title="各区域故障率" className="chart-card">
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
          { key: 'workorders', tab: '工单管理' },
          { key: 'inspection', tab: '巡检批次' }
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
                <Button size="small" icon={<PlusOutlined />} onClick={() => setOrderModalVisible(true)}>新建工单</Button>
              </>
            ) : (
              <>
                <Select defaultValue="all" style={{ width: 110 }} size="small">
                  <option value="all">全部状态</option>
                  <option value="pending">待执行</option>
                  <option value="in_progress">进行中</option>
                  <option value="completed">已完成</option>
                </Select>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setBatchModalVisible(true)}>新建批次</Button>
              </>
            )}
          </Space>
        }
      >
        {activeTab === 'workorders' ? (
          <Table
            columns={workOrderColumns}
            dataSource={workOrders}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            size="middle"
            scroll={{ x: 1200 }}
          />
        ) : (
          <Table
            columns={batchColumns}
            dataSource={inspectionBatches}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            size="middle"
            scroll={{ x: 1000 }}
          />
        )}
      </Card>

      <Modal
        title="新建巡检批次"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={() => {
          message.success('巡检批次创建成功')
          setBatchModalVisible(false)
        }}
        okText="创建"
      >
        <Form layout="vertical">
          <Form.Item label="所属区域" required>
            <Select placeholder="请选择区域">
              <option value="南山区">南山区</option>
              <option value="福田区">福田区</option>
              <option value="罗湖区">罗湖区</option>
              <option value="宝安区">宝安区</option>
            </Select>
          </Form.Item>
          <Form.Item label="覆盖路段" required>
            <Select mode="multiple" placeholder="请选择路段" />
          </Form.Item>
          <Form.Item label="巡检日期" required>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="巡检员" required>
            <Select placeholder="请选择巡检员">
              <option value="张巡检">张巡检</option>
              <option value="李巡检">李巡检</option>
              <option value="王巡检">王巡检</option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建工单"
        open={orderModalVisible}
        onCancel={() => setOrderModalVisible(false)}
        onOk={() => {
          message.success('工单创建成功')
          setOrderModalVisible(false)
        }}
        okText="创建"
        width={600}
      >
        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="工单类型" required>
                <Select placeholder="请选择">
                  <option value="fault">故障维修</option>
                  <option value="inspection">巡检</option>
                  <option value="emergency">紧急抢修</option>
                  <option value="adjustment">调整优化</option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="优先级" required>
                <Select placeholder="请选择">
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="urgent">紧急</option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="工单标题" required>
            <Input placeholder="请输入工单标题" />
          </Form.Item>
          <Form.Item label="问题描述" required>
            <TextArea rows={3} placeholder="请详细描述问题情况" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="区域" required>
                <Select placeholder="请选择区域" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="路段" required>
                <Select placeholder="请选择路段" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="负责人">
                <Select placeholder="请选择负责人">
                  <option value="运维一组">运维一组</option>
                  <option value="运维二组">运维二组</option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
