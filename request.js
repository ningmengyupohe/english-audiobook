/**
 * 通用网络请求封装
 */
const request = (url, method = 'GET', data = {}, header = {}) => {
    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          ...header
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`))
          }
        },
        fail: reject
      })
    })
  }
  
  // 快捷方法
  export const get = (url, data = {}) => request(url, 'GET', data)
  export const post = (url, data = {}) => request(url, 'POST', data)
  export const put = (url, data = {}) => request(url, 'PUT', data)
  export const del = (url, data = {}) => request(url, 'DELETE', data)
  
  export default {
    get,
    post,
    put,
    del,
    request
  }