Page({
  data: {
    faqList: [
      {
        id: 1,
        question: '如何开始听一本书？',
        answer: '在首页或分类页面找到您想听的书籍，点击书籍封面进入详情页，然后点击播放按钮即可开始收听。您也可以在书架中找到之前听过的书籍继续播放。',
        expanded: false
      },
      {
        id: 2,
        question: '如何下载书籍离线收听？',
        answer: '在书籍播放页面或详情页面，点击下载按钮即可下载该书籍。下载完成后，您可以在"我的-已下载"中找到已下载的书籍，无需网络即可收听。',
        expanded: false
      },
      {
        id: 3,
        question: '如何收藏喜欢的书籍？',
        answer: '在书籍播放页面或详情页面，点击心形收藏按钮即可收藏该书籍。收藏的书籍可以在"书架-收藏"中查看。',
        expanded: false
      },
      {
        id: 4,
        question: '播放速度如何调节？',
        answer: '在播放页面，点击播放速度按钮可以选择0.5x、0.75x、1.0x、1.25x、1.5x、2.0x等不同速度。您也可以在设置中设置默认播放速度。',
        expanded: false
      },
      {
        id: 5,
        question: '如何设置定时关闭？',
        answer: '在播放页面，点击定时按钮可以选择15、30、45、60分钟等定时关闭选项。播放到设定时间后会自动停止播放。',
        expanded: false
      },
      {
        id: 6,
        question: '忘记密码怎么办？',
        answer: '在登录页面点击"忘记密码"，按照提示输入手机号和验证码，然后设置新密码即可重置密码。',
        expanded: false
      },
      {
        id: 7,
        question: '如何清除缓存？',
        answer: '在"我的-设置"页面，找到"清理缓存"选项，点击即可清理应用缓存数据。',
        expanded: false
      },
      {
        id: 8,
        question: 'VIP会员有什么特权？',
        answer: 'VIP会员可以收听所有付费书籍、无广告收听、高清音质下载、专属客服等特权。',
        expanded: false
      }
    ],
    helpCategories: [
      { id: 1, name: '账号问题', icon: '/images/icons/account-help.png' },
      { id: 2, name: '播放问题', icon: '/images/icons/play-help.png' },
      { id: 3, name: '下载问题', icon: '/images/icons/download-help.png' },
      { id: 4, name: '会员问题', icon: '/images/icons/vip-help.png' },
      { id: 5, name: '支付问题', icon: '/images/icons/payment-help.png' },
      { id: 6, name: '其他问题', icon: '/images/icons/other-help.png' }
    ]
  },

  toggleFaq: function(e) {
    const index = e.currentTarget.dataset.index
    const faqList = this.data.faqList.map((item, i) => {
      return {
        ...item,
        expanded: i === index ? !item.expanded : false
      }
    })
    
    this.setData({ faqList })
  },

  goBack: function() {
    wx.navigateBack()
  },

  goToSearch: function() {
    wx.navigateTo({
      url: '/pages/help-search/help-search'
    })
  },

  goToCategoryHelp: function(e) {
    const categoryId = e.currentTarget.dataset.id
    const category = this.data.helpCategories.find(item => item.id === categoryId)
    
    wx.navigateTo({
      url: `/pages/category-help/category-help?categoryId=${categoryId}&categoryName=${category.name}`
    })
  },

  contactCustomerService: function() {
    wx.showActionSheet({
      itemList: ['在线客服', '客服电话', '客服邮箱'],
      success: (res) => {
        const tapIndex = res.tapIndex
        switch(tapIndex) {
          case 0:
            // 在线客服
            wx.navigateTo({
              url: '/pages/customer-service/customer-service'
            })
            break
          case 1:
            // 拨打电话
            wx.makePhoneCall({
              phoneNumber: '400-123-4567'
            })
            break
          case 2:
            // 发送邮件
            wx.setClipboardData({
              data: 'support@english-audiobook.com',
              success: () => {
                wx.showToast({
                  title: '邮箱已复制',
                  icon: 'success'
                })
              }
            })
            break
        }
      }
    })
  },

  goToFeedback: function() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    })
  },

  goToUserAgreement: function() {
    wx.navigateTo({
      url: '/pages/agreement/user-agreement'
    })
  },

  goToPrivacyPolicy: function() {
    wx.navigateTo({
      url: '/pages/agreement/privacy-policy'
    })
  }
})