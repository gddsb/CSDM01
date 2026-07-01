import React from 'react'
import { Empty } from 'antd'
import ThreeSectionPage from '../../components/ThreeSectionPage'

export default function SystemConfig() {
  return (
    <ThreeSectionPage
      title="系统配置"
      breadcrumbs="系统管理 / 系统配置"
      table={<Empty description="功能开发中" style={{ marginTop: 80 }} />}
    />
  )
}
