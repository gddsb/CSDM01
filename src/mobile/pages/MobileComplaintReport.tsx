/**
 * 投诉上报移动端（Phase 3 · Complaint）
 *
 * 2 步流程：
 *   Step 0: 选投诉类型 + 填基本信息（来源/客户/物料）
 *   Step 1: 填详细描述 + 提交
 *
 * 后端接口：POST /api/basic/complaints（自动生成 complaint_no）
 */
import { useState } from 'react'
import { Steps, Button, List, Toast, Dialog, Picker, TextArea, Input, Radio } from 'antd-mobile'
import { offlinePost } from '../offline/offlineApi'

type Step = 0 | 1 | 2

const COMPLAINT_TYPES = ['外观缺陷', '尺寸不符', '泄漏', '污染', '微生物超标', '数量短缺', '运输破损', '其它']
const SOURCES = ['客户反馈', '内部质检', '经销商', '线上电商', '现场抽检', '其它']
const HANDLE_DIRECTIONS = ['退货', '换货', '补发', '折扣', '现场处理', '专项调查']

function nowLocalInput() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function MobileComplaintReport() {
  const [step, setStep] = useState<Step>(0)

  // Step 0 基本信息
  const [complaintType, setComplaintType] = useState('')
  const [source, setSource] = useState('客户反馈')
  const [customerName, setCustomerName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [materialName, setMaterialName] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [complaintTime, setComplaintTime] = useState(nowLocalInput())

  // Step 1 详细信息
  const [complaintDesc, setComplaintDesc] = useState('')
  const [handleDirection, setHandleDirection] = useState('')
  const [requireReply, setRequireReply] = useState<'yes' | 'no'>('no')
  const [remarks, setRemarks] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [successNo, setSuccessNo] = useState('')

  const pick = async (
    title: string,
    options: { label: string; value: string }[],
    current: string,
    cb: (v: string) => void,
  ) => {
    const ok = await Picker.prompt({
      columns: [options],
      title,
      value: [[current]],
    })
    if (ok && ok[0]) cb(ok[0] as string)
  }

  const validateStep0 = () => {
    if (!complaintType) { Toast.show({ content: '请选择投诉类型', position: 'bottom' }); return false }
    if (!complaintDesc.trim()) { Toast.show({ content: '请填写投诉描述', position: 'bottom' }); return false }
    return true
  }

  // 合并表单 → 提交
  const onSubmit = async () => {
    setSubmitting(true)
    try {
      const payload: any = {
        source,
        complaint_type: complaintType,
        customer_name: customerName,
        contact_person: contactPerson,
        contact_phone: contactPhone,
        material_name: materialName,
        batch_no: batchNo,
        complaint_desc: complaintDesc.trim(),
        complaint_method: '移动端上报',
        complaint_time: complaintTime ? new Date(complaintTime).toISOString() : new Date().toISOString(),
        require_reply: requireReply === 'yes',
        handle_direction: handleDirection,
        remarks,
      }

      const r: any = await offlinePost('/basic/complaints', payload, { source: 'complaint-report' })

      if (!r.success) {
        Toast.show({ content: r.message || '提交失败', position: 'bottom' }); return
      }

      if (r.data?.queued) {
        Toast.show({ content: '已暂存，网络恢复后自动同步', icon: 'success', position: 'bottom', duration: 1500 })
      }

      setSuccessNo(r.data?.complaint_no || String(r.data?.complaint_id || ''))
      setStep(2)
    } catch (e: any) {
      Toast.show({ content: e?.message || '提交失败', position: 'bottom' })
    } finally { setSubmitting(false) }
  }

  const reset = () => {
    setStep(0); setComplaintType(''); setSource('客户反馈'); setCustomerName('')
    setContactPerson(''); setContactPhone(''); setMaterialName(''); setBatchNo('')
    setComplaintTime(nowLocalInput()); setComplaintDesc(''); setHandleDirection('')
    setRequireReply('no'); setRemarks(''); setSuccessNo('')
  }

  // ========== Render ==========

  if (step === 2) {
    return (
      <div className="mobile-page" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60 }}>📢</div>
        <div style={{ fontSize: 18, fontWeight: 600, margin: '16px 0 8px' }}>投诉上报成功</div>
        {successNo && <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>投诉单号：{successNo}</div>}
        <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>{complaintType} · {source}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button block fill="outline" onClick={() => reset()}>继续上报</Button>
          <Button block color="primary" onClick={() => reset()}>返回首页</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-page" style={{ paddingTop: 12, paddingBottom: 24 }}>
      <Steps current={step} direction="vertical" style={{ marginBottom: 16 }}>
        <Steps.Step title="基本信息" description={complaintType || ''} />
        <Steps.Step title="详细描述" description={complaintDesc.slice(0, 10) || ''} />
        <Steps.Step title="提交" />
      </Steps>

      {step === 0 && (
        <>
          <Card>
            <List.Item
              onClick={() => pick('投诉类型', COMPLAINT_TYPES.map((v) => ({ label: v, value: v })), complaintType, setComplaintType)}
              extra={complaintType || <span style={{ color: '#bbb' }}>请选择</span>}
              arrow
            >投诉类型 <span style={{ color: '#F44336' }}>*</span></List.Item>
            <List.Item
              onClick={() => pick('投诉来源', SOURCES.map((v) => ({ label: v, value: v })), source, setSource)}
              extra={source}
              arrow
            >投诉来源</List.Item>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>发生时间</div>
              <input
                type="datetime-local"
                value={complaintTime}
                onChange={(e) => setComplaintTime(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid #eef0f3', borderRadius: 6 }}
              />
            </div>
          </Card>

          <SectionTitle>客户信息</SectionTitle>
          <Card>
            <InputField label="客户名称" value={customerName} onChange={setCustomerName} placeholder="选填" />
            <InputField label="联系人" value={contactPerson} onChange={setContactPerson} placeholder="选填" />
            <InputField label="联系电话" value={contactPhone} onChange={setContactPhone} placeholder="选填" type="tel" />
          </Card>

          <SectionTitle>关联物料</SectionTitle>
          <Card>
            <InputField label="物料名称" value={materialName} onChange={setMaterialName} placeholder="选填" />
            <InputField label="批次号" value={batchNo} onChange={setBatchNo} placeholder="选填" />
          </Card>

          <div style={{ padding: '16px 0 8px' }}>
            <Button
              block color="primary"
              disabled={!complaintType}
              onClick={() => { if (complaintType) setStep(1) }}
            >下一步：填详细描述</Button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <Card>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                投诉详细描述 <span style={{ color: '#F44336' }}>*</span>
              </div>
              <TextArea
                placeholder="请描述具体的问题现象、影响范围、客户诉求..."
                value={complaintDesc}
                onChange={setComplaintDesc}
                rows={5}
                style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }}
              />
            </div>
          </Card>

          <SectionTitle>处理建议</SectionTitle>
          <Card>
            <List.Item
              onClick={() => pick('处理方向', HANDLE_DIRECTIONS.map((v) => ({ label: v, value: v })), handleDirection, setHandleDirection)}
              extra={handleDirection || <span style={{ color: '#bbb' }}>请选择</span>}
              arrow
            >建议处理方向</List.Item>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>是否需要回复客户</div>
              <Radio.Group value={requireReply} onChange={(v) => setRequireReply(v as any)}
                style={{ display: 'flex', gap: 24 }}>
                <Radio value="yes">是</Radio>
                <Radio value="no">否</Radio>
              </Radio.Group>
            </div>
          </Card>

          <SectionTitle>备注</SectionTitle>
          <Card>
            <div style={{ padding: 14 }}>
              <TextArea
                placeholder="选填：补充信息、相关单号..."
                value={remarks}
                onChange={setRemarks}
                rows={2}
                style={{ background: '#f7f8fa', borderRadius: 8, padding: 8 }}
              />
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
            <Button block fill="outline" onClick={() => setStep(0)}>上一步</Button>
            <Button block color="primary" loading={submitting} onClick={() => {
              if (!complaintDesc.trim()) { Toast.show({ content: '请填写投诉描述', position: 'bottom' }); return }
              onSubmit()
            }}>提交投诉</Button>
          </div>
        </>
      )}
    </div>
  )
}

// ========== 公共小组件 ==========

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: '1px solid #eef0f3',
      marginBottom: 12, overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: '#666', marginTop: 16, marginBottom: 6, paddingLeft: 4 }}>
      {children}
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 70, fontSize: 13, color: '#666' }}>{label}</div>
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ flex: 1, fontSize: 13 }}
      />
    </div>
  )
}
