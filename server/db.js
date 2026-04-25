const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'task_orchestrator',
  password: '1234',
  port: 5432,
});

pool.on('connect', () => console.log('✅ PostgreSQL connected.'));

module.exports = pool;
