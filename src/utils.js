const generateToken = () => Math.random().toString(36).substring(2, 15);

const validateData = (data, requiredFields) => {
  for (const field of requiredFields) {
    if (!data[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  return { valid: true };
};

const formatMessage = (type, payload) => {
  return JSON.stringify({
    type,
    ...payload,
  });
};

module.exports = { generateToken, validateData, formatMessage };
