import { useState, useMemo } from 'react'
import {
  Row, Col, Card, Table, Tag, Space, Button, Modal, Form, Input,
  Select, Tabs, Timeline, Badge, Descriptions, message, Typography, Radio
} from 'antd'
import type { RadioChangeEvent } from 'antd'
import {
  AlertOutlined, CheckOutlined, CloseOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, ThunderboltOutlined, ToolOutlined, BulbOutlined
} from '@ant-design/icons'
import { useDataStore } from '@/store/dataStore'
import type { Alert, WorkOrder, ApprovalLog, AlertHandlingResult } from '@/types'
import dayjs from 'dayjs'

const { TextArea } = Input

export default function AlertManagement() {
  const {
    currentUser,
    filteredAlerts,
    filteredWorkOrders,
    alertFilters,
    setAlertFilters,
    workOrderFilters,
    setWorkOrderFilters,
    handleAlert,
    addWorkOrder,
    updateWorkOrderStatus
  } = useDataStore()

  const [activeTab, setActiveTab] = useState('alerts')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [approvalVisible, setApprovalVisible] = useState(false)
  const [approvalLevel, setApprovalLevel] = useState(1)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')
  const [form] = Form.useForm()

  const alertStats = useMemo(() => {
    const unhandled = filteredAlerts.filter(a => !a.isHandled)
    return {
      total: filteredAlerts.length,
      unhandled: unhandled.length,
      level1: unhandled.filter(a => a.level === 1).length,
      level2: unhandled.filter(a => a.level === 2).length,
      level3: unhandled.filter(a => a.level === 3).length
    }
  }, [filteredAlerts])

  const orderStats = useMemo(() => {
    return {
      total: filteredWorkOrders.length,
      pending: filteredWorkOrders.filter(o => o.status === 'pending').length,
      processing: filteredWorkOrders.filter(o => o.status === 'processing' || o.status === 'approved1').length,
      completed: filteredWorkOrders.filter(o => o.status === 'completed').length
    }
  }, [filteredWorkOrders])

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

  const handlingResultTag = (result?: AlertHandlingResult, comment?: string) => {
    const map: Record<string, { text: string; color: string }> = {
      pending: { text: '待处理', color: 'warning' },
      processing: { text: '处理中', color: 'processing' },
      completed: { text: '已完成', color: 'success' },
      rejected: { text: '已驳回', color: 'error' }
    }
    if (!result) return null
    const r = map[result] || { text: result, color: 'default' }
    return (
      <Space direction="vertical" size={4}>
        <Tag color={r.color}>{r.text}</Tag>
        {comment && <div style={{ fontSize: 12, color: '#666' }}>处理意见：{comment}</div>}
      </Space>
    )
  }

  const alertColumns = [
    {
      title: '预警级别', dataIndex: 'level', key: 'level', width: 110,
      render: (level: number) => levelTag(level)
    },
    {
      title: '预警类型', dataIndex: 'type', key: 'type', width: 120,
      render: (type: string) => {
        const t = alertTypeMap[type]
        return <Tag color={t.color} icon={t.icon}>{t.text}</Tag>
      }
    },
    { title: '预警标题', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: '位置', key: 'location', width: 160,
      render: (_: any, record: Alert) => (
        <span style={{ fontSize: 12, color: '#666' }}>{record.city} · {record.district}</span>
      )
    },
    {
      title: '关联工单', dataIndex: 'workOrderId', key: 'workOrderId', width: 130,
      render: (id?: string) => id ? <Tag color="blue">{id}</Tag> : <Tag color="default">未生成</Tag>
    },
    {
      title: '状态', key: 'isHandled', width: 100,
      render: (_: any, record: Alert) => {
        if (record.handlingResult) {
          return handlingResultTag(record.handlingResult)
        }
        return record.isHandled ? <Tag color="success">已处理</Tag> : <Tag color="warning">待处理</Tag>
      }
    },
    {
      title: '生成时间', dataIndex: 'createTime', key: 'createTime', width: 140,
      render: (t: string) => dayjs(t).format('MM-DD HH:mm')
    },
    {
      title: '操作', key: 'action', width: 180,
      render: (_: any, record: Alert) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => { setSelectedAlert(record); setSelectedOrder(null); setDetailVisible(true) }}>详情</Button>
          {!record.isHandled && (
            <Button type="primary" size="small" onClick={() => handleGenerateOrder(record)}>
              生成工单
            </Button>
          )}
        </Space>
      )
    }
  ]

  const orderColumns = [
    {
      title: '工单号', dataIndex: 'orderNo', key: 'orderNo', width: 150,
      render: (no: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{no}</span>
    },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 90,
      render: (type: string) => {
        const map: Record<string, string> = { fault: '故障维修', inspection: '巡检', emergency: '紧急抢修', adjustment: '调整优化' }
        return <Tag>{map[type] || type}</Tag>
      }
    },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 70, render: (p: string) => priorityTag(p) },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: (s: string) => statusTag(s) },
    {
      title: '位置', key: 'location', width: 140,
      render: (_: any, record: WorkOrder) => (
        <span style={{ fontSize: 12, color: '#666' }}>{record.district} · {record.road}</span>
      )
    },
    { title: '负责人', dataIndex: 'assignee', key: 'assignee', width: 90 },
    {
      title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 130,
      render: (t: string) => dayjs(t).format('MM-DD HH:mm')
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, record: WorkOrder) => {
        const canApprove = ['pending', 'processing', 'approved1', 'approved2'].includes(record.status)
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => { setSelectedOrder(record); setSelectedAlert(null); setDetailVisible(true) }}>详情</Button>
            {canApprove && (
              <Button type="primary" size="small" onClick={() => {
                setSelectedOrder(record)
                setSelectedAlert(null)
                const level = record.status === 'pending' || record.status === 'processing' ? 1 :
                  record.status === 'approved1' ? 2 : 3
                setApprovalLevel(level)
                setApprovalAction('approve')
                setApprovalVisible(true)
              }}>
                {record.status === 'pending' || record.status === 'processing' ? '组长确认' :
                  record.status === 'approved1' ? '区市政复核' : '市城管局批准'}
              </Button>
            )}
          </Space>
        )
      }
    }
  ]

  const handleGenerateOrder = (alert: Alert) => {
    if (!currentUser) return
    const newOrder = addWorkOrder({
      type: 'emergency',
      title: `【${alertTypeMap[alert.type].text}】${alert.title}`,
      description: `${alert.content}\n\n关联预警ID: ${alert.id}`,
      priority: 'urgent',
      reporter: currentUser.name,
      assignee: '运维一组',
      district: alert.district,
      road: alert.road || alert.district,
      province: alert.province,
      city: alert.city
    })
    handleAlert(alert.id, currentUser.name, newOrder.id)
    message.success(`已生成工单 ${newOrder.orderNo} 并推送至片区运维组长`)
    setActiveTab('workorders')
  }

  const handleApproval = (action: 'approve' | 'reject' = approvalAction) => {
    form.validateFields().then((values) => {
      if (!selectedOrder || !currentUser) return
      const success = updateWorkOrderStatus(
        selectedOrder.id,
        action,
        approvalLevel,
        currentUser.name,
        values.comment
      )
      if (success) {
        message.success(action === 'approve' ? '审批通过' : '已驳回')
        setApprovalVisible(false)
        form.resetFields()
        setApprovalAction('approve')
      } else {
        message.error('审批失败，当前状态不匹配')
      }
    })
  }

  const approvalSteps = [
    { level: 1, title: '组长确认', role: '片区运维组长' },
    { level: 2, title: '区市政复核', role: '区市政管理局' },
    { level: 3, title: '市城管局批准', role: '市城市管理局' }
  ]

  const getCurrentStep = (status: string) => {
    if (status === 'completed' || status === 'rejected') return 3
    if (status === 'approved2') return 2
    if (status === 'approved1') return 1
    return 0
  }

  const renderApprovalTimeline = (order: WorkOrder) => {
    const steps = approvalSteps
    const currentStep = getCurrentStep(order.status)

    return (
      <Timeline
        items={steps.map((step, idx) => {
          const isDone = idx < currentStep || (idx === currentStep && order.approvalLog.length > idx)
          const isCurrent = idx === currentStep && !isDone
          const log: ApprovalLog | undefined = order.approvalLog[idx]
          const isRejected = log?.action === 'reject'
          return {
            color: isRejected ? 'red' : isDone ? 'green' : isCurrent ? 'blue' : 'gray',
            dot: isRejected ? <CloseOutlined /> : isDone ? <CheckOutlined /> : <ClockCircleOutlined />,
            children: (
              <div>
                <div style={{ fontWeight: 500 }}>
                  {step.title}
                  <span style={{ color: '#999', fontWeight: 'normal', marginLeft: 8 }}>{step.role}</span>
                  {isCurrent && <Tag color="blue" style={{ marginLeft: 8 }}>当前待办</Tag>}
                </div>
                {log ? (
                  <div style={{ marginTop: 4, fontSize: 12, color: isRejected ? '#ff4d4f' : '#666' }}>
                    <div>{log.approver} {log.action === 'approve' ? '已通过' : '已驳回'}</div>
                    <div>意见：{log.comment}</div>
                    <div>时间：{dayjs(log.time).format('MM-DD HH:mm')}</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 4, fontSize: 12, color: isCurrent ? '#1677ff' : '#ccc' }}>
                    {isCurrent ? '待处理' : '等待上一步'}
                  </div>
                )}
              </div>
            )
          }
        })}
      />
    )
  }

  const levelText = currentUser?.level === 'national' ? '全国' :
    currentUser?.level === 'provincial' ? currentUser.province :
    currentUser?.level === 'municipal' ? currentUser.city : ''

  return (
    <div className="page-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="stat-card orange">
            <div className="stat-label">待处理预警</div>
            <div className="stat-value">{alertStats.unhandled}</div>
            <div className="stat-trend">
              <AlertOutlined /> 一级预警 {alertStats.level1} 条
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card blue">
            <div className="stat-label">待审批工单</div>
            <div className="stat-value">{orderStats.pending + orderStats.processing}</div>
            <div className="stat-trend">
              <ClockCircleOutlined /> 本月新增 {Math.floor(filteredWorkOrders.length * 0.6)} 条
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card green">
            <div className="stat-label">本月完成率</div>
            <div className="stat-value">{orderStats.total > 0 ? Math.floor((orderStats.completed / orderStats.total) * 100) : 0}%</div>
            <div className="stat-trend">
              <CheckOutlined /> {orderStats.completed} / {orderStats.total} 单
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card">
            <div className="stat-label">当前范围</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{levelText}</div>
            <div className="stat-trend">
              <Tag color="blue">按权限自动过滤</Tag>
            </div>
          </div>
        </Col>
      </Row>

      <Card
        className="chart-card"
        tabList={[
          { key: 'alerts', tab: `预警管理 (${alertStats.unhandled}待处理)` },
          { key: 'workorders', tab: `工单与审批 (${orderStats.pending + orderStats.processing}待审批)` }
        ]}
        activeTabKey={activeTab}
        onTabChange={setActiveTab}
        extra={
          activeTab === 'alerts' ? (
            <Space>
              <Select
                value={alertFilters.level}
                onChange={(v) => setAlertFilters({ level: v })}
                style={{ width: 110 }}
                size="small"
              >
                <option value="all">全部级别</option>
                <option value="1">一级预警</option>
                <option value="2">二级预警</option>
                <option value="3">三级预警</option>
              </Select>
              <Select
                value={alertFilters.type}
                onChange={(v) => setAlertFilters({ type: v as any })}
                style={{ width: 130 }}
                size="small"
              >
                <option value="all">全部类型</option>
                <option value="light_rate">亮灯率异常</option>
                <option value="fault_timeout">故障超时</option>
                <option value="energy_abnormal">能耗异常</option>
                <option value="offline">设备离线</option>
              </Select>
              <Select
                value={alertFilters.handled}
                onChange={(v) => setAlertFilters({ handled: v as any })}
                style={{ width: 110 }}
                size="small"
              >
                <option value="all">全部状态</option>
                <option value="no">待处理</option>
                <option value="yes">已处理</option>
              </Select>
              <Button type="primary" size="small">批量处理</Button>
            </Space>
          ) : (
            <Space>
              <Select
                value={workOrderFilters.status}
                onChange={(v) => setWorkOrderFilters({ status: v })}
                style={{ width: 110 }}
                size="small"
              >
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="processing">处理中</option>
                <option value="completed">已完成</option>
                <option value="rejected">已驳回</option>
              </Select>
              <Select
                value={workOrderFilters.type}
                onChange={(v) => setWorkOrderFilters({ type: v })}
                style={{ width: 110 }}
                size="small"
              >
                <option value="all">全部类型</option>
                <option value="fault">故障维修</option>
                <option value="inspection">巡检</option>
                <option value="emergency">紧急抢修</option>
              </Select>
            </Space>
          )
        }
      >
        {activeTab === 'alerts' ? (
          <Table
            columns={alertColumns}
            dataSource={filteredAlerts}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            size="middle"
            scroll={{ x: 1100 }}
          />
        ) : (
          <Table
            columns={orderColumns}
            dataSource={filteredWorkOrders}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            size="middle"
            scroll={{ x: 1200 }}
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
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="预警级别">{levelTag(selectedAlert.level)}</Descriptions.Item>
              <Descriptions.Item label="预警类型">{alertTypeMap[selectedAlert.type]?.text}</Descriptions.Item>
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
                {selectedAlert.handlingResult ? (
                handlingResultTag(selectedAlert.handlingResult, selectedAlert.handlingComment)
              ) : selectedAlert.isHandled ? (
                <Tag color="success">已处理 · {selectedAlert.handler} · {selectedAlert.handledTime}</Tag>
              ) : (
                <Tag color="warning">待处理</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          {selectedAlert.workOrderId && (() => {
            const relatedOrder = filteredWorkOrders.find(o => o.id === selectedAlert.workOrderId)
            return relatedOrder ? (
              <Card 
                title={<Space><Tag color="blue">关联工单</Tag><span style={{ fontFamily: 'monospace' }}>{relatedOrder.orderNo}</span></Space>}
                size="small"
                style={{ marginTop: 16 }}
              >
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="工单状态">{statusTag(relatedOrder.status)}</Descriptions.Item>
                  <Descriptions.Item label="工单类型">
                    {{ fault: '故障维修', inspection: '巡检', emergency: '紧急抢修', adjustment: '调整优化' }[relatedOrder.type]}
                  </Descriptions.Item>
                  <Descriptions.Item label="负责人">{relatedOrder.assignee}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">{relatedOrder.createTime}</Descriptions.Item>
                </Descriptions>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>审批进度</div>
                  {renderApprovalTimeline(relatedOrder)}
                </div>
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <Button 
                    type="link" 
                    size="small"
                    onClick={() => { setSelectedOrder(relatedOrder); setSelectedAlert(null) }}
                  >
                    查看完整工单详情 →
                  </Button>
                </div>
              </Card>
            ) : (
              <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item label="关联工单">
                  <Tag color="blue">{selectedAlert.workOrderId}</Tag>
                  <span style={{ color: '#999', marginLeft: 8 }}>（暂无详情）</span>
                </Descriptions.Item>
              </Descriptions>
            )
          })()}
        </div>
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
        onCancel={() => setApprovalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setApprovalVisible(false)}>
            取消
          </Button>,
          <Button key="reject" danger onClick={() => handleApproval('reject')}>
            驳回
          </Button>,
          <Button key="submit" type="primary" onClick={() => handleApproval('approve')}>
            通过
          </Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="审批操作" required>
            <Radio.Group
              value={approvalAction}
              onChange={(e: RadioChangeEvent) => setApprovalAction(e.target.value as 'approve' | 'reject')}
            >
              <Radio.Button value="approve">同意通过</Radio.Button>
              <Radio.Button value="reject" style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }}>驳回</Radio.Button>
            </Radio.Group>
          </Form.Item>
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
