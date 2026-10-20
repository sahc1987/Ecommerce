const db = require('../config/database');

// WHERE builder for list endpoints. `add('o.status = ?', value)` binds the
// value to the next $n; every `?` in the fragment refers to that same value,
// so `(name ILIKE ? OR email ILIKE ?)` binds the search term once.
class Filters {
  constructor() {
    this.params = [];
    this.conditions = [];
  }

  add(sql, value) {
    this.params.push(value);
    this.conditions.push(sql.replaceAll('?', `$${this.params.length}`));
    return this;
  }

  // A condition without a value, e.g. 'p.is_active = TRUE'.
  raw(sql) {
    this.conditions.push(sql);
    return this;
  }

  get where() {
    return this.conditions.length ? `WHERE ${this.conditions.join(' AND ')}` : '';
  }
}

// One page of rows plus the paging fields every list endpoint returns.
// `table` is the base table (with alias) the filters refer to; `joins` only
// feed the selected columns, so the count skips them. The count and the page
// run in parallel.
async function paginate({ select, table, joins = '', filters = new Filters(), orderBy, page, limit, offset }, client = db) {
  const { where, params } = filters;
  const n = params.length;
  const [count, rows] = await Promise.all([
    client.query(`SELECT COUNT(*) FROM ${table} ${where}`, params),
    client.query(
      `SELECT ${select} FROM ${table} ${joins} ${where} ORDER BY ${orderBy} LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...params, limit, offset]
    ),
  ]);
  const total = Number.parseInt(count.rows[0].count, 10);
  return { rows: rows.rows, total, page, pages: Math.ceil(total / limit) };
}

module.exports = { Filters, paginate };
