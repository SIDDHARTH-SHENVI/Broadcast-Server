const fs = require('fs');
const path = require('path');
const os = require('os');

// Profile from env or CLI arg (e.g., BROADCAST_PROFILE=alice or --profile=alice)
const getProfile = () => {
  const fromEnv = process.env.BROADCAST_PROFILE;
  if (fromEnv) return fromEnv;
  const arg = process.argv.find((a) => a.startsWith('--profile='));
  if (arg) return arg.split('=')[1];
  return 'default';
};

const profile = getProfile();
const dir = path.join(os.homedir(), '.broadcast');
const file = path.join(dir, `${profile}.json`);

const load = () => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
};

const save = (data) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

const clear = () => {
  if (fs.existsSync(file)) fs.unlinkSync(file);
};

module.exports = { load, save, clear, profile };
