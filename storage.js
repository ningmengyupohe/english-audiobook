/**
 * 本地存储封装
 */

// 存储数据
export const setStorage = (key, value) => {
    try {
      wx.setStorageSync(key, value)
      return true
    } catch (error) {
      console.error('存储失败:', error)
      return false
    }
  }
  
  // 获取数据
  export const getStorage = (key, defaultValue = null) => {
    try {
      const value = wx.getStorageSync(key)
      return value !== undefined ? value : defaultValue
    } catch (error) {
      console.error('获取存储失败:', error)
      return defaultValue
    }
  }
  
  // 删除数据
  export const removeStorage = (key) => {
    try {
      wx.removeStorageSync(key)
      return true
    } catch (error) {
      console.error('删除存储失败:', error)
      return false
    }
  }
  
  // 清空所有数据
  export const clearStorage = () => {
    try {
      wx.clearStorageSync()
      return true
    } catch (error) {
      console.error('清空存储失败:', error)
      return false
    }
  }
  
  // 存储对象（自动JSON序列化）
  export const setObject = (key, obj) => {
    return setStorage(key, JSON.stringify(obj))
  }
  
  // 获取对象（自动JSON解析）
  export const getObject = (key, defaultValue = null) => {
    const value = getStorage(key)
    if (value === null || value === undefined) {
      return defaultValue
    }
    try {
      return JSON.parse(value)
    } catch (error) {
      console.error('解析JSON失败:', error)
      return defaultValue
    }
  }
  
  // 特定业务存储
  export const storageKeys = {
    USER_TOKEN: 'user_token',
    USER_INFO: 'user_info',
    SETTINGS: 'app_settings',
    PLAY_HISTORY: 'play_history',
    SEARCH_HISTORY: 'search_history',
    FAVORITES: 'user_favorites'
  }
  
  // 存储用户设置
  export const setSettings = (settings) => {
    return setObject(storageKeys.SETTINGS, settings)
  }
  
  export const getSettings = () => {
    return getObject(storageKeys.SETTINGS, {
      autoplay: false,
      playbackSpeed: 1.0,
      subtitleEnabled: true,
      theme: 'light',
      downloadQuality: 'high'
    })
  }
  
  // 播放历史
  export const addPlayHistory = (bookInfo) => {
    const history = getObject(storageKeys.PLAY_HISTORY, [])
    // 去重
    const newHistory = history.filter(item => item.id !== bookInfo.id)
    newHistory.unshift({
      ...bookInfo,
      playTime: Date.now()
    })
    // 只保留最近的50条
    const limitedHistory = newHistory.slice(0, 50)
    setObject(storageKeys.PLAY_HISTORY, limitedHistory)
    return limitedHistory
  }
  
  export const getPlayHistory = () => {
    return getObject(storageKeys.PLAY_HISTORY, [])
  }
  
  // 搜索历史
  export const addSearchHistory = (keyword) => {
    if (!keyword.trim()) return
    const history = getObject(storageKeys.SEARCH_HISTORY, [])
    // 去重并移到前面
    const newHistory = history.filter(item => item !== keyword)
    newHistory.unshift(keyword)
    // 只保留最近的10条
    const limitedHistory = newHistory.slice(0, 10)
    setObject(storageKeys.SEARCH_HISTORY, limitedHistory)
    return limitedHistory
  }
  
  export const getSearchHistory = () => {
    return getObject(storageKeys.SEARCH_HISTORY, [])
  }
  
  export const clearSearchHistory = () => {
    removeStorage(storageKeys.SEARCH_HISTORY)
  }
  
  export default {
    setStorage,
    getStorage,
    removeStorage,
    clearStorage,
    setObject,
    getObject,
    storageKeys,
    setSettings,
    getSettings,
    addPlayHistory,
    getPlayHistory,
    addSearchHistory,
    getSearchHistory,
    clearSearchHistory
  }