import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Tree, Input, Button, Spin, Row, Col, Typography, Space, Tag, message as antdMsg } from 'antd'
import {
  ArrowLeftOutlined, MonitorOutlined, MobileOutlined, SearchOutlined,
  SaveOutlined, ReloadOutlined,
} from '@ant-design/icons'
import api from '../../utils/api'
import { useMessage } from '../../contexts/AppContext'

const { Text } = Typography

// —— 权限树构建（复用 RoleManagement 逻辑，但不需要 platform 过滤）——
function flattenTree(nodes: any[], result: any[] = []) {
  nodes.forEach(n => {
    result.push(n)
    if (n.children && n.children.length > 0) flattenTree(n.children, result)
  })
  return result
}

function buildPermissionTree(permissions: any[], keyword?: string) {
  const hasChildren = permissions.some(p => p.children && p.children.length > 0)
  const flatPerms = hasChildren ? flattenTree(permissions) : permissions

  // 搜索过滤（按 perm_name 或 perm_code）
  let filtered = flatPerms
  if (keyword && keyword.trim()) {
    const kw = keyword.trim().toLowerCase()
    filtered = flatPerms.filter(p =>
      (p.perm_name || '').toLowerCase().includes(kw) ||
      (p.perm_code || '').toLowerCase().includes(kw)
    )
    // 搜索时也保留所有祖先节点路径
    const keepIds = new Set(filtered.map(p => p.perm_id))
    flatPerms.forEach(p => {
      if (keepIds.has(p.perm_id)) {
        let cur = p
        while (cur.parent_id && cur.parent_id !== 0) {
          keepIds.add(cur.parent_id)
          const parent = flatPerms.find(x => x.perm_id === cur.parent_id)
          if (!parent) break
          cur = parent
        }
      }
    })
    filtered = flatPerms.filter(p => keepIds.has(p.perm_id))
  }

  const map = new Map()
  const roots: any[] = []
  filtered.forEach(p => {
    const isButton = p.type === 'button'
    const titleNode = (
      <span>
        {isButton && <Tag color="purple" style={{ marginRight: 6, fontSize: 11, padding: '0 4px', lineHeight: '18px' }}>按钮</Tag>}
        <span>{p.perm_name}</span>
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{p.perm_code}</Text>
      </span>
    )
    map.set(p.perm_id, { title: titleNode, key: p.perm_id, children: [], _raw: p })
  })
  filtered.forEach(p => {
    const node = map.get(p.perm_id)
    if (!p.parent_id || p.parent_id === 0) {
      roots.push(node)
    } else {
      const parent = map.get(p.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
  })
  const sortNodes = (nodes: any[]) => {
    nodes.sort((a, b) => (a._raw?.sort_order || 0) - (b._raw?.sort_order || 0))
    nodes.forEach(n => sortNodes(n.children))
    nodes.forEach(n => { delete n._raw })
    return nodes
  }
  return sortNodes(roots)
}

export default function RolePermissionConfig() {
  const { roleId } = useParams<{ roleId: string }>()
  const navigate = useNavigate()
  const message = useMessage()

  const [roleInfo, setRoleInfo] = useState<any>(null)
  const [permissions, setPermissions] = useState<any[]>([])

  const [pcChecked, setPcChecked] = useState<React.Key[]>([])
  const [appChecked, setAppChecked] = useState<React.Key[]>([])

  const [pcKeyword, setPcKeyword] = useState('')
  const [appKeyword, setAppKeyword] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const pcTreeData = useMemo(() => buildPermissionTree(permissions, pcKeyword), [permissions, pcKeyword])
  const appTreeData = useMemo(() => buildPermissionTree(permissions, appKeyword), [permissions, appKeyword])

  const pcCheckedCount = useMemo(() => (Array.isArray(pcChecked) ? pcChecked.length : 0), [pcChecked])
  const appCheckedCount = useMemo(() => (Array.isArray(appChecked) ? appChecked.length : 0), [appChecked])

  const loadAll = useCallback(async () => {
    if (!roleId) return
    setLoading(true)
    try {
      const roleRes = await api.get(`/system/roles/${roleId}`)
      setRoleInfo(roleRes.data)
      const [allRes, pcRes, appRes] = await Promise.all([
        api.get('/system/permissions'),
        api.get(`/system/roles/${roleId}/permissions?terminal=1`),
        api.get(`/system/roles/${roleId}/permissions?terminal=2`),
      ])
      setPermissions(allRes.data || [])
      setPcChecked(pcRes.data || [])
      setAppChecked(appRes.data || [])
    } catch (err: any) {
      message.error(err.message || '加载权限数据失败')
    } finally {
      setLoading(false)
    }
  }, [roleId])

  useEffect(() => { loadAll() }, [loadAll])

  const handleSave = async () => {
    if (!roleId) return
    setSaving(true)
    try {
      const pcKeys = Array.isArray(pcChecked) ? pcChecked : (pcChecked as any).checked
      const appKeys = Array.isArray(appChecked) ? appChecked : (appChecked as any).checked
      await Promise.all([
        api.put(`/system/roles/${roleId}/permissions`, { perm_ids: pcKeys, terminal: 1 }),
        api.put(`/system/roles/${roleId}/permissions`, { perm_ids: appKeys, terminal: 2 }),
      ])
      antdMsg.success('两端权限保存成功')
      try { localStorage.removeItem('daman_mes_menu_cache_v1') } catch {}
    } catch (err: any) {
      antdMsg.error(err.message || '权限保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '16px 24px', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 顶部栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: '#fff', borderRadius: 8, border: '1px solid var(--color-border,#e5e5e5)',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/iam/roles')}>返回角色列表</Button>
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 16 }}>
            角色: {roleInfo?.role_name || '加载中...'}
          </Text>
          {roleInfo?.role_code && (
            <Tag color="blue" style={{ marginLeft: 8 }}>{roleInfo.role_code}</Tag>
          )}
          {roleInfo?.role_code === 'SUPER_ADMIN' && (
            <Tag color="red" style={{ marginLeft: 8 }}>超级管理员（自动全部权限）</Tag>
          )}
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadAll}>重新加载</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
          保存两端权限
        </Button>
      </div>

      {/* 双列权限树 */}
      <Spin spinning={loading} style={{ flex: 1 }}>
        <Row gutter={16} style={{ height: '100%' }}>
          {/* ========== PC 端 ========== */}
          <Col span={12}>
            <Card
              title={
                <Space>
                  <MonitorOutlined style={{ color: '#1677ff' }} />
                  <span>PC 端权限</span>
                  <Tag color="blue">{pcCheckedCount} 项已选</Tag>
                </Space>
              }
              size="small"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, overflow: 'auto', padding: 12 }}
              extra={
                <Input
                  size="small"
                  prefix={<SearchOutlined />}
                  placeholder="搜索权限名称/编码"
                  allowClear
                  value={pcKeyword}
                  onChange={e => setPcKeyword(e.target.value)}
                  style={{ width: 200 }}
                />
              }
            >
              <Tree
                checkable
                defaultExpandAll
                treeData={pcTreeData}
                checkedKeys={pcChecked}
                onCheck={(keys) => setPcChecked(keys as React.Key[])}
                style={{ fontSize: 13 }}
              />
            </Card>
          </Col>

          {/* ========== APP 端 ========== */}
          <Col span={12}>
            <Card
              title={
                <Space>
                  <MobileOutlined style={{ color: '#389e0d' }} />
                  <span>APP 端权限</span>
                  <Tag color="green">{appCheckedCount} 项已选</Tag>
                </Space>
              }
              size="small"
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, overflow: 'auto', padding: 12 }}
              extra={
                <Input
                  size="small"
                  prefix={<SearchOutlined />}
                  placeholder="搜索权限名称/编码"
                  allowClear
                  value={appKeyword}
                  onChange={e => setAppKeyword(e.target.value)}
                  style={{ width: 200 }}
                />
              }
            >
              <Tree
                checkable
                defaultExpandAll
                treeData={appTreeData}
                checkedKeys={appChecked}
                onCheck={(keys) => setAppChecked(keys as React.Key[])}
                style={{ fontSize: 13 }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}
