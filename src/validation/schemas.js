const { z } = require('zod');

const username = z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric/underscore only');
const password = z.string().min(6).max(100);
const room = z.string().min(1).max(30).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().min(1).max(2000);
const token = z.string().min(10);
const msgId = z.string().min(1).max(64).optional();
const status = z.enum(['online', 'away']);

const schemas = {
  register: z.object({ username, password }),
  login: z.object({ username, password }),
  refresh: z.object({ refreshToken: token }),
  private_message: z.object({ token, to: username, text, msgId }),
  join_room: z.object({ token, room }),
  leave_room: z.object({ token, room }),
  room_message: z.object({ token, room, text, msgId }),
  list_rooms: z.object({ token }),
  list_users: z.object({ token }),
  set_status: z.object({ token, status }),
  typing_start: z.object({ token, room }),
  typing_stop:  z.object({ token, room }),
};

const validate = (type, data) => {
  const schema = schemas[type];
  if (!schema) return { ok: false, error: `Unknown message type: ${type}` };
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: result.error.errors.map((e) => e.message).join(', ') };
  }
  return { ok: true, data: result.data };
};

module.exports = { validate };
