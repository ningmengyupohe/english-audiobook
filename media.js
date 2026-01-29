/**
 * 媒体资源管理（图片、音频、缓存）
 */

// 图片处理
export const processImageUrl = (url, options = {}) => {
    if (!url) return ''
    
    // 如果是本地路径，直接返回
    if (url.startsWith('/') || url.startsWith('http://tmp/')) {
      return url
    }
    
    // 处理网络图片（可以添加图片处理参数）
    let processedUrl = url
    
    // 添加图片处理参数（如果CDN支持）
    if (options.width || options.height || options.quality) {
      // 这里可以根据你的图片服务添加参数
      // 例如：?x-oss-process=image/resize,w_200,h_200/quality,q_80
      const params = []
      if (options.width) params.push(`w_${options.width}`)
      if (options.height) params.push(`h_${options.height}`)
      if (options.quality) params.push(`q_${options.quality}`)
      
      if (params.length > 0) {
        const separator = processedUrl.includes('?') ? '&' : '?'
        processedUrl += `${separator}x-oss-process=image/resize,${params.join(',')}`
      }
    }
    
    return processedUrl
  }
  
  // 获取书籍封面
  export const getBookCover = (coverUrl, size = 'medium') => {
    const sizes = {
      small: { width: 100, height: 140 },
      medium: { width: 200, height: 280 },
      large: { width: 300, height: 420 }
    }
    
    const sizeOptions = sizes[size] || sizes.medium
    return processImageUrl(coverUrl, sizeOptions)
  }
  
  // 获取用户头像
  export const getUserAvatar = (avatarUrl, size = 80) => {
    return processImageUrl(avatarUrl, { width: size, height: size })
  }
  
  // 音频资源管理
  export const getAudioUrl = (audioInfo, quality = 'standard') => {
    if (!audioInfo || !audioInfo.url) return ''
    
    // 根据网络状况选择音质
    const networkType = wx.getNetworkTypeSync()
    let selectedQuality = quality
    
    // 如果是移动网络，自动降低音质
    if (networkType === '2g' || networkType === '3g') {
      selectedQuality = 'low'
    }
    
    // 这里可以根据你的音频服务返回不同音质的URL
    // 例如：音频文件可能有多个版本：低音质、标准、高音质
    const qualityMap = {
      low: audioInfo.lowQualityUrl || audioInfo.url,
      standard: audioInfo.url,
      high: audioInfo.highQualityUrl || audioInfo.url
    }
    
    return qualityMap[selectedQuality] || audioInfo.url
  }
  
  // 下载管理
  export const downloadFile = (url, fileType = 'audio') => {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.tempFilePath)
          } else {
            reject(new Error(`下载失败: ${res.statusCode}`))
          }
        },
        fail: reject
      })
    })
  }
  
  // 检查文件是否已下载
  export const checkFileExists = async (filePath) => {
    return new Promise((resolve) => {
      wx.getFileInfo({
        filePath,
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    })
  }
  
  // 文件缓存管理
  export const cacheManager = {
    // 缓存音频文件
    async cacheAudio(audioUrl, audioId) {
      const cacheKey = `audio_cache_${audioId}`
      const cachedPath = wx.getStorageSync(cacheKey)
      
      // 检查缓存是否有效
      if (cachedPath && await checkFileExists(cachedPath)) {
        return cachedPath
      }
      
      try {
        // 下载文件
        const tempPath = await downloadFile(audioUrl)
        
        // 保存到缓存
        wx.setStorageSync(cacheKey, tempPath)
        
        return tempPath
      } catch (error) {
        console.error('音频缓存失败:', error)
        return audioUrl // 返回原始URL
      }
    },
    
    // 清理缓存
    clearCache() {
      const cacheKeys = []
      
      // 收集所有缓存key
      const keys = Object.keys(wx.getStorageInfoSync())
      keys.forEach(key => {
        if (key.startsWith('audio_cache_') || key.startsWith('image_cache_')) {
          cacheKeys.push(key)
        }
      })
      
      // 删除缓存
      cacheKeys.forEach(key => {
        wx.removeStorageSync(key)
      })
      
      return cacheKeys.length
    },
    
    // 获取缓存大小
    getCacheSize() {
      const storageInfo = wx.getStorageInfoSync()
      return storageInfo.currentSize
    }
  }
  
  // 图片预加载
  export const preloadImages = (imageUrls) => {
    return Promise.all(
      imageUrls.map(url => {
        return new Promise((resolve, reject) => {
          if (!url) {
            resolve()
            return
          }
          
          wx.getImageInfo({
            src: url,
            success: resolve,
            fail: (err) => {
              console.warn('图片预加载失败:', url, err)
              resolve() // 即使失败也继续
            }
          })
        })
      })
    )
  }
  
  // 检查网络状况
  export const checkNetworkStatus = () => {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          const networkType = res.networkType
          const isWifi = networkType === 'wifi'
          const isGoodNetwork = isWifi || networkType === '4g'
          
          resolve({
            networkType,
            isWifi,
            isGoodNetwork,
            shouldUseLowQuality: !isGoodNetwork
          })
        },
        fail: () => {
          resolve({
            networkType: 'unknown',
            isWifi: false,
            isGoodNetwork: false,
            shouldUseLowQuality: true
          })
        }
      })
    })
  }
  
  // 获取合适的音频质量
  export const getAppropriateAudioQuality = async () => {
    const networkStatus = await checkNetworkStatus()
    return networkStatus.shouldUseLowQuality ? 'low' : 'standard'
  }
  
  export default {
    processImageUrl,
    getBookCover,
    getUserAvatar,
    getAudioUrl,
    downloadFile,
    checkFileExists,
    cacheManager,
    preloadImages,
    checkNetworkStatus,
    getAppropriateAudioQuality
  }