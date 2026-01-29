// cloudfunctions/common/response.js
'use strict';

class Response {
  static success(data = null, message = '操作成功') {
    return {
      code: 0,
      success: true,
      message,
      data,
      timestamp: Date.now()
    };
  }

  static error(message = '操作失败', code = 500, data = null) {
    return {
      code: code || 500,
      success: false,
      message,
      data,
      timestamp: Date.now()
    };
  }

  static validationError(message = '参数验证失败') {
    return this.error(message, 400);
  }

  static unauthorized(message = '未授权访问') {
    return this.error(message, 401);
  }

  static forbidden(message = '权限不足') {
    return this.error(message, 403);
  }

  static notFound(message = '资源不存在') {
    return this.error(message, 404);
  }
}

module.exports = Response;