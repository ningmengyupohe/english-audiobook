Page({
  data: {
    // 播放设置
    timerIndex: 0,
    timerOptions: ['关闭', '15分钟后', '30分钟后', '45分钟后', '60分钟后'],
    speedIndex: 2,
    speedOptions: ['0.5x', '0.75x', '1.0x', '1.25x', '1.5x', '2.0x'],
    skipIntro: true,
    continuousPlay: true,
    
    // 下载设置
    wifiOnly: true,
    autoDelete: false,
    qualityIndex: 1,
    qualityOptions: ['标准', '高清', '无损'],
    
    // 显示设置
    themeName: '默认',
    fontSize: 18,
    nightMode: false,
    showSubtitles: true,
    
    // 通知设置
    studyReminder: true,
    reminderTime: '20:00',
    newBookNotify: true,
    updateNotify: true,
    
    // 其他设置
    cacheSize: '0KB',
    version: '1.0.0',
    hasUpdate: false,
    
    isLoggedIn: false
  },

  onLoad: function() {
    this.loadSettings()
    this.checkLoginStatus()
    this.calculateCacheSize()
  },

  loadSettings: function() {
    // 从本地存储加载设置
    const settings = wx.getStorageSync('appSettings') || {}
    
    this.setData({
      timerIndex: settings.timerIndex || 0,
      speedIndex: settings.speedIndex || 2,
      skipIntro: settings.skipIntro !== undefined ? settings.skipIntro : true,
      continuousPlay: settings.continuousPlay !== undefined ? settings.continuousPlay : true,
      wifiOnly: settings.wifiOnly !== undefined ? settings.wifiOnly : true,
      autoDelete: settings.autoDelete || false,
      qualityIndex: settings.qualityIndex || 1,
      themeName: settings.themeName || '默认',
      fontSize: settings.fontSize || 18,
      nightMode: settings.nightMode || false,
      showSubtitles: settings.showSubtitles !== undefined ? settings.showSubtitles : true,
      studyReminder: settings.studyReminder !== undefined ? settings.studyReminder : true,
      reminderTime: settings.reminderTime || '20:00',
      newBookNotify: settings.newBookNotify !== undefined ? settings.newBookNotify : true,
      updateNotify: settings.updateNotify !== undefined ? settings.updateNotify : true
    })
  },

  saveSettings: function() {
    const settings = {
      timerIndex: this.data.timerIndex,
      speedIndex: this.data.speedIndex,
      skipIntro: this.data.skipIntro,
      continuousPlay: this.data.continuousPlay,
      wifiOnly: this.data.wifiOnly,
      autoDelete: this.data.autoDelete,
      qualityIndex: this.data.qualityIndex,
      themeName: this.data.themeName,
      fontSize: this.data.fontSize,
      nightMode: this.data.nightMode,
      showSubtitles: this.data.showSubtitles,
      studyReminder: this.data.studyReminder,
      reminderTime: this.data.reminderTime,
      newBookNotify: this.data.newBookNotify,
      updateNotify: this.data.updateNotify
    }
    
    wx.setStorageSync('appSettings', settings)
  },

  checkLoginStatus: function() {
    const token = wx.getStorageSync('token')
    this.setData({
      isLoggedIn: !!token
    })
  },

  calculateCacheSize: function() {
    const cacheSize = wx.getStorageInfoSync().currentSize
    this.setData({
      cacheSize: cacheSize + 'KB'
    })
  },

  goBack: function() {
    wx.navigateBack()
  },

  onTimerChange: function(e) {
    const index = e.detail.value
    this.setData({
      timerIndex: index
    })
    this.saveSettings()
  },

  onSpeedChange: function(e) {
    const index = e.detail.value
    this.setData({
      speedIndex: index
    })
    this.saveSettings()
  },

  onSkipIntroChange: function(e) {
    this.setData({
      skipIntro: e.detail.value
    })
    this.saveSettings()
  },

  onContinuousPlayChange: function(e) {
    this.setData({
      continuousPlay: e.detail.value
    })
    this.saveSettings()
  },

  onWifiOnlyChange: function(e) {
    this.setData({
      wifiOnly: e.detail.value
    })
    this.saveSettings()
  },

  onAutoDeleteChange: function(e) {
    this.setData({
      autoDelete: e.detail.value
    })
    this.saveSettings()
  },

  onQualityChange: function(e) {
    const index = e.detail.value
    this.setData({
      qualityIndex: index
    })
    this.saveSettings()
  },

  onFontSizeChange: function(e) {
    const value = e.detail.value
    this.setData({
      fontSize: value
    })
    this.saveSettings()
  },

  onNightModeChange: function(e) {
    this.setData({
      nightMode: e.detail.value
    })
    this.saveSettings()
  },

  onSubtitlesChange: function(e) {
    this.setData({
      showSubtitles: e.detail.value
    })
    this.saveSettings()
  },

  onStudyReminderChange: function(e) {
    this.setData({
      studyReminder: e.detail.value
    })
    this.saveSettings()
  },

  onReminderTimeChange: function(e) {
    this.setData({
      reminderTime: e.detail.value
    })
    this.saveSettings()
  },

  onNewBookNotifyChange: function(e) {
    this.setData({
      newBookNotify: e.detail.value
    })
    this.saveSettings()
  },

  onUpdateNotifyChange: function(e) {
    this.setData({
      updateNotify: e.detail.value
    })
    this.saveSettings()
  },

  goToPlaySettings: function() {
    wx.navigateTo({
      url: '/pages/play-settings/play-settings'
    })
  },

  goToThemeSettings: function() {
    wx.navigateTo({
      url: '/pages/theme-settings/theme-settings'
    })
  },

  goToAccountSecurity: function() {
    wx.navigateTo({
      url: '/pages/account-security/account-security'
    })
  },

  goToPrivacySettings: function() {
    wx.navigateTo({
      url: '/pages/privacy-settings/privacy-settings'
    })
  },

  clearCache: function() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          this.calculateCacheSize()
          wx.showToast({
            title: '清理成功',
            icon: 'success'
          })
        }
      }
    })
  },

  goToAbout: function() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  checkUpdate: function() {
    const updateManager = wx.getUpdateManager()
    
    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        this.setData({ hasUpdate: true })
        
        wx.showModal({
          title: '发现新版本',
          content: '是否立即更新？',
          success: (res) => {
            if (res.confirm) {
              updateManager.onUpdateReady(() => {
                wx.showModal({
                  title: '更新提示',
                  content: '新版本已经准备好，是否重启应用？',
                  success: (res) => {
                    if (res.confirm) {
                      updateManager.applyUpdate()
                    }
                  }
                })
              })
            }
          }
        })
      } else {
        wx.showToast({
          title: '已是最新版本',
          icon: 'success'
        })
      }
    })
  },

  goToFeedback: function() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    })
  },

  goToHelp: function() {
    wx.navigateTo({
      url: '/pages/help/help'
    })
  },

  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          
          const app = getApp()
          app.globalData.token = null
          app.globalData.userInfo = null
          
          this.setData({ isLoggedIn: false })
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
          
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      }
    })
  }
})