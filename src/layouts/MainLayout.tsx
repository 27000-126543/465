import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Space, Button } from 'antd'
import {
  DashboardOutlined,
  MonitorOutlined,
  AlertOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  FileTextOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '核心看板' },
  { key: '/monitor', icon: <MonitorOutlined />, label: '实时监控' },
  { key: '/alerts', icon: <AlertOutlined />, label: '预警与审批' },
  { key: '/energy', icon: <ThunderboltOutlined />, label: '节能分析' },
  { key: '/operations', icon: <ToolOutlined />, label: '运维管理' },
  { key: '/report', icon: <FileTextOutlined />, label: '健康诊断报告' }
]

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout()
        navigate('/login')
      }
    }
  ]

  const levelMap = {
    national: '国家监管',
    provincial: '省级管理',
    municipal: '市级管理'
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{
          background: 'linear-gradient(180deg, #001529 0%, #002140 100%)'
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          color: '#fff',
          fontSize: collapsed ? 18 : 16,
          fontWeight: 600,
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          {collapsed ? '💡' : '💡 智慧照明平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />
          <Space size={24}>
            <Badge count={5} size="small">
              <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size={36} src={user?.avatar} icon={<UserOutlined />} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{user?.name}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                    {user?.level ? levelMap[user.level] : ''}
                    {user?.province ? ` · ${user.province}` : ''}
                    {user?.city ? ` · ${user.city}` : ''}
                  </div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 0, background: '#f0f2f5', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
