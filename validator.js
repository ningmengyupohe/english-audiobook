/**
 * 表单验证工具
 */

// 验证规则
export const rules = {
    required: (value) => {
      if (value === undefined || value === null || value === '') {
        return '此项为必填项'
      }
      return ''
    },
    
    email: (value) => {
      if (!value) return ''
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return '请输入有效的邮箱地址'
      }
      return ''
    },
    
    phone: (value) => {
      if (!value) return ''
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(value)) {
        return '请输入有效的手机号码'
      }
      return ''
    },
    
    password: (value) => {
      if (!value) return ''
      if (value.length < 6) {
        return '密码长度不能少于6位'
      }
      if (value.length > 20) {
        return '密码长度不能超过20位'
      }
      // 可以添加更多密码规则
      return ''
    },
    
    confirmPassword: (password, confirmPassword) => {
      if (password !== confirmPassword) {
        return '两次输入的密码不一致'
      }
      return ''
    },
    
    username: (value) => {
      if (!value) return ''
      if (value.length < 2) {
        return '用户名长度不能少于2位'
      }
      if (value.length > 20) {
        return '用户名长度不能超过20位'
      }
      const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/
      if (!usernameRegex.test(value)) {
        return '用户名只能包含中文、英文、数字和下划线'
      }
      return ''
    },
    
    minLength: (value, min) => {
      if (!value) return ''
      if (value.length < min) {
        return `长度不能少于${min}位`
      }
      return ''
    },
    
    maxLength: (value, max) => {
      if (!value) return ''
      if (value.length > max) {
        return `长度不能超过${max}位`
      }
      return ''
    },
    
    numeric: (value) => {
      if (!value) return ''
      if (isNaN(value)) {
        return '请输入数字'
      }
      return ''
    },
    
    integer: (value) => {
      if (!value) return ''
      if (!/^\d+$/.test(value)) {
        return '请输入整数'
      }
      return ''
    },
    
    range: (value, min, max) => {
      if (!value) return ''
      const num = Number(value)
      if (isNaN(num)) {
        return '请输入数字'
      }
      if (num < min || num > max) {
        return `请输入${min}到${max}之间的数字`
      }
      return ''
    },
    
    url: (value) => {
      if (!value) return ''
      try {
        new URL(value)
        return ''
      } catch {
        return '请输入有效的URL地址'
      }
    }
  }
  
  // 验证表单
  export const validateForm = (formData, fieldRules) => {
    const errors = {}
    let isValid = true
    
    for (const [fieldName, fieldValue] of Object.entries(formData)) {
      const fieldRule = fieldRules[fieldName]
      
      if (fieldRule) {
        for (const rule of fieldRule) {
          let error = ''
          
          if (typeof rule === 'function') {
            error = rule(fieldValue, formData)
          } else if (typeof rule === 'object' && rule.validator) {
            error = rule.validator(fieldValue, formData)
          } else if (typeof rule === 'string' && rules[rule]) {
            error = rules[rule](fieldValue)
          }
          
          if (error) {
            errors[fieldName] = error
            isValid = false
            break
          }
        }
      }
    }
    
    return {
      isValid,
      errors
    }
  }
  
  // 特定业务验证
  export const authValidators = {
    // 登录表单验证
    loginForm: (data) => {
      return validateForm(data, {
        username: [
          rules.required,
          rules.username
        ],
        password: [
          rules.required,
          rules.password
        ]
      })
    },
    
    // 注册表单验证
    registerForm: (data) => {
      return validateForm(data, {
        username: [
          rules.required,
          rules.username
        ],
        email: [
          rules.required,
          rules.email
        ],
        password: [
          rules.required,
          rules.password
        ],
        confirmPassword: [
          rules.required,
          (value, formData) => rules.confirmPassword(formData.password, value)
        ]
      })
    },
    
    // 用户信息表单验证
    userInfoForm: (data) => {
      return validateForm(data, {
        nickname: [
          rules.required,
          rules.minLength.bind(null, 2),
          rules.maxLength.bind(null, 20)
        ],
        email: [
          rules.email
        ],
        phone: [
          rules.phone
        ]
      })
    },
    
    // 反馈表单验证
    feedbackForm: (data) => {
      return validateForm(data, {
        title: [
          rules.required,
          rules.minLength.bind(null, 5),
          rules.maxLength.bind(null, 50)
        ],
        content: [
          rules.required,
          rules.minLength.bind(null, 10),
          rules.maxLength.bind(null, 500)
        ],
        contact: [
          (value) => {
            if (!value) return ''
            // 可以是邮箱或手机
            if (rules.email(value) && rules.phone(value)) {
              return '请输入有效的联系方式（邮箱或手机）'
            }
            return ''
          }
        ]
      })
    }
  }
  
  // 实时验证（用于输入时提示）
  export const validateField = (fieldName, value, formData, fieldRules) => {
    const rule = fieldRules[fieldName]
    
    if (!rule) return ''
    
    for (const ruleItem of rule) {
      let error = ''
      
      if (typeof ruleItem === 'function') {
        error = ruleItem(value, formData)
      } else if (typeof ruleItem === 'object' && ruleItem.validator) {
        error = ruleItem.validator(value, formData)
      } else if (typeof ruleItem === 'string' && rules[ruleItem]) {
        error = rules[ruleItem](value)
      }
      
      if (error) {
        return error
      }
    }
    
    return ''
  }
  
  // 防抖验证
  export const createDebouncedValidator = (delay = 500) => {
    let timeout = null
    
    return (validateFn) => {
      return (...args) => {
        if (timeout) {
          clearTimeout(timeout)
        }
        
        return new Promise((resolve) => {
          timeout = setTimeout(() => {
            const result = validateFn(...args)
            resolve(result)
          }, delay)
        })
      }
    }
  }
  
  // 表单工具
  export const formUtils = {
    // 获取表单初始值
    getInitialFormData: (fields) => {
      const formData = {}
      fields.forEach(field => {
        formData[field.name] = field.initialValue || ''
      })
      return formData
    },
    
    // 重置表单
    resetForm: (formData, initialData) => {
      return { ...initialData }
    },
    
    // 处理表单提交
    handleSubmit: async (formData, validateFn, submitFn) => {
      const validation = validateFn(formData)
      
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          message: '表单验证失败'
        }
      }
      
      try {
        const result = await submitFn(formData)
        return {
          success: true,
          data: result,
          message: '提交成功'
        }
      } catch (error) {
        return {
          success: false,
          message: error.message || '提交失败',
          error
        }
      }
    }
  }
  
  export default {
    rules,
    validateForm,
    authValidators,
    validateField,
    createDebouncedValidator,
    formUtils
  }