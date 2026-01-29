/**
 * 字幕处理工具
 * 支持SRT、VTT格式字幕解析
 */

// 解析时间字符串（HH:MM:SS,mmm 或 HH:MM:SS.mmm）
const parseTime = (timeStr) => {
    if (!timeStr) return 0
    
    // 处理不同分隔符
    timeStr = timeStr.replace(',', '.')
    
    const parts = timeStr.split(':')
    if (parts.length !== 3) return 0
    
    const hours = parseInt(parts[0]) || 0
    const minutes = parseInt(parts[1]) || 0
    const seconds = parseFloat(parts[2]) || 0
    
    return hours * 3600 + minutes * 60 + seconds
  }
  
  // 解析SRT格式字幕
  export const parseSRT = (srtText) => {
    if (!srtText) return []
    
    const subtitles = []
    const blocks = srtText.trim().split(/\n\s*\n/)
    
    for (const block of blocks) {
      const lines = block.split('\n').filter(line => line.trim())
      if (lines.length < 3) continue
      
      // 解析时间轴（第二行）
      const timeLine = lines[1]
      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/)
      
      if (timeMatch) {
        const startTime = parseTime(timeMatch[1])
        const endTime = parseTime(timeMatch[2])
        
        // 合并文本行（从第三行开始）
        const text = lines.slice(2).join('\n')
        
        subtitles.push({
          id: parseInt(lines[0]) || subtitles.length + 1,
          startTime,
          endTime,
          text: text.trim(),
          originalText: text.trim()
        })
      }
    }
    
    return subtitles
  }
  
  // 解析VTT格式字幕
  export const parseVTT = (vttText) => {
    if (!vttText) return []
    
    // 移除WEBVTT头部
    let content = vttText.replace(/^WEBVTT\s*\n\s*\n/, '')
    
    const subtitles = []
    const blocks = content.split(/\n\s*\n/).filter(block => block.trim())
    
    let id = 1
    for (const block of blocks) {
      const lines = block.split('\n').filter(line => line.trim())
      if (lines.length < 2) continue
      
      // 第一行可能是序号或时间轴
      const firstLine = lines[0]
      let timeLineIndex = 0
      
      // 检查第一行是否是时间轴
      if (firstLine.includes('-->')) {
        timeLineIndex = 0
      } else if (lines.length > 1 && lines[1].includes('-->')) {
        timeLineIndex = 1
      } else {
        continue
      }
      
      const timeLine = lines[timeLineIndex]
      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/)
      
      if (timeMatch) {
        const startTime = parseTime(timeMatch[1])
        const endTime = parseTime(timeMatch[2])
        
        // 文本从时间轴下一行开始
        const textLines = lines.slice(timeLineIndex + 1)
        const text = textLines.join('\n').trim()
        
        subtitles.push({
          id: id++,
          startTime,
          endTime,
          text,
          originalText: text
        })
      }
    }
    
    return subtitles
  }
  
  // 自动检测并解析字幕
  export const parseSubtitle = (text, format = 'auto') => {
    if (!text) return []
    
    let detectedFormat = format
    if (format === 'auto') {
      if (text.startsWith('WEBVTT')) {
        detectedFormat = 'vtt'
      } else {
        detectedFormat = 'srt'
      }
    }
    
    switch (detectedFormat) {
      case 'srt':
        return parseSRT(text)
      case 'vtt':
        return parseVTT(text)
      default:
        console.warn('不支持的字幕格式:', format)
        return []
    }
  }
  
  // 查找当前时间对应的字幕
  export const findCurrentSubtitle = (subtitles, currentTime) => {
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      return null
    }
    
    // 二分查找优化
    let left = 0
    let right = subtitles.length - 1
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const subtitle = subtitles[mid]
      
      if (currentTime >= subtitle.startTime && currentTime <= subtitle.endTime) {
        return subtitle
      } else if (currentTime < subtitle.startTime) {
        right = mid - 1
      } else {
        left = mid + 1
      }
    }
    
    return null
  }
  
  // 生成字幕显示文本（处理换行和样式）
  export const formatSubtitleText = (subtitle, options = {}) => {
    if (!subtitle || !subtitle.text) return ''
    
    let text = subtitle.text
    
    // 移除样式标签（如有）
    if (options.removeTags !== false) {
      text = text.replace(/<[^>]*>/g, '')
    }
    
    // 处理换行
    if (options.singleLine) {
      text = text.replace(/\n/g, ' ')
    }
    
    // 限制长度
    if (options.maxLength && text.length > options.maxLength) {
      text = text.substring(0, options.maxLength) + '...'
    }
    
    return text
  }
  
  // 双语字幕处理
  export const processBilingualSubtitles = (primarySubtitles, secondarySubtitles) => {
    if (!primarySubtitles || !Array.isArray(primarySubtitles)) {
      return []
    }
    
    if (!secondarySubtitles || !Array.isArray(secondarySubtitles)) {
      return primarySubtitles.map(sub => ({
        ...sub,
        translation: ''
      }))
    }
    
    // 简单的时间轴匹配（实际项目可能需要更复杂的算法）
    return primarySubtitles.map((primary, index) => ({
      ...primary,
      translation: secondarySubtitles[index]?.text || ''
    }))
  }
  
  // 字幕翻译
  export const translateSubtitle = async (subtitle, targetLang = 'zh-CN') => {
    // 这里可以集成翻译API
    // 由于翻译需要API密钥，这里只提供框架
    console.log('翻译字幕:', subtitle, '目标语言:', targetLang)
    
    // 模拟翻译
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ...subtitle,
          translatedText: `[翻译] ${subtitle.text}`
        })
      }, 100)
    })
  }
  
  // 导出字幕文件
  export const exportSubtitle = (subtitles, format = 'srt') => {
    let content = ''
    
    if (format === 'srt') {
      subtitles.forEach((sub, index) => {
        const startTime = formatTimeForSRT(sub.startTime)
        const endTime = formatTimeForSRT(sub.endTime)
        
        content += `${index + 1}\n`
        content += `${startTime} --> ${endTime}\n`
        content += `${sub.text}\n\n`
      })
    } else if (format === 'vtt') {
      content = 'WEBVTT\n\n'
      subtitles.forEach((sub, index) => {
        const startTime = formatTimeForVTT(sub.startTime)
        const endTime = formatTimeForVTT(sub.endTime)
        
        content += `${startTime} --> ${endTime}\n`
        content += `${sub.text}\n\n`
      })
    }
    
    return content
  }
  
  // 辅助函数：格式化时间用于SRT
  const formatTimeForSRT = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const millis = Math.floor((seconds % 1) * 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`
  }
  
  // 辅助函数：格式化时间用于VTT
  const formatTimeForVTT = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const millis = Math.floor((seconds % 1) * 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
  }
  
  export default {
    parseSRT,
    parseVTT,
    parseSubtitle,
    findCurrentSubtitle,
    formatSubtitleText,
    processBilingualSubtitles,
    translateSubtitle,
    exportSubtitle
  }