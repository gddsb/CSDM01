/**
 * UserExtPermissionModal — 用户附加权限配置弹窗（规范 3.7 / 8.7）
 * 双栏 PC/APP + 三种状态标记 + 最终权限预览
 */
import React, { useState, useEffect, useMemo } from 'react'
import { Modal, Tree, Row, Col, Tag, Typography, Checkbox, Button, Space, Popconfirm, Tooltip } from 'antd'
import { InfoCircleOutlined, SaveOutlined, CloseCircleOutlined } from '@ant-design/icons'
import api from '../../utils/api'
import { logger } from '../../utils/logger'

const { Text } = Typography

interface UserInfo {
  user_id: number
  username: string
  real_name?: string
}

interface ExtPermState {
  perm_id: number
  perm_code: string
  perm_name: string
  source: 'role' | 'add' | 'deny' | 'none'
}

interface ExtPermSummary {
  rolePermCount: number
  addCount: number
  denyCount: number
  finalCount: number
}

interface ExtPermConfig {
  rolePermCodes?: string[]
  addPermCodes?: string[]
  denyPermCodes?: string[]
  permStates: ExtPermState[]
  summary: ExtPermSummary
  isSuperAdmin?: boolean
}

interface Props {
  open: boolean
  user: UserInfo | null
  onClose: () => void
  onSaved?: () => void
}

/** 根据 perm_code 判断所属 platform */
function codePlatform(code: string): 'pc' | 'mobile' | 'allp' | 'legacy' {
  if (code.startsWith('pc:')) return 'pc'
  if (code.startsWith('mobile:')) return 'mobile'
  if (code.startsWith('all:')) return 'allp'
  return 'legacy'
}

/** 把 permStates 列表转为 Tree 数据 */
function buildTree(permStates: ExtPermState[], permissions: any[]) {
  const permMap = new Map()
  permissions.forEach(p => permMap.set(p.perm_id, p))

  const roots: any[] = []
  const nodeMap = new Map<number, any>()

  permStates.forEach(state => {
    const perm = permMap.get(state.perm_id)
    if (!perm) return
    nodeMap.set(state.perm_id, {
      key: state.perm_id,
      perm_code: state.perm_code,
      perm_name: state.perm_name,
      source: state.source,
      _parent_id: perm.parent_id || 0,
      children: [],
    })
  })

  nodeMap.forEach(node => {
    if (!node._parent_id || node._parent_id === 0 || !nodeMap.has(node._parent_id)) {
      roots.push(node)
    } else {
      nodeMap.get(node._parent_id).children.push(node)
    }
  })

  const sortNodes = (nodes: any[]) => {
    nodes.sort((a, b) => (a.perm_name || '').localeCompare(b.perm_name || ''))
    nodes.forEach(n => { sortNodes(n.children); delete n._parent_id })
  }
  sortNodes(roots)
  return roots
}

/** 状态颜色/标签 */
function sourceStyle(source: ExtPermState['source']): { color: string; label: string } | null {
  switch (source) {
    case 'role':  return { color: 'default', label: '角色自带' }
    case 'add':   return { color: 'blue',    label: '额外授予' }
    case 'deny':  return { color: 'red',      label: '单独排除' }
    default:      return null
  }
}

