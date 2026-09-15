import { Button } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'

export function ComingSoon({ title, desc }: { title: string; desc: string }) {
  const navigate = useNavigate()
  return (
    <div className="mobile-page" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '60px 28px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#333', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 24 }}>{desc}</div>
      <Button size="small" onClick={() => navigate(-1)}>返回</Button>
    </div>
  )
}
