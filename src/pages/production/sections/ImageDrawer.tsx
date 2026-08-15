import React from 'react'
import { Button, Col, Drawer, Empty, Image, Row, Spin, Tag, Upload, message } from 'antd'
import { DeleteOutlined, InboxOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { Dragger } = Upload

interface ImageRecord {
  id?: number
  temp_id?: string
  image_url: string
  thumbnail_url?: string
  image_name?: string
  image_type?: string
  upload_time?: string
  upload_person_name?: string
}

interface ImageDrawerProps {
  open: boolean
  loading: boolean
  recordLabel: string
  recordType: string
  recordId: number | string | null
  images: ImageRecord[]
  onClose: () => void
  onUpload: (file: File) => Promise<void>
  onDelete: (image: ImageRecord) => void
}

export default function ImageDrawer({
  open, loading, recordLabel, recordType, recordId, images, onClose, onUpload, onDelete,
}: ImageDrawerProps) {
  const uploadProps = {
    name: 'images',
    multiple: true,
    showUploadList: false,
    accept: 'image/*',
    beforeUpload: async (file: File) => {
      const isImage = file.type.startsWith('image/')
      if (!isImage) {
        message.error('只能上传图片文件')
        return false
      }
      if (file.size > 10 * 1024 * 1024) {
        message.error('图片不能超过 10MB')
        return false
      }
      await onUpload(file)
      return false
    },
  }

  return (
    <Drawer title={recordLabel} placement="right" width={640} open={open} onClose={onClose} destroyOnClose>
      {recordId && (
        <div style={{ marginBottom: 16 }}>
          <Tag color="blue">{recordType}</Tag>
          <span style={{ color: '#666' }}>ID: {recordId}</span>
        </div>
      )}
      {recordId && (
        <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽上传图片</p>
          <p className="ant-upload-hint">支持 JPG/PNG/GIF 等图片，单张不超过 10MB</p>
        </Dragger>
      )}
      {!recordId && (
        <div style={{ marginBottom: 16, padding: 16, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>
          <span style={{ color: '#d48806' }}>请先保存当前记录后再上传图片</span>
        </div>
      )}
      <Spin spinning={loading}>
        {images.length === 0 ? (
          <Empty description="暂无图片" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Row gutter={[12, 12]}>
            {images.map((img) => (
              <Col span={8} key={img.id ?? img.temp_id}>
                <div style={{ position: 'relative',  border: '1px solid #f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <Image
                    src={img.image_url}
                    alt={img.image_name || '不良图片'}
                    style={{ width: '100%', height: 160, objectFit: 'cover' }}
                    preview={{ src: img.image_url }}
                  />
                  <div style={{ padding: '4px 8px', background: '#fafafa', fontSize: 12 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {img.image_name || '未命名'}
                    </div>
                    <div style={{ color: '#999' }}>
                      {img.upload_time ? dayjs(img.upload_time).format('YYYY-MM-DD HH:mm') : ''}
                    </div>
                  </div>
                  {recordId && (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.8)' }}
                      onClick={() => onDelete(img)}
                    />
                  )}
                </div>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </Drawer>
  )
}
