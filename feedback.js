Page({
  data: {
    feedbackTypes: [
      { id: 1, name: '功能建议', icon: '/images/icons/suggestion.png' },
      { id: 2, name: '程序错误', icon: '/images/icons/bug.png' },
      { id: 3, name: '播放问题', icon: '/images/icons/play-issue.png' },
      { id: 4, name: '下载问题', icon: '/images/icons/download-issue.png' },
      { id: 5, name: '内容问题', icon: '/images/icons/content-issue.png' },
      { id: 6, name: '其他问题', icon: '/images/icons/other-issue.png' }
    ],
    selectedType: 1,
    content: '',
    contact: {
      phone: '',
      qq: '',
      email: ''
    },
    images: [],
    canSubmit: false,
    
    // 反馈历史
    history: []
  },

  onLoad: function() {
    this.loadFeedbackHistory()
  },

  selectType: function(e) {
    const typeId = parseInt(e.currentTarget.dataset.id)
    this.setData({
      selectedType: typeId
    })
    this.checkSubmitButton()
  },

  onContentInput: function(e) {
    const content = e.detail.value
    this.setData({
      content: content
    })
    this.checkSubmitButton()
  },

  onPhoneInput: function(e) {
    this.setData({
      'contact.phone': e.detail.value
    })
  },

  onQQInput: function(e) {
    this.setData({
      'contact.qq': e.detail.value
    })
  },

  onEmailInput: function(e) {
    this.setData({
      'contact.email': e.detail.value
    })
  },

  checkSubmitButton: function() {
    const canSubmit = this.data.content.length >= 10 && this.data.content.length <= 500
    this.setData({ canSubmit })
  },

  chooseImage: function() {
    if (this.data.images.length >= 3) {
      wx.showToast({
        title: '最多上传3张图片',
        icon: 'none'
      })
      return
    }
    
    wx.chooseImage({
      count: 3 - this.data.images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = [...this.data.images, ...res.tempFilePaths]
        this.setData({
          images: newImages.slice(0, 3) // 确保不超过3张
        })
      }
    })
  },

  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== index)
    this.setData({ images })
  },

  submitFeedback: function() {
    if (!this.data.canSubmit) return
    
    const { selectedType, content, contact, images } = this.data
    
    // 验证内容长度
    if (content.length < 10) {
      wx.showToast({
        title: '问题描述至少10个字',
        icon: 'none'
      })
      return
    }
    
    // 验证手机号格式
    if (contact.phone && !/^1[3-9]\d{9}$/.test(contact.phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      })
      return
    }
    
    // 验证邮箱格式
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      wx.showToast({
        title: '请输入正确的邮箱',
        icon: 'none'
      })
      return
    }
    
    wx.showLoading({
      title: '提交中...',
      mask: true
    })
    
    // 上传图片
    const uploadPromises = images.map((path, index) => {
      return new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${getApp().globalData.baseUrl}/feedback/upload-image`,
          filePath: path,
          name: 'image',
          formData: {
            index: index
          },
          success: (res) => {
            const data = JSON.parse(res.data)
            if (data.code === 200) {
              resolve(data.data.url)
            } else {
              reject(new Error('图片上传失败'))
            }
          },
          fail: (err) => {
            reject(err)
          }
        })
      })
    })
    
    Promise.all(uploadPromises)
      .then((imageUrls) => {
        // 提交反馈
        return this.sendFeedbackRequest(imageUrls)
      })
      .then(() => {
        wx.hideLoading()
        wx.showToast({
          title: '提交成功',
          icon: 'success',
          duration: 2000
        })
        
        // 重置表单
        this.resetForm()
        
        // 重新加载历史
        this.loadFeedbackHistory()
      })
      .catch((error) => {
        wx.hideLoading()
        wx.showToast({
          title: error.message || '提交失败',
          icon: 'none'
        })
      })
  },

  sendFeedbackRequest: function(imageUrls) {
    return new Promise((resolve, reject) => {
      const { selectedType, content, contact } = this.data
      const userInfo = getApp().globalData.userInfo
      
      wx.request({
        url: `${getApp().globalData.baseUrl}/feedback/submit`,
        method: 'POST',
        data: {
          type: selectedType,
          content: content,
          phone: contact.phone,
          qq: contact.qq,
          email: contact.email,
          images: imageUrls,
          userId: userInfo ? userInfo.userId : null,
          deviceInfo: wx.getSystemInfoSync(),
          appVersion: '1.0.0'
        },
        success: (res) => {
          if (res.data.code === 200) {
            resolve()
          } else {
            reject(new Error(res.data.message || '提交失败'))
          }
        },
        fail: () => {
          reject(new Error('网络错误'))
        }
      })
    })
  },

  resetForm: function() {
    this.setData({
      selectedType: 1,
      content: '',
      contact: {
        phone: '',
        qq: '',
        email: ''
      },
      images: [],
      canSubmit: false
    })
  },

  loadFeedbackHistory: function() {
    const userInfo = getApp().globalData.userInfo
    if (!userInfo) return
    
    // 模拟历史数据
    const mockHistory = [
      {
        id: 1,
        type: 1,
        content: '希望可以增加英语字幕同步显示功能，方便学习',
        status: 'resolved',
        createTime: '2023-12-28 14:30:00',
        reply: '感谢建议，我们会在下个版本中增加此功能'
      },
      {
        id: 2,
        type: 3,
        content: '播放时会突然中断，需要重新进入才能继续播放',
        status: 'processing',
        createTime: '2023-12-27 10:15:00',
        reply: '我们正在修复这个问题，预计本周内解决'
      },
      {
        id: 3,
        type: 2,
        content: '在分类页面滑动时偶尔会卡顿',
        status: 'pending',
        createTime: '2023-12-26 16:45:00',
        reply: ''
      }
    ]
    
    this.setData({ history: mockHistory })
  },

  getTypeName: function(typeId) {
    const type = this.data.feedbackTypes.find(item => item.id === typeId)
    return type ? type.name : '其他'
  },

  getStatusText: function(status) {
    const statusMap = {
      'pending': '待处理',
      'processing': '处理中',
      'resolved': '已解决'
    }
    return statusMap[status] || '未知状态'
  },

  formatTime: function(timeString) {
    if (!timeString) return ''
    
    const date = new Date(timeString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  },

  goBack: function() {
    wx.navigateBack()
  }
})