import React from 'react'
import { Empty } from 'antd'
import ThreeSectionPage from '../../components/ThreeSectionPage'

export default function DeviceOEE() {
  return (
    <ThreeSectionPage
      title="设备OEE"
      breadcrumbs="设备管理 / 设备OEE"
      table={<Empty description="功能开发中" style={{ marginTop: 80 }} />}
    />
  )
}
