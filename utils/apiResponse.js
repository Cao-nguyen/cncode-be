const successResponse = (res, statusCode = 200, message = 'Success', data = null) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

const errorResponse = (res, statusCode = 500, message = 'Internal Server Error', error = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        error: error?.message || error
    });
};

module.exports = { successResponse, errorResponse };