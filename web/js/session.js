const KEY = "hmis.token";

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const write = (token) => {
  try {
    token ? localStorage.setItem(KEY, token) : localStorage.removeItem(KEY);
  } catch {}
};

export const state = { token: read(), user: null, access: {}, roles: {} };

export const token = () => state.token;

export function apply(payload) {
  if (payload.token) {
    state.token = payload.token;
    write(payload.token);
  }
  Object.assign(state, { user: payload.user, access: payload.access, roles: payload.roles });
}

export function clear() {
  state.token = null;
  state.user = null;
  state.access = {};
  write(null);
}

export const can = (area, mode = "read") => !!state.access[area]?.[mode];
