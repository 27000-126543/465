import { useState } from 'react'
import { Form, Input, Button, Radio, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { PermissionLevel } from '@/types'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [level, setLevel] = useState<PermissionLevel>('national')
  const login = useAuthStore(state => state.login)
  const navigate = useNavigate()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    const success = await login(values.username, values.password, level)
    setLoading(false)
    if (success) {
      message.success('登录成功')
      navigate('/dashboard')
    } else {
      message.error('登录失败，请检查用户名和密码')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #00c6ff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💡</div>
          <h1 style={{ color: '#fff', fontSize: 28, marginBottom: 8, fontWeight: 700 }}>
            全国城市照明节能与运维
          </h1>
          <h2 style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, fontWeight: 500 }}>
            智能分析平台
          </h2>
        </div>
        <Card style={{
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
            layout="vertical"
          >
            <Form.Item label="登录层级" required>
              <Radio.Group
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                style={{ width: '100%', display: 'flex' }}
              >
                <Radio.Button value="national" style={{ flex: 1, textAlign: 'center' }}>国家级</Radio.Button>
                <Radio.Button value="provincial" style={{ flex: 1, textAlign: 'center' }}>省级</Radio.Button>
                <Radio.Button value="municipal" style={{ flex: 1, textAlign: 'center' }}>市级</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="请输入用户名（任意输入即可）" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码（任意输入即可）" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{ height: 46, fontSize: 16, fontWeight: 500 }}
              >
                登 录
              </Button>
            </Form.Item>
          </Form>
        </Card>
        <div style={{ textAlign: 'center', marginTop: 24, color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
          © 2026 全国城市照明智能管理中心 版权所有
        </div>
      </div>
    </div>
  )
}
