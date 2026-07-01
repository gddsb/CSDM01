import React from 'react'
import { Empty } from 'antd'
import ThreeSectionPage from '../../components/ThreeSectionPage'

export default function ProcessInspection() {
  return (
    <ThreeSectionPage
      title="过程检验"
      breadcrumbs="质量管理 / 过程检验"
      table={<Empty description="功能开发中" style={{ marginTop: 80 }} />}
    />
  )
}
