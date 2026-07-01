import React from 'react'
import { Empty } from 'antd'
import ThreeSectionPage from '../../components/ThreeSectionPage'

export default function Maintenance() {
  return (
    <ThreeSectionPage
      title="维修保养"
      breadcrumbs="设备管理 / 维修保养"
      table={<Empty description="功能开发中" style={{ marginTop: 80 }} />}
    />
  )
}
