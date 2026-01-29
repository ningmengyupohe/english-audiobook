/**
 * 格式化工具函数
 */

// 格式化时间（秒 -> 时分秒）
export const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '00:00'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  // 格式化日期
  export const formatDate = (timestamp, format = 'YYYY-MM-DD') => {
    if (!timestamp) return ''
    
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    const second = date.getSeconds().toString().padStart(2, '0')
    
    const formats = {
      'YYYY-MM-DD': `${year}-${month}-${day}`,
      'YYYY/MM/DD': `${year}/${month}/${day}`,
      'MM-DD': `${month}-${day}`,
      'YYYY-MM-DD HH:mm': `${year}-${month}-${day} ${hour}:${minute}`,
      'YYYY-MM-DD HH:mm:ss': `${year}-${month}-${day} ${hour}:${minute}:${second}`,
      'HH:mm': `${hour}:${minute}`,
      'HH:mm:ss': `${hour}:${minute}:${second}`
    }
    
    return formats[format] || `${year}-${month}-${day}`
  }
  
  // 格式化文件大小
  export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  // 格式化数字（添加千分位）
  export const formatNumber = (num) => {
    if (isNaN(num)) return '0'
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }
  
  // 格式化播放量/阅读量
  export const formatCount = (count) => {
    if (count >= 100000000) {
      return (count / 100000000).toFixed(1) + '亿'
    } else if (count >= 10000) {
      return (count / 10000).toFixed(1) + '万'
    } else {
      return count.toString()
    }
  }
  
  // 格式化章节标题
  export const formatChapterTitle = (index, title) => {
    return `第${index}章 ${title}`
  }
  
  // 截断文本
  export const truncateText = (text, maxLength = 20, suffix = '...') => {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + suffix
  }
  
  // 处理音频时长显示
  export const formatAudioDuration = (duration) => {
    if (!duration || duration < 60) return '1分钟以内'
    
    const minutes = Math.ceil(duration / 60)
    if (minutes < 60) return `${minutes}分钟`
    
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 
      ? `${hours}小时${remainingMinutes}分钟`
      : `${hours}小时`
  }
  
  // 格式化评分
  export const formatRating = (rating) => {
    return rating.toFixed(1)
  }
  
  // 颜色相关
  export const darkenColor = (color, percent) => {
    // 简化版本，实际需要更复杂的颜色处理
    return color
  }
  
  export const lightenColor = (color, percent) => {
    return color
  }
  
  export default {
    formatTime,
    formatDate,
    formatFileSize,
    formatNumber,
    formatCount,
    formatChapterTitle,
    truncateText,
    formatAudioDuration,
    formatRating,
    darkenColor,
    lightenColor
  }