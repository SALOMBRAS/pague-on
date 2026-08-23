function decimalToNumber(value) {
  return value === null || value === undefined ? value : Number(value);
}

function serialize(value) {
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    if (typeof value.toNumber === 'function') return value.toNumber();
    if (value instanceof Date) return value.toISOString();
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return serialize(safeUser);
}

module.exports = { decimalToNumber, serialize, publicUser };
