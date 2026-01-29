/**
 * 音频播放管理器 - 英语有声书核心
 */
class AudioManager {
    constructor() {
      this.innerAudioContext = null
      this.currentAudio = null
      this.subtitles = []          // 字幕数组
      this.currentSubtitleIndex = -1
      this.listeners = new Map()   // 事件监听器
      
      this.init()
    }
  
    // 初始化音频上下文
    init() {
      this.innerAudioContext = wx.createInnerAudioContext()
      
      // 绑定事件
      this.innerAudioContext.onPlay(() => this.emit('play'))
      this.innerAudioContext.onPause(() => this.emit('pause'))
      this.innerAudioContext.onStop(() => this.emit('stop'))
      this.innerAudioContext.onEnded(() => this.emit('ended'))
      this.innerAudioContext.onError((err) => {
        console.error('音频播放错误:', err)
        this.emit('error', err)
      })
      
      // 时间更新 - 字幕同步
      this.innerAudioContext.onTimeUpdate(() => {
        const currentTime = this.innerAudioContext.currentTime
        this.emit('timeupdate', currentTime)
        this.updateSubtitle(currentTime)
      })
      
      // 缓冲进度
      this.innerAudioContext.onWaiting(() => this.emit('waiting'))
      this.innerAudioContext.onCanplay(() => this.emit('canplay'))
    }
  
    // 播放音频
    play(audioUrl, options = {}) {
      if (!audioUrl) {
        console.error('音频URL不能为空')
        return
      }
  
      this.currentAudio = {
        url: audioUrl,
        title: options.title || '未知标题',
        author: options.author || '未知作者',
        cover: options.cover || '',
        startTime: options.startTime || 0
      }
  
      this.innerAudioContext.src = audioUrl
      this.innerAudioContext.startTime = options.startTime || 0
      this.innerAudioContext.play()
      
      // 加载字幕
      if (options.subtitles) {
        this.loadSubtitles(options.subtitles)
      }
    }
  
    // 加载字幕
    loadSubtitles(subtitles) {
      if (!Array.isArray(subtitles)) return
      
      this.subtitles = subtitles.sort((a, b) => a.startTime - b.startTime)
      this.currentSubtitleIndex = -1
    }
  
    // 更新当前字幕
    updateSubtitle(currentTime) {
      if (this.subtitles.length === 0) return
  
      // 查找当前时间对应的字幕
      let newIndex = -1
      for (let i = 0; i < this.subtitles.length; i++) {
        const subtitle = this.subtitles[i]
        if (currentTime >= subtitle.startTime && currentTime <= subtitle.endTime) {
          newIndex = i
          break
        }
      }
  
      // 如果字幕变化，触发事件
      if (newIndex !== this.currentSubtitleIndex) {
        this.currentSubtitleIndex = newIndex
        const currentSubtitle = newIndex >= 0 ? this.subtitles[newIndex] : null
        this.emit('subtitlechange', currentSubtitle)
      }
    }
  
    // 控制方法
    pause() {
      this.innerAudioContext.pause()
    }
  
    resume() {
      this.innerAudioContext.play()
    }
  
    stop() {
      this.innerAudioContext.stop()
    }
  
    seek(position) {
      this.innerAudioContext.seek(position)
    }
  
    // 获取音频信息
    getCurrentAudio() {
      return this.currentAudio
    }
  
    getCurrentTime() {
      return this.innerAudioContext.currentTime
    }
  
    getDuration() {
      return this.innerAudioContext.duration
    }
  
    getBuffered() {
      return this.innerAudioContext.buffered
    }
  
    // 字幕相关
    getCurrentSubtitle() {
      return this.currentSubtitleIndex >= 0 
        ? this.subtitles[this.currentSubtitleIndex] 
        : null
    }
  
    getSubtitles() {
      return this.subtitles
    }
  
    // 事件监听
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, [])
      }
      this.listeners.get(event).push(callback)
    }
  
    off(event, callback) {
      if (!this.listeners.has(event)) return
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  
    emit(event, ...args) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).forEach(callback => {
          try {
            callback(...args)
          } catch (error) {
            console.error(`事件 ${event} 回调执行错误:`, error)
          }
        })
      }
    }
  
    // 销毁
    destroy() {
      this.innerAudioContext.stop()
      this.innerAudioContext.destroy()
      this.listeners.clear()
      this.currentAudio = null
      this.subtitles = []
      this.currentSubtitleIndex = -1
    }
  }
  
  // 创建单例
  let audioManagerInstance = null
  
  export const getAudioManager = () => {
    if (!audioManagerInstance) {
      audioManagerInstance = new AudioManager()
    }
    return audioManagerInstance
  }
  
  export default getAudioManager()