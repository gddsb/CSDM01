import { useState, useEffect, useCallback } from 'react'

export interface TodoStats {
  incomingInspection: number
  processInspection: number
  finishedInspection: number
  microbeInspection: number
  envInspection: number
  standardReview: number
  complaintPending: number
  deviceMaintenance: number
  total: number
}

const mockTodoStats: TodoStats = {
  incomingInspection: 5,
  processInspection: 3,
  finishedInspection: 2,
  microbeInspection: 1,
  envInspection: 2,
  standardReview: 1,
  complaintPending: 2,
  deviceMaintenance: 3,
  total: 19,
}

export function useTodoStats() {
  const [stats, setStats] = useState<TodoStats>(mockTodoStats)
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      // TODO: 待后端接口就绪后替换为真实API调用
      // const res = await api.get('/system/stats/todo')
      // setStats(res.data || mockTodoStats)
      setStats(mockTodoStats)
    } catch (err) {
      setStats(mockTodoStats)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const timer = setInterval(fetchStats, 60 * 1000)
    return () => clearInterval(timer)
  }, [fetchStats])

  return { stats, loading, refresh: fetchStats }
}
