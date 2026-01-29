/**
 * 用户认证和权限管理
 */
import { cloudAPI } from './uni-cloud.js'

const TOKEN_KEY = 'user_token'
const USER_INFO_KEY = 'user_info'

// 检查登录状态
export const checkLogin = async () => {
  const token = wx.getStorageSync(TOKEN_KEY)
  if (!token) {
    return { isLogin: false }
  }

  try {
    const userInfo = wx.getStorageSync(USER_INFO_KEY)
    return { isLogin: true, token, userInfo }
  } catch (error) {
    return { isLogin: false }
  }
}

// 登录
export const login = async (userData) => {
  try {
    const result = await cloudAPI.user.login(userData)
    if (result.code === 0 && result.data) {
      const { token, userInfo } = result.data
      wx.setStorageSync(TOKEN_KEY, token)
      wx.setStorageSync(USER_INFO_KEY, userInfo)
      return { success: true, data: result.data }
    }
    return { success: false, message: result.message || '登录失败' }
  } catch (error) {
    console.error('登录失败:', error)
    return { success: false, message: error.message || '网络错误' }
  }
}

// 注册
export const register = async (userData) => {
  try {
    const result = await cloudAPI.user.register(userData)
    if (result.code === 0) {
      return { success: true, data: result.data }
    }
    return { success: false, message: result.message || '注册失败' }
  } catch (error) {
    console.error('注册失败:', error)
    return { success: false, message: error.message || '网络错误' }
  }
}

// 获取用户信息
export const getUserInfo = async () => {
  try {
    const result = await cloudAPI.user.getInfo()
    if (result.code === 0) {
      const userInfo = result.data
      wx.setStorageSync(USER_INFO_KEY, userInfo)
      return { success: true, data: userInfo }
    }
    return { success: false, message: result.message }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return { success: false, message: error.message || '网络错误' }
  }
}

// 更新用户信息
export const updateUserInfo = async (userData) => {
  try {
    const result = await cloudAPI.user.updateInfo(userData)
    if (result.code === 0) {
      wx.setStorageSync(USER_INFO_KEY, result.data)
      return { success: true, data: result.data }
    }
    return { success: false, message: result.message }
  } catch (error) {
    console.error('更新用户信息失败:', error)
    return { success: false, message: error.message || '网络错误' }
  }
}

// 登出
export const logout = () => {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_INFO_KEY)
  return { success: true }
}

// 获取当前用户
export const getCurrentUser = () => {
  return wx.getStorageSync(USER_INFO_KEY) || null
}

// 检查token
export const getToken = () => {
  return wx.getStorageSync(TOKEN_KEY) || null
}

// 请求拦截器（自动添加token）
export const withAuth = (requestFn) => {
  return async (...args) => {
    const token = getToken()
    if (token) {
      // 这里可以统一添加token到请求头
      // 由于云函数URL化，token通常在data中传递
      if (args[1] && typeof args[1] === 'object') {
        args[1].token = token
      }
    }
    return requestFn(...args)
  }
}

export default {
  checkLogin,
  login,
  register,
  getUserInfo,
  updateUserInfo,
  logout,
  getCurrentUser,
  getToken,
  withAuth
}