export default function UserExtPermissionModal({ open, user, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'pc' | 'app'>('pc')
  const [config, setConfig] = useState<ExtPermConfig | null>(null)
  // 编辑态：选中的 add / deny
  const [checkedAdd, setCheckedAdd] = useState<Set<number>>(new Set())
  const [checkedDeny, setCheckedDeny] = useState<Set<number>>(new Set())

  const terminal = activeTab === 'pc' ? 1 : 2

  useEffect(() => {
    if (!open || !user) return
    loadConfig()
  }, [open, user])

  useEffect(() => {
    if (!open || !user) return
    loadConfig() // tab 切换时重新加载
  }, [activeTab])

  async function loadConfig() {
    if (!user) return
    setLoading(true)
    try {
      const res = await api.get(`/system/user-ext-permission/${user.user_id}`, { params: { terminal } })
      const data = res.data
      setConfig(data)
      setCheckedAdd(new Set(data?.addPermIds || []))
      setCheckedDeny(new Set(data?.denyPermIds || []))
    } catch (err) {
      logger.error('加载失败', err)
    } finally {
      setLoading(false)
    }
  }

  // 树数据
  const treeData = useMemo(() => {
    if (!config) return []
    // 复用 buildTree
    const permRes = permissionsRef.current
    return buildTree(config.permStates, permRes)
  }, [config, terminal])

  // 权限池（用于构建树结构）— 懒加载一次
  const permissionsRef = React.useRef<any[]>([])
  useEffect(() => {
    if (!open || !user || permissionsRef.current.length > 0) return
    api.get('/system/permissions').then(res => {
      // 如果后端已返回树形，先扁平化
      const all = flattenTree(res.data || [])
      permissionsRef.current = all
    }).catch(() => {})
  }, [open, user])

  function flattenTree(nodes: any[], result: any[] = []): any[] {
    nodes.forEach(n => {
      result.push(n)
      if (n.children?.length) flattenTree(n.children, result)
    })
    return result
  }

  function togglePerm(state: ExtPermState['source'], permId: number) {
    const nextAdd = new Set(checkedAdd)
    const nextDeny = new Set(checkedDeny)
    // 互斥保护
    if (nextAdd.has(permId)) nextDeny.delete(permId)
    if (nextDeny.has(permId)) nextAdd.delete(permId)

    if (state === 'add') {
      // 取消 add
      nextAdd.delete(permId)
    } else if (state === 'deny') {
      // 取消 deny
      nextDeny.delete(permId)
    } else if (state === 'role') {
      // 角色自带 → 点"排除"加入 deny
      nextDeny.add(permId)
    } else {
      // none → 点"授予"加入 add
      nextAdd.add(permId)
    }
    setCheckedAdd(nextAdd)
    setCheckedDeny(nextDeny)
  }

  async function handleSave() {
    if (!user || !config) return
    setSaving(true)
    try {
      const res = await api.post(`/system/user-ext-permission/${user.user_id}`, {
        terminal,
        addPermIds: Array.from(checkedAdd),
        denyPermIds: Array.from(checkedDeny),
      })
      // 刷新配置 + 回父级通知
      await loadConfig()
      onSaved?.()
      // 不立即关闭，让用户看到最终结果
    } catch (err: any) {
      // 后端已返回错误消息
    } finally {
      setSaving(false)
    }
  }

  // 计算预览
  const preview = useMemo(() => {
    if (!config) return null
    const finalCodes = new Set(config.rolePermCodes || [])
    checkedAdd.forEach(id => {
      const state = config.permStates.find(p => p.perm_id === id)
      if (state) finalCodes.add(state.perm_code)
    })
    checkedDeny.forEach(id => {
      const state = config.permStates.find(p => p.perm_id === id)
      if (state) finalCodes.delete(state.perm_code)
    })
    return {
      rolePerm: config.summary.rolePermCount,
      add: checkedAdd.size,
      deny: checkedDeny.size,
      final: finalCodes.size,
      isSuper: config.isSuperAdmin,
    }
  }, [config, checkedAdd, checkedDeny])

  const renderNodeTitle = (node: any) => {
    const style = sourceStyle(node.source)
    return (
      <Space size={6}>
        {style && <Tag color={style.color} style={{ marginRight: 4, fontSize: 11, padding: '0 4px', lineHeight: '18px' }}>{style.label}</Tag>}
        <span>{node.perm_name}</span>
        <Text type="secondary" style={{ fontSize: 12 }}>{node.perm_code}</Text>
        {/* 操作图标：角色自带可排除，none 可授予 */}
        {node.source === 'role' && (
          <Tooltip title="排除此权限">
            <Button
              type="text" size="small" danger
              icon={<CloseCircleOutlined />}
              onClick={(e) => { e.stopPropagation(); togglePerm('role', node.perm_id) }}
              style={{ padding: '0 4px' }}
            />
          </Tooltip>
        )}
        {node.source === 'none' && (
          <Tooltip title="授予此权限">
            <Button
              type="text" size="small"
              icon={<SaveOutlined />}
              onClick={(e) => { e.stopPropagation(); togglePerm('none', node.perm_id) }}
              style={{ padding: '0 4px' }}
            />
          </Tooltip>
        )}
      </Space>
    )
  }

  const isSuperAdmin = config?.isSuperAdmin || false

  return (
    <Modal
      title={`用户附加权限配置 — ${user?.username || ''}`}
      open={open}
      onCancel={onClose}
      width={900}
      style={{ top: 60 }}
      footer={!isSuperAdmin ? [
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="save" type="primary" onClick={handleSave} loading={saving}>保存</Button>,
      ] : null}
    >
      {isSuperAdmin ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <InfoCircleOutlined style={{ fontSize: 40, marginBottom: 16 }} />
          <div>超级管理员角色不支持用户附加权限配置（规范 3.15）</div>
        </div>
      ) : (
        <>
          {/* Tab 切换 PC / APP */}
          <div style={{ marginBottom: 12 }}>
            <Space>
              <Button type={activeTab === 'pc' ? 'primary' : 'default'} onClick={() => setActiveTab('pc')}>
                PC 端 (terminal=1)
              </Button>
              <Button type={activeTab === 'app' ? 'primary' : 'default'} onClick={() => setActiveTab('app')}>
                移动端 APP (terminal=2)
              </Button>
            </Space>
          </div>

          {/* 预览摘要 */}
          {preview && (
            <div style={{
              background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6,
              padding: '12px 16px', marginBottom: 16, fontSize: 13,
            }}>
              <Space split={<span style={{ color: '#bbb' }}>|</span>}>
                <span>角色权限 <b style={{ color: '#666' }}>{preview.rolePerm}</b> 条</span>
                <span>额外授予 <b style={{ color: '#1677ff' }}>{preview.add}</b> 条</span>
                <span>单独排除 <b style={{ color: '#ff4d4f' }}>{preview.deny}</b> 条</span>
                <span>最终权限 <b style={{ color: '#389e0d', fontSize: 15 }}>{preview.final}</b> 条</span>
              </Space>
            </div>
          )}

          {/* 权限树 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
          ) : (
            <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 8 }}>
              {treeData.length > 0 ? (
                <Tree
                  showLine
                  blockNode
                  defaultExpandAll
                  treeData={treeData.map(n => ({
                    ...n,
                    title: renderNodeTitle(n),
                  }))}
                  selectable={false}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无权限数据</div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
