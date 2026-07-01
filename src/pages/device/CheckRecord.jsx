import React from 'react'
import { Empty } from 'antd'
import ThreeSectionPage from '../../components/ThreeSectionPage'

export default function CheckRecord() {
  return (
    <ThreeSectionPage
      title="点检记录"
      breadcrumbs="设备管理 / 点检记录"
      table={<Empty description="功能开发中" style={{ marginTop: 80 }} />}
    />
  )
}
