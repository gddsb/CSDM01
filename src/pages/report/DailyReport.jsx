import React from 'react'
import { Empty } from 'antd'
import ThreeSectionPage from '../../components/ThreeSectionPage'

export default function DailyReport() {
  return (
    <ThreeSectionPage
      title="生产日报"
      breadcrumbs="报表中心 / 生产日报"
      table={<Empty description="功能开发中" style={{ marginTop: 80 }} />}
    />
  )
}
