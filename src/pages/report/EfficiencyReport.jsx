import React from 'react'
import { Empty } from 'antd'
import ThreeSectionPage from '../../components/ThreeSectionPage'

export default function EfficiencyReport() {
  return (
    <ThreeSectionPage
      title="效率分析"
      breadcrumbs="报表中心 / 效率分析"
      table={<Empty description="功能开发中" style={{ marginTop: 80 }} />}
    />
  )
}
