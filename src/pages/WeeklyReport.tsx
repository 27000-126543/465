import { useMemo } from 'react'
import {
  Row, Col, Card, Tag, Space, Button, Progress, Descriptions,
  List, Statistic, Tabs, Table, Typography, Divider
} from 'antd'
import {
  ArrowUpOutlined, ArrowDownOutlined, FileTextOutlined,
  BulbOutlined, ThunderboltOutlined, AlertOutlined, ClockCircleOutlined,
  DollarOutlined, RiseOutlined, FallOutlined, CheckCircleOutlined,
  ToolOutlined, CalendarOutlined, StarOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { weeklyReport as mockWeeklyReport, faultTypeDistribution } from '@/data/mockData'
import { useDataStore } from '@/store/dataStore'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

const { Title, Text, Paragraph } = Typography

const TrendIndicator = ({ value, unit = '%', good = 'up' }: { value: number; unit?: string; good?: 'up' | 'down' }) => {
  const isGood = good === 'up' ? value > 0 : value < 0
  const isZero = value === 0
  return (
    <span style={{ color: isZero ? '#999' : isGood ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
      {isZero ? '—' : value > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
      {!isZero && ` ${Math.abs(value)}${unit}`}
    </span>
  )
}

export default function WeeklyReport() {
  const {
    currentUser,
    filteredLamps,
    filteredEnergyData,
    filteredWorkOrders,
    filteredProvinces,
    getFilteredStats
  } = useDataStore()

  const stats = getFilteredStats()

  const levelText = useMemo(() => {
    if (!currentUser) return '全国范围'
    if (currentUser.level === 'national') return '全国范围'
    if (currentUser.level === 'provincial') return `${currentUser.province}范围`
    if (currentUser.level === 'municipal') return `${currentUser.province} ${currentUser.city}范围`
    return '全国范围'
  }, [currentUser])

  const report = useMemo(() => {
    const lamps = filteredLamps
    const orders = filteredWorkOrders
    const energyData = filteredEnergyData
    const provs = filteredProvinces

    let lightRate = stats.avgLightRate
    let avgSaving = stats.avgSavingRate
    let faultRate = stats.avgFaultRate
    let avgResponse = stats.avgResponseTime
    let totalCost = 0

    if (provs.length > 0) {
      let totalLamps = 0
      let totalLight = 0
      let totalSaving = 0
      let totalFault = 0
      let totalResponse = 0
      let cityCount = 0

      provs.forEach(p => {
        p.cities.forEach(c => {
          totalLamps += c.totalLamps
          totalLight += c.lightRate
          totalSaving += c.energySavingRate
          totalFault += c.faultRate
          totalResponse += c.avgResponseTime
          cityCount++
        })
      })

      if (cityCount > 0) {
        lightRate = Number((totalLight / cityCount).toFixed(1))
        avgSaving = Number((totalSaving / cityCount).toFixed(1))
        faultRate = Number((totalFault / cityCount).toFixed(1))
        avgResponse = Number((totalResponse / cityCount).toFixed(1))
      }
    }

    orders.forEach(o => {
      totalCost += o.cost || 0
    })

    return {
      weekStart: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
      weekEnd: dayjs().format('YYYY-MM-DD'),
      lightRate,
      energySavingRate: Number(avgSaving.toFixed(1)),
      faultRate,
      avgResponseTime: Number(avgResponse.toFixed(1)),
      totalRepairCost: totalCost,
      lightRateYoY: mockWeeklyReport.lightRateYoY,
      lightRateWoW: mockWeeklyReport.lightRateWoW * (Math.random() > 0.5 ? 1 : -1),
      energySavingRateYoY: mockWeeklyReport.energySavingRateYoY,
      energySavingRateWoW: mockWeeklyReport.energySavingRateWoW * (Math.random() > 0.5 ? 1 : -1),
      faultRateYoY: mockWeeklyReport.faultRateYoY,
      faultRateWoW: mockWeeklyReport.faultRateWoW * (Math.random() > 0.5 ? 1 : -1),
      avgResponseTimeYoY: mockWeeklyReport.avgResponseTimeYoY,
      avgResponseTimeWoW: mockWeeklyReport.avgResponseTimeWoW * (Math.random() > 0.5 ? 1 : -1),
      repairCostWoW: mockWeeklyReport.repairCostWoW,
      optimizationSuggestions: mockWeeklyReport.optimizationSuggestions,
      retrofitPlan: mockWeeklyReport.retrofitPlan
    }
  }, [filteredLamps, filteredWorkOrders, filteredEnergyData, filteredProvinces, stats])

  const radarOption = useMemo(() => {
    return {
      tooltip: {},
      legend: { data: ['本周', '上周', '去年同期'], top: 0 },
      radar: {
        indicator: [
          { name: '亮灯率', max: 100 },
          { name: '节能率', max: 100 },
          { name: '故障率', max: 10 },
          { name: '响应速度', max: 10 },
          { name: '成本控制', max: 100 },
          { name: '一次修复率', max: 100 }
        ],
        center: ['50%', '55%'],
        radius: '65%'
      },
      series: [{
        type: 'radar',
        data: [
          {
            value: [report.lightRate, report.energySavingRate, 10 - report.faultRate, 10 - report.avgResponseTime, 85, 92],
            name: '本周',
            areaStyle: { opacity: 0.2 },
            lineStyle: { color: '#1677ff' },
            itemStyle: { color: '#1677ff' }
          },
          {
            value: [report.lightRate - report.lightRateWoW, report.energySavingRate - report.energySavingRateWoW, 10 - (report.faultRate - report.faultRateWoW), 10 - (report.avgResponseTime - report.avgResponseTimeWoW), 82, 88],
            name: '上周',
            areaStyle: { opacity: 0.1 },
            lineStyle: { color: '#faad14' },
            itemStyle: { color: '#faad14' }
          },
          {
            value: [report.lightRate - report.lightRateYoY, report.energySavingRate - report.energySavingRateYoY, 10 - (report.faultRate - report.faultRateYoY), 10 - (report.avgResponseTime - report.avgResponseTimeYoY), 78, 84],
            name: '去年同期',
            areaStyle: { opacity: 0.05 },
            lineStyle: { color: '#999', type: 'dashed' },
            itemStyle: { color: '#999' }
          }
        ]
      }]
    }
  }, [report])

  const compareOption = useMemo(() => {
    const categories = ['亮灯率', '节能率', '故障率', '响应时长(h)', '单灯成本(元)']
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['上周', '本周', '去年同期'], top: 0 },
      grid: { left: 80, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: categories },
      series: [
        {
          name: '上周',
          type: 'bar',
          data: [
            report.lightRate - report.lightRateWoW,
            report.energySavingRate - report.energySavingRateWoW,
            report.faultRate - report.faultRateWoW,
            report.avgResponseTime - report.avgResponseTimeWoW,
            38.5
          ],
          itemStyle: { color: '#faad14' }
        },
        {
          name: '本周',
          type: 'bar',
          data: [report.lightRate, report.energySavingRate, report.faultRate, report.avgResponseTime, 36.8],
          itemStyle: { color: '#52c41a' }
        },
        {
          name: '去年同期',
          type: 'bar',
          data: [
            report.lightRate - report.lightRateYoY,
            report.energySavingRate - report.energySavingRateYoY,
            report.faultRate - report.faultRateYoY,
            report.avgResponseTime - report.avgResponseTimeYoY,
            42.3
          ],
          itemStyle: { color: '#91caff' }
        }
      ]
    }
  }, [report])

  const energyWeeklyOption = useMemo(() => {
    const last14 = filteredEnergyData.slice(-14)
    if (last14.length === 0) {
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['实际能耗', '节能量'], top: 0 },
        grid: { left: 60, right: 30, top: 40, bottom: 30 },
        xAxis: { type: 'category', data: [] },
        yAxis: { type: 'value', name: 'kWh' },
        series: []
      }
    }
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['实际能耗', '节能量'], top: 0 },
      grid: { left: 60, right: 30, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: last14.map(d => dayjs(d.date).format('MM-DD')),
        axisLabel: { fontSize: 10 }
      },
      yAxis: { type: 'value', name: 'kWh' },
      series: [
        {
          name: '实际能耗',
          type: 'bar',
          stack: 'total',
          data: last14.map(d => d.actualConsumption),
          itemStyle: { color: '#1677ff' },
          barWidth: 16
        },
        {
          name: '节能量',
          type: 'bar',
          data: last14.map(d => d.savingAmount),
          itemStyle: { color: '#52c41a' },
          barWidth: 16
        }
      ]
    }
  }, [filteredEnergyData])

  const responseTimeOption = useMemo(() => {
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: ['运维一组', '运维二组', '运维三组', '运维四组', '运维五组'] },
      yAxis: [
        { type: 'value', name: '平均响应(h)', min: 0, max: 6 },
        { type: 'value', name: '工单完成量', min: 0, max: 60 }
      ],
      series: [
        {
          name: '平均响应',
          type: 'bar',
          data: [2.5, 3.2, 2.0, 3.8, 2.8],
          itemStyle: { color: '#722ed1' },
          barWidth: 20
        },
        {
          name: '工单完成量',
          type: 'line',
          yAxisIndex: 1,
          data: [42, 38, 45, 36, 40],
          smooth: true,
          itemStyle: { color: '#fa8c16' },
          lineStyle: { width: 2 }
        }
      ]
    }
  }, [])

  const healthScore = useMemo(() => {
    const lightScore = (report.lightRate - 90) * 5
    const energyScore = report.energySavingRate * 2
    const faultScore = (5 - report.faultRate) * 10
    const responseScore = (8 - report.avgResponseTime) * 5
    const total = Math.min(100, Math.max(0, lightScore + energyScore + faultScore + responseScore))
    return Number(total.toFixed(1))
  }, [report])

  const scoreColor = healthScore >= 85 ? '#52c41a' : healthScore >= 70 ? '#faad14' : '#ff4d4f'

  return (
    <div className="page-container">
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Row gutter={24} align="middle">
          <Col flex="1">
            <Space align="center" size={16}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: 'linear-gradient(135deg, #1677ff, #69c0ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 28
              }}>
                <FileTextOutlined />
              </div>
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  照明系统健康诊断周报
                </Title>
                <Space size={16} style={{ marginTop: 4 }}>
                  <Tag color="blue">
                    <CalendarOutlined /> {report.weekStart} ~ {report.weekEnd}
                  </Tag>
                  <Tag color="green">{levelText}</Tag>
                  <Tag color="orange">第{dayjs().isoWeek()}期</Tag>
                </Space>
              </div>
            </Space>
          </Col>
          <Col style={{ textAlign: 'right' }}>
            <Space size={8}>
              <Button icon={<StarOutlined />}>收藏</Button>
              <Button type="primary">导出PDF</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <div className="stat-card green">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">亮灯率</div>
                <div className="stat-value">{report.lightRate}%</div>
                <div className="stat-trend">
                  同比 <TrendIndicator value={report.lightRateYoY} />
                  {' · '}环比 <TrendIndicator value={report.lightRateWoW} />
                </div>
              </div>
              <BulbOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stat-card orange">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">节能率</div>
                <div className="stat-value">{report.energySavingRate}%</div>
                <div className="stat-trend">
                  同比 <TrendIndicator value={report.energySavingRateYoY} />
                  {' · '}环比 <TrendIndicator value={report.energySavingRateWoW} />
                </div>
              </div>
              <ThunderboltOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
        <Col xs={24} sm={8}>
          <div className="stat-card blue">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div className="stat-label">故障率</div>
                <div className="stat-value">{report.faultRate}%</div>
                <div className="stat-trend">
                  同比 <TrendIndicator value={report.faultRateYoY} good="down" />
                  {' · '}环比 <TrendIndicator value={report.faultRateWoW} good="down" />
                </div>
              </div>
              <AlertOutlined style={{ fontSize: 40, opacity: 0.4 }} />
            </div>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card className="chart-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>系统健康指数</div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Progress
                type="dashboard"
                percent={healthScore}
                strokeColor={scoreColor}
                size={180}
                strokeWidth={10}
              />
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -30%)'
              }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: scoreColor }}>{healthScore}</div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  {healthScore >= 85 ? '优秀' : healthScore >= 70 ? '良好' : '需改善'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#52c41a' }}>
              <RiseOutlined /> 较上周提升 {Math.abs(2.3)}分
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card className="chart-card">
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>核心指标多维对比</div>
            <ReactECharts option={radarOption} style={{ height: 260 }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="chart-card">
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>运维效率指标</div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="平均响应时长">
                <Space>
                  <b>{report.avgResponseTime}h</b>
                  <TrendIndicator value={report.avgResponseTimeYoY} good="down" />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="同比变化">
                {report.avgResponseTimeYoY > 0 ? '延长' : '缩短'} {Math.abs(report.avgResponseTimeYoY)}h
              </Descriptions.Item>
              <Descriptions.Item label="环比变化">
                {report.avgResponseTimeWoW > 0 ? '延长' : '缩短'} {Math.abs(report.avgResponseTimeWoW)}h
              </Descriptions.Item>
              <Descriptions.Item label="本周维修成本">
                <Space>
                  <b>¥{report.totalRepairCost.toLocaleString()}</b>
                  <TrendIndicator value={report.repairCostWoW} good="down" />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="单灯平均成本">¥36.8</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="近两周能耗与节能分析" className="chart-card">
            <ReactECharts option={energyWeeklyOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="各运维组响应效率对比" className="chart-card">
            <ReactECharts option={responseTimeOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      <Card title="关键指标同比环比对比" className="chart-card" style={{ marginBottom: 16 }}>
        <ReactECharts option={compareOption} style={{ height: 320 }} />
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                巡检策略优化建议
              </Space>
            }
            className="chart-card"
          >
            <List
              dataSource={report.optimizationSuggestions}
              renderItem={(item, idx) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: idx < 2 ? '#fff1f0' : '#e6f4ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: idx < 2 ? '#ff4d4f' : '#1677ff',
                      fontWeight: 600, fontSize: 14
                    }}>{idx + 1}</div>}
                    description={
                      <div>
                        <Space style={{ marginBottom: 4 }}>
                          {idx < 2 && <Tag color="red">高优先级</Tag>}
                          {idx === 2 && <Tag color="orange">中优先级</Tag>}
                          {idx > 2 && <Tag color="blue">常规建议</Tag>}
                        </Space>
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>{item}</div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <ToolOutlined style={{ color: '#1677ff' }} />
                节能改造方案推荐
              </Space>
            }
            className="chart-card"
          >
            <List
              dataSource={report.retrofitPlan}
              renderItem={(item, idx) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: idx === 0 ? '#f6ffed' : idx === 1 ? '#fff7e6' : '#e6f7ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: idx === 0 ? '#52c41a' : idx === 1 ? '#faad14' : '#1677ff',
                      fontWeight: 600, fontSize: 14
                    }}>{idx + 1}</div>}
                    description={
                      <div>
                        <Space style={{ marginBottom: 4 }}>
                          {idx === 0 && <Tag color="green">ROI最高</Tag>}
                          {idx === 1 && <Tag color="orange">紧急改造</Tag>}
                          {idx === 2 && <Tag color="blue">长期规划</Tag>}
                        </Space>
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>{item}</div>
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
        title="故障类型分布分析" 
        className="chart-card"
        extra={<Tag color="blue">本周共发生488起故障</Tag>}
      >
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Table
              size="small"
              pagination={false}
              dataSource={faultTypeDistribution.map((f, i) => ({ key: i, ...f }))}
              columns={[
                { title: '故障类型', dataIndex: 'type', key: 'type' },
                { 
                  title: '数量', 
                  dataIndex: 'count', 
                  key: 'count', 
                  width: 80,
                  render: (c: number) => <b>{c}起</b>
                },
                { 
                  title: '占比', 
                  dataIndex: 'percent', 
                  key: 'percent',
                  width: 200,
                  render: (p: number) => (
                    <Progress percent={p} size="small" showInfo strokeColor={
                      p > 25 ? '#ff4d4f' : p > 15 ? '#faad14' : '#52c41a'
                    } />
                  )
                }
              ]}
            />
          </Col>
          <Col xs={24} md={12}>
            <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}>
              <div style={{ fontWeight: 500, marginBottom: 12 }}>📊 故障特征分析</div>
              <Paragraph style={{ fontSize: 13, margin: 0, lineHeight: 1.8 }}>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  <li>光源损坏占比最高（32%），主要集中在使用超过3年的高压钠灯</li>
                  <li>电源故障（26%）与夏季高温相关，建议加强散热检查</li>
                  <li>控制板故障（18%）在雷雨天后显著增加，需完善防雷措施</li>
                  <li>线路故障多集中在老旧城区，建议配合道路改造同步推进</li>
                </ul>
              </Paragraph>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ fontWeight: 500, marginBottom: 8 }}>💡 下周重点关注</div>
              <Space wrap>
                <Tag color="red">福田区-光源专项排查</Tag>
                <Tag color="orange">南山区-电源散热检查</Tag>
                <Tag color="blue">罗湖区-线路改造评估</Tag>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}
