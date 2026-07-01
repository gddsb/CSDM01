import React from 'react'
import { Empty } from 'antd'
import ThreeSectionPage from '../../components/ThreeSectionPage'

export default function MonthlyReport() {
  return (
    <ThreeSectionPage
      title="质量月报"
      breadcrumbs="报表中心 / 质量月报"
      table={<Empty description="功能开发中" style={{ marginTop: 80 }} />}
    />
  )
}
