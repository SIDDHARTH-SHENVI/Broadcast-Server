const bcrypt = require('bcrypt');
const config = require('../../config/config');

const hash = (plain) => bcrypt.hash(plain, config.bcrypt.rounds);
const verify = (plain, hashed) => bcrypt.compare(plain, hashed);

module.exports = { hash, verify };
