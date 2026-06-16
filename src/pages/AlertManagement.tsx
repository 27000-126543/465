import { useState, useMemo } from 'react'
import {
  Row, Col, Card, Table, Tag, Space, Button, Modal, Form, Input,
  Select, Tabs, Timeline, Badge, Descriptions, message, Avatar, List
} from 'antd'
import {
  AlertOutlined, CheckOutlined, CloseOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, ThunderboltOutlined, ToolOutlined, BulbOutlined
} from '@ant-design/icons'
import { alerts, workOrders } from '@/data/mockData'
import type { Alert, WorkOrder } from '@/types'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Option } = Select

export default function AlertManagement() {
  const [activeTab, setActiveTab] = useState('alerts')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [approvalVisible, setApprovalVisible] = useState(false)
  const [approvalLevel, setApprovalLevel] = useState(1)
  const [form] = Form.useForm()

  const alertStats = useMemo(() => {
    const unhandled = alerts.filter(a => !a.isHandled)
    return {
      total: alerts.length,
      unhandled: unhandled.length,
      level1: unhandled.filter(a => a.level === 1).length,
      level2: unhandled.filter(a => a.level === 2).length,
      level3: unhandled.filter(a => a.level === 3).length
    }
  }, [])

  const orderStats = useMemo(() => {
    return {
      total: workOrders.length,
      pending: workOrders.filter(o => o.status === 'pending').length,
      processing: workOrders.filter(o => o.status === 'processing' || o.status === 'approved1').length,
      completed: workOrders.filter(o => o.status === 'completed').length
    }
  }, [])

  const alertTypeMap: Record<string, { text: string; color: string; icon: JSX.Element }> = {
    light_rate: { text: '亮灯率异常', color: 'red', icon: <BulbOutlined /> },
    fault_timeout: { text: '故障超时', color: 'orange', icon: <AlertOutlined /> },
    energy_abnormal: { text: '能耗异常', color: 'warning', icon: <ThunderboltOutlined /> },
    offline: { text: '设备离线', color: 'default', icon: <ToolOutlined /> }
  }

  const levelTag = (level: number) => {
    const colors = ['red', 'orange', 'blue']
    const texts = ['一级预警', '二级预警', '三级预警']
    return <Tag color={colors[level - 1]} icon={<ExclamationCircleOutlined />}>{texts[level - 1]}</Tag>
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

  const alertColumns = [
    {
      title: '预警级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: number) => levelTag(level)
    },
    {
      title: '预警类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const t = alertTypeMap[type]
        return <Tag color={t.color} icon={t.icon}>{t.text}</Tag>
      }
    },
    {
      title: '预警标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '位置',
      key: 'location',
      width: 150,
      render: (_: any, record: Alert) => (
        <span style={{ fontSize: 12, color: '#666' }}>
          {record.city} · {record.district}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'isHandled',
      key: 'isHandled',
      width: 80,
      render: (handled: boolean) => (
        handled ? <Tag color="success">已处理</Tag> : <Tag color="warning">待处理</Tag>
      )
    },
    {
      title: '生成时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 160,
      render: (t: string) => dayjs(t).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Alert) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => {
            setSelectedAlert(record)
            setDetailVisible(true)
          }}>详情</Button>
          {!record.isHandled && (
            <Button type="link" size="small" onClick={() => handleGenerateOrder(record)}>
              生成工单
            </Button>
          )}
        </Space>
      )
    }
  ]

  const orderColumns = [
    {
      title: '工单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 140,
      render: (no: string) => <span style={{ fontFamily: 'monospace' }}>{no}</span>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => {
        const map: Record<string, string> = {
          fault: '故障维修',
          inspection: '巡检',
          emergency: '紧急抢修',
          adjustment: '调整优化'
        }
        return <Tag>{map[type] || type}</Tag>
      }
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      render: (p: string) => priorityTag(p)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => statusTag(s)
    },
    {
      title: '位置',
      key: 'location',
      width: 130,
      render: (_: any, record: WorkOrder) => (
        <span style={{ fontSize: 12, color: '#666' }}>
          {record.district} · {record.road}
        </span>
      )
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 80
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 140,
      render: (t: string) => dayjs(t).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: WorkOrder) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => {
            setSelectedOrder(record)
            setDetailVisible(true)
          }}>详情</Button>
          {(record.status === 'pending' || record.status === 'processing' || record.status === 'approved1') && (
            <Button type="link" size="small" onClick={() => {
              setSelectedOrder(record)
              const level = record.status === 'pending' ? 1 : record.status === 'processing' ? 1 : 2
              setApprovalLevel(level)
              setApprovalVisible(true)
            }}>审批</Button>
          )}
        </Space>
      )
    }
  ]

  const handleGenerateOrder = (alert: Alert) => {
    message.success('已生成维修工单并推送至片区运维组长')
  }

  const handleApproval = () => {
    form.validateFields().then((values) => {
      console.log('审批提交:', values)
      message.success('审批提交成功')
      setApprovalVisible(false)
      form.resetFields()
    })
  }

  const approvalSteps = [
    { level: 1, title: '组长确认', role: '片区运维组长' },
    { level: 2, title: '区市政复核', role: '区市政管理局' },
    { level: 3, title: '市城管局批准', role: '市城市管理局' }
  ]

  const renderApprovalTimeline = (order: WorkOrder) => {
    const steps = approvalSteps
    const currentStep = order.status === 'completed' ? 3 :
      order.status === 'approved2' ? 2 :
      order.status === 'approved1' ? 1 : 0

    return (
      <Timeline
        items={steps.map((step, idx) => {
          const isDone = idx < currentStep || (idx === currentStep && order.approvalLog.length > idx)
          const log = order.approvalLog[idx]
          return {
            color: isDone ? 'green' : idx === currentStep ? 'blue' : 'gray',
            dot: isDone ? <CheckOutlined /> : <ClockCircleOutlined />,
            children: (
              <div>
                <div style={{ fontWeight: 500 }}>
                  {step.title}
                  <span style={{ color: '#999', fontWeight: 'normal', marginLeft: 8 }}>{step.role}</span>
                </div>
                {log ? (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                    <div>{log.approver} {log.action === 'approve' ? '已通过' : '已驳回'}</div>
                    <div>意见：{log.comment}</div>
                    <div>时间：{dayjs(log.time).format('MM-DD HH:mm')}</div>
                  </div>
                ) : idx === currentStep ? (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#1677ff' }}>待处理</div>
                ) : (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#ccc' }}>等待上一步</div>
                )}
              </div>
            )
          }
        })}
      />
    )
  }

  return (
    <div className="page-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="stat-card orange">
            <div className="stat-label">待处理预警</div>
            <div className="stat-value">{alertStats.unhandled}</div>
            <div className="stat-trend">
              <AlertOutlined /> 其中一级预警 {alertStats.level1} 条
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card blue">
            <div className="stat-label">待审批工单</div>
            <div className="stat-value">{orderStats.pending + orderStats.processing}</div>
            <div className="stat-trend">
              <ClockCircleOutlined /> 本月新增 {Math.floor(workOrders.length * 0.6)} 条
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card green">
            <div className="stat-label">本月完成率</div>
            <div className="stat-value">{Math.floor((orderStats.completed / orderStats.total) * 100)}%</div>
            <div className="stat-trend">
              <CheckOutlined /> 较上月提升 5.2%
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card">
            <div className="stat-label">平均响应时长</div>
            <div className="stat-value">2.8h</div>
            <div className="stat-trend">
              <ClockCircleOutlined /> 较上月缩短 0.6h
            </div>
          </div>
        </Col>
      </Row>

      <Card
        className="chart-card"
        tabList={[
          { key: 'alerts', tab: '预警管理' },
          { key: 'workorders', tab: '工单与审批' }
        ]}
        activeTabKey={activeTab}
        onTabChange={setActiveTab}
        extra={
          activeTab === 'alerts' ? (
            <Space>
              <Select defaultValue="all" style={{ width: 120 }} size="small">
                <Option value="all">全部级别</Option>
                <Option value="1">一级预警</Option>
                <Option value="2">二级预警</Option>
                <Option value="3">三级预警</Option>
              </Select>
              <Button type="primary" size="small">批量处理</Button>
            </Space>
          ) : (
            <Space>
              <Select defaultValue="all" style={{ width: 120 }} size="small">
                <Option value="all">全部状态</Option>
                <Option value="pending">待处理</Option>
                <Option value="processing">处理中</Option>
                <Option value="completed">已完成</Option>
              </Select>
              <Button type="primary" size="small">新建工单</Button>
            </Space>
          )
        }
      >
        {activeTab === 'alerts' ? (
          <Table
            columns={alertColumns}
            dataSource={alerts}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            size="middle"
          />
        ) : (
          <Table
            columns={orderColumns}
            dataSource={workOrders}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            size="middle"
          />
        )}
      </Card>

      <Modal
        title={selectedAlert ? '预警详情' : selectedOrder ? '工单详情' : ''}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedAlert && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="预警级别">{levelTag(selectedAlert.level)}</Descriptions.Item>
            <Descriptions.Item label="预警类型">
              {alertTypeMap[selectedAlert.type]?.text}
            </Descriptions.Item>
            <Descriptions.Item label="预警标题">{selectedAlert.title}</Descriptions.Item>
            <Descriptions.Item label="预警内容">{selectedAlert.content}</Descriptions.Item>
            <Descriptions.Item label="位置">
              {selectedAlert.province} · {selectedAlert.city} · {selectedAlert.district}
              {selectedAlert.road ? ` · ${selectedAlert.road}` : ''}
            </Descriptions.Item>
            {selectedAlert.value !== undefined && (
              <Descriptions.Item label="相关指标">
                当前值：{selectedAlert.value}，阈值：{selectedAlert.threshold}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="生成时间">{selectedAlert.createTime}</Descriptions.Item>
            <Descriptions.Item label="处理状态">
              {selectedAlert.isHandled ? (
                <Tag color="success">已处理 · {selectedAlert.handler} · {selectedAlert.handledTime}</Tag>
              ) : (
                <Tag color="warning">待处理</Tag>
              )}
            </Descriptions.Item>
            {selectedAlert.workOrderId && (
              <Descriptions.Item label="关联工单">{selectedAlert.workOrderId}</Descriptions.Item>
            )}
          </Descriptions>
        )}

        {selectedOrder && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="工单号">{selectedOrder.orderNo}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(selectedOrder.status)}</Descriptions.Item>
              <Descriptions.Item label="类型">
                {{ fault: '故障维修', inspection: '巡检', emergency: '紧急抢修', adjustment: '调整优化' }[selectedOrder.type]}
              </Descriptions.Item>
              <Descriptions.Item label="优先级">{priorityTag(selectedOrder.priority)}</Descriptions.Item>
              <Descriptions.Item label="标题" span={2}>{selectedOrder.title}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{selectedOrder.description}</Descriptions.Item>
              <Descriptions.Item label="位置">
                {selectedOrder.district} · {selectedOrder.road}
              </Descriptions.Item>
              <Descriptions.Item label="负责人">{selectedOrder.assignee}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{selectedOrder.createTime}</Descriptions.Item>
              <Descriptions.Item label="上报人">{selectedOrder.reporter}</Descriptions.Item>
              {selectedOrder.cost !== undefined && (
                <Descriptions.Item label="维修费用">¥{selectedOrder.cost.toLocaleString()}</Descriptions.Item>
              )}
              {selectedOrder.repairTime !== undefined && (
                <Descriptions.Item label="维修时长">{selectedOrder.repairTime}小时</Descriptions.Item>
              )}
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 12 }}>三级审批流程</div>
              {renderApprovalTimeline(selectedOrder)}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={`审批 - ${approvalLevel === 1 ? '组长确认' : approvalLevel === 2 ? '区市政复核' : '市城管局批准'}`}
        open={approvalVisible}
        onOk={handleApproval}
        onCancel={() => setApprovalVisible(false)}
        okText="通过"
        cancelText="驳回"
        okButtonProps={{ type: 'primary' }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="comment"
            label="审批意见"
            rules={[{ required: true, message: '请输入审批意见' }]}
          >
            <TextArea rows={4} placeholder="请输入审批意见..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